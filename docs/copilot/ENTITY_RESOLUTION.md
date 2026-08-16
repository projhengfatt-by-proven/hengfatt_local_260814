# Entity Resolution

Implemented 2026-08-17 in `src/components/admin/command/entityResolvers.ts`.
This is step 4 of the interpretation pipeline (`docs/copilot/INTENT_MODEL.md`)
— turning a natural-language name/title reference into a concrete database
row ID, or a clear "ambiguous"/"not found" result if it can't.

This also finally implements `resolveListingByTitle`/`resolveAgentByName`,
which were specified but deferred as Level 2 work in
`docs/admin/ADMIN_ACTION_CATALOG.md` and flagged there as "arguably the
single highest-leverage function in this whole document" — every existing
Copilot tool that takes an `agent_id`/`listing_id` was previously unusable
for a natural name reference unless the LLM happened to already have the
ID from pushed context. These two functions close that gap.

## Method: Plain Substring Matching (`ILIKE`), Not Fuzzy/Trigram

Per the "cheapest reliable interpretation method" instruction, and
consistent with the base library's own `structured_filtered_query`
guidance (`ILIKE` is the correct default for short name/title fields on
small-to-medium tables — full-text or trigram search is unnecessary
complexity at this table size), both resolvers use case-insensitive
substring matching:

- `resolveListingByTitle()` queries `properties.title` **or**
  `properties.property_name` directly via Supabase's `.or()` filter —
  both are plain columns on the table itself, so this is a single
  server-side query, capped at 5 results.
- `resolveAgentByName()` fetches up to 200 agent profiles (joined to
  `profiles.full_name`) and filters client-side with a substring check.

## Why Agent Resolution Filters Client-Side Instead of Server-Side

`agent_profiles.profiles.full_name` is a **joined** column (via the
`profiles` relationship), not a direct column on `agent_profiles` itself.
Supabase/PostgREST's embedded-resource filtering syntax for this case is
finicky and depends on exact relationship/foreign-key configuration to
work reliably as a server-side `ilike` filter. Rather than fight that,
this implementation fetches a bounded set (200 rows — comfortably above
this project's actual agent count, per `docs/ADMIN_UI_CURRENT_STATE.md`'s
schema notes) and filters in memory. This is the "cheapest reliable"
choice in practice: simpler code, guaranteed-correct behavior, and
negligible extra data transfer at this table size. If the agent roster
ever grows large enough for this to matter, the fix is either a
database view flattening the join or a dedicated RPC function — not
needed today.

## Output Contract

```ts
type ResolvedEntity<T> =
  | { status: "single"; entity: T }
  | { status: "ambiguous"; candidates: T[] }
  | { status: "none" };
```

- **`single`** — exactly one match. The interpreter proceeds straight to
  building a pending action with this entity's ID.
- **`ambiguous`** — more than one match. The interpreter surfaces the
  candidate names/titles in chat and asks the user to be more specific,
  **without** guessing at the first result. This is a hard rule, not a
  suggestion: silently picking the top match on an ambiguous query is
  exactly the failure mode a resolver exists to prevent.
- **`none`** — zero matches (or an empty query string). The interpreter
  reports "not found" without ever calling the LLM (see
  `docs/copilot/INTENT_MODEL.md` § Failure Modes for why that's a
  deliberate cost/latency decision, not an oversight).

## What Is Resolved vs. What Is Not

Only listings and agents have resolvers today, matching the two entity
types the deterministic intent layer (`docs/copilot/INTENT_MODEL.md`)
actually needs — applications and market insights are referenced by
free-form review notes / content fields respectively, which don't fit the
"name → ID" resolution shape and are left to the existing LLM tool-use
path (step 5), which already has richer context to work with for those
cases.

## Explicitly Deferred: Fuzzy/Trigram Matching

`docs/system/LIBRARY_TO_PROJECT_MAPPING.md` and
`docs/system/MISSING_CAPABILITY_RESEARCH.md` both researched `pg_trgm`
(already installed in this project's database, per
`supabase/migrations/20260219211720_...sql:9`, but unused) as an upgrade
path for typo-tolerant matching — e.g. "Jon Tan" matching "John Tan".
Plain `ILIKE` substring matching, as implemented here, does **not** catch
that case. This is a known, accepted limitation for this pass — "cheapest
reliable method" favors the simpler mechanism until there's evidence
substring matching is insufficient in practice. If typo-tolerance is
needed later, `resolveAgentByName`/`resolveListingByTitle` are the two
functions to upgrade, and the base library's
`base-library/02-admin/search/fuzzy_entity_resolution.md` record (added in
an earlier session) already documents the trigram approach, thresholds,
and its own limitations in detail — no new research needed to make that
upgrade when warranted.

## Security

Both resolvers are pure reads under the calling admin's existing Supabase
session — they inherit the same RLS admin-full-access policies already
covering `properties` and `agent_profiles`/`profiles`
(`docs/ADMIN_UI_CURRENT_STATE.md` §6). No new authorization surface, no
`requireAdmin()` guard needed on the resolvers themselves (reads aren't
gated the way mutations are, consistent with every other read function in
this codebase) — the eventual mutation the resolved ID feeds into still
goes through its own `requireAdmin()` check at execution time, unchanged.

## Testing

`src/components/admin/command/entityResolvers.test.ts` — 10 tests covering:
empty-query handling, single-match resolution (including the
property_name-over-title preference and the title fallback when
property_name is null), ambiguous multi-match results, not-found results,
and a defensive case where an agent row has no linked profile (must not
throw).
