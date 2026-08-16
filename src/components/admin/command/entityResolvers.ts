import { supabase } from "@/integrations/supabase/client";

/**
 * Step 4 of the interpretation pipeline: resolve a natural-language name/
 * title reference to a concrete row ID. See docs/copilot/ENTITY_RESOLUTION.md.
 *
 * Uses plain substring matching (ILIKE) rather than fuzzy/trigram matching —
 * per the "cheapest reliable method" instruction, this is the correct
 * default for short name/title fields at this project's table size (see
 * the library's structured_filtered_query pattern). Upgrading to trigram
 * similarity is a documented, non-blocking future enhancement, not a gap
 * in this implementation.
 */

export type ResolvedEntity<T> = { status: "single"; entity: T } | { status: "ambiguous"; candidates: T[] } | { status: "none" };

// If the resolver query is itself a UUID (e.g. pasted from a URL or an
// earlier response), try it as a direct ID lookup first — cheaper and
// more reliable than a substring search, and the only way a short code
// that isn't part of any title/name (this project's IDs are UUIDs, not
// human-readable reference codes) can ever resolve.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResolvedListing = { id: string; title: string; status: string };

export async function resolveListingByTitle(titleQuery: string): Promise<ResolvedEntity<ResolvedListing>> {
  const query = titleQuery.trim();
  if (!query) return { status: "none" };

  if (UUID_REGEX.test(query)) {
    const { data: byId } = await supabase
      .from("properties")
      .select("id, title, property_name, status")
      .eq("id", query)
      .maybeSingle();
    if (byId) {
      return { status: "single", entity: { id: byId.id, title: byId.property_name ?? byId.title, status: byId.status } };
    }
  }

  // Two separate .ilike() calls, merged here, rather than a single
  // .or("title.ilike.%x%,property_name.ilike.%x%") call — PostgREST's
  // or() filter takes a raw, comma-delimited expression string, and
  // interpolating unescaped user text into it lets a value containing a
  // comma (or other DSL-reserved character) inject additional filter
  // clauses the caller never intended. .ilike(column, pattern) instead
  // passes the pattern as a properly-encoded query parameter, immune to
  // this class of injection. See docs/security/COPILOT_SECURITY_AUDIT.md.
  const [byTitle, byPropertyName] = await Promise.all([
    supabase.from("properties").select("id, title, property_name, status").ilike("title", `%${query}%`).limit(5),
    supabase.from("properties").select("id, title, property_name, status").ilike("property_name", `%${query}%`).limit(5),
  ]);

  if (byTitle.error || byPropertyName.error) {
    return { status: "none" };
  }

  const merged = new Map<string, ResolvedListing>();
  for (const row of [...(byTitle.data ?? []), ...(byPropertyName.data ?? [])]) {
    merged.set(row.id, { id: row.id, title: row.property_name ?? row.title, status: row.status });
  }
  const candidates = Array.from(merged.values()).slice(0, 5);

  if (candidates.length === 0) return { status: "none" };

  if (candidates.length === 1) return { status: "single", entity: candidates[0] };
  return { status: "ambiguous", candidates };
}

export type ResolvedAgent = { id: string; fullName: string; isActive: boolean | null };

export async function resolveAgentByName(nameQuery: string): Promise<ResolvedEntity<ResolvedAgent>> {
  const query = nameQuery.trim();
  if (!query) return { status: "none" };

  if (UUID_REGEX.test(query)) {
    const { data: byId } = await supabase
      .from("agent_profiles")
      .select("id, profiles(full_name, is_active)")
      .eq("id", query)
      .maybeSingle();
    if (byId) {
      return { status: "single", entity: { id: byId.id, fullName: byId.profiles?.full_name ?? "(no name)", isActive: byId.profiles?.is_active ?? null } };
    }
  }

  const { data, error } = await supabase
    .from("agent_profiles")
    .select("id, profiles(full_name, is_active)")
    .limit(200);

  if (error || !data) return { status: "none" };

  const lowerQuery = query.toLowerCase();
  const candidates: ResolvedAgent[] = data
    .filter((row) => (row.profiles?.full_name ?? "").toLowerCase().includes(lowerQuery))
    .map((row) => ({
      id: row.id,
      fullName: row.profiles?.full_name ?? "(no name)",
      isActive: row.profiles?.is_active ?? null,
    }));

  if (candidates.length === 0) return { status: "none" };
  if (candidates.length === 1) return { status: "single", entity: candidates[0] };
  return { status: "ambiguous", candidates };
}
