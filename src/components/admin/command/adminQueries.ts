import { supabase } from "@/integrations/supabase/client";
import { requireAdmin } from "@/components/admin/adminGuards";

/**
 * Level 2 — deterministic, typed query functions. The LLM (or the
 * deterministic pattern layer in intentPatterns.ts) may produce the
 * *filter object*; it never produces SQL and never talks to Supabase
 * directly. Every field on every filter type below is the only vocabulary
 * available to a caller — there is no escape hatch to pass an arbitrary
 * string through to the database. See docs/copilot/LEVEL_2_IMPLEMENTATION.md.
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export type QueryResult<T> = { data: T[]; error: string | null; total: number | null };

function clampLimit(limit?: number): number {
  if (!limit || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function clampOffset(offset?: number): number {
  if (!offset || offset < 0) return 0;
  return offset;
}

// --- Agents ------------------------------------------------------------

export type AgentQueryFilters = {
  isActive?: boolean;
  isPublished?: boolean;
  isFeatured?: boolean;
  agentType?: "internal" | "external";
  nameContains?: string;
  limit?: number;
  offset?: number;
};

export type AgentQueryRow = {
  id: string;
  fullName: string;
  email: string | null;
  isActive: boolean | null;
  isPublished: boolean | null;
  isFeatured: boolean | null;
  agentType: string | null;
};

export async function queryAgents(filters: AgentQueryFilters = {}): Promise<QueryResult<AgentQueryRow>> {
  const { error: authError } = await requireAdmin();
  if (authError) return { data: [], error: authError, total: null };

  const limit = clampLimit(filters.limit);
  const offset = clampOffset(filters.offset);

  let query = supabase
    .from("agent_profiles")
    .select("id, agent_type, is_published, is_featured, profiles(full_name, email, is_active)", { count: "exact" });

  if (filters.isPublished !== undefined) query = query.eq("is_published", filters.isPublished);
  if (filters.isFeatured !== undefined) query = query.eq("is_featured", filters.isFeatured);
  if (filters.agentType) query = query.eq("agent_type", filters.agentType);

  const { data, error, count } = await query.order("display_order", { ascending: true }).range(offset, offset + limit - 1);

  if (error) return { data: [], error: error.message, total: null };

  let rows: AgentQueryRow[] = (data ?? []).map((row: any) => ({
    id: row.id,
    fullName: row.profiles?.full_name ?? "(no name)",
    email: row.profiles?.email ?? null,
    isActive: row.profiles?.is_active ?? null,
    isPublished: row.is_published,
    isFeatured: row.is_featured,
    agentType: row.agent_type,
  }));

  // is_active lives on the joined `profiles` row, which PostgREST cannot
  // filter on reliably via this embedded-select shape (see
  // docs/copilot/ENTITY_RESOLUTION.md for the same constraint on
  // resolveAgentByName) — filtered here in application code instead of
  // the database, deliberately, not as an oversight.
  if (filters.isActive !== undefined) rows = rows.filter((r) => r.isActive === filters.isActive);
  if (filters.nameContains) {
    const needle = filters.nameContains.toLowerCase();
    rows = rows.filter((r) => r.fullName.toLowerCase().includes(needle));
  }

  return { data: rows, error: null, total: count ?? null };
}

// --- Listings ------------------------------------------------------------

export type ListingQueryFilters = {
  status?: "active" | "draft";
  transactionType?: "sale" | "rental";
  priceMin?: number;
  priceMax?: number;
  bedrooms?: number;
  isFeatured?: boolean;
  titleContains?: string;
  limit?: number;
  offset?: number;
};

export type ListingQueryRow = {
  id: string;
  title: string;
  status: string;
  price: number | null;
  monthlyRental: number | null;
  bedrooms: number | null;
  isFeatured: boolean | null;
};

export async function queryListings(filters: ListingQueryFilters = {}): Promise<QueryResult<ListingQueryRow>> {
  const { error: authError } = await requireAdmin();
  if (authError) return { data: [], error: authError, total: null };

  if (filters.priceMin !== undefined && filters.priceMax !== undefined && filters.priceMin > filters.priceMax) {
    return { data: [], error: "priceMin cannot be greater than priceMax.", total: null };
  }

  const limit = clampLimit(filters.limit);
  const offset = clampOffset(filters.offset);

  let query = supabase
    .from("properties")
    .select("id, title, property_name, status, price, monthly_rental, bedrooms, is_featured", { count: "exact" });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.transactionType) query = query.eq("transaction_type", filters.transactionType);
  if (filters.bedrooms !== undefined) query = query.eq("bedrooms", filters.bedrooms);
  if (filters.isFeatured !== undefined) query = query.eq("is_featured", filters.isFeatured);
  if (filters.priceMin !== undefined) query = query.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) query = query.lte("price", filters.priceMax);
  if (filters.titleContains) {
    // .ilike(column, pattern) only — deliberately not a raw .or() filter
    // string here. This filter is combined with several other chained
    // conditions (status/price/bedrooms/featured), which makes the
    // two-query-merge approach used in entityResolvers.ts impractical
    // (independently paginating and re-merging two filtered result sets).
    // Interpolating unescaped user text into a raw .or() string is a real
    // injection vector — see docs/security/COPILOT_SECURITY_AUDIT.md — so
    // this deliberately searches `title` only rather than also matching
    // `property_name`, trading a small completeness gap for a guaranteed-
    // safe, typed filter call.
    query = query.ilike("title", `%${filters.titleContains}%`);
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  if (error) return { data: [], error: error.message, total: null };

  const rows: ListingQueryRow[] = (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.property_name ?? row.title,
    status: row.status,
    price: row.price,
    monthlyRental: row.monthly_rental,
    bedrooms: row.bedrooms,
    isFeatured: row.is_featured,
  }));

  return { data: rows, error: null, total: count ?? null };
}

// --- Applications ------------------------------------------------------------

export type ApplicationQueryFilters = {
  status?: "pending" | "reviewing" | "interview" | "approved" | "declined";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

export type ApplicationQueryRow = {
  id: string;
  fullName: string;
  email: string;
  status: string | null;
  currentAgency: string | null;
  createdAt: string;
};

export async function queryApplications(filters: ApplicationQueryFilters = {}): Promise<QueryResult<ApplicationQueryRow>> {
  const { error: authError } = await requireAdmin();
  if (authError) return { data: [], error: authError, total: null };

  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return { data: [], error: "dateFrom cannot be after dateTo.", total: null };
  }

  const limit = clampLimit(filters.limit);
  const offset = clampOffset(filters.offset);

  let query = supabase
    .from("agent_applications")
    .select("id, full_name, email, status, current_agency, created_at", { count: "exact" });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  if (error) return { data: [], error: error.message, total: null };

  const rows: ApplicationQueryRow[] = (data ?? []).map((row: any) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    currentAgency: row.current_agency,
    createdAt: row.created_at,
  }));

  return { data: rows, error: null, total: count ?? null };
}
