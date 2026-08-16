# Copilot Level 2 Implementation

Implemented 2026-08-17. Level 2: natural language → structured filters →
deterministic query. Unlike Level 1 (`docs/copilot/LEVEL_1_IMPLEMENTATION.md`),
this level explicitly allows the LLM to help extract structured parameters
from richer phrasing — but the query itself is never anything other than
typed application code calling Supabase through a fixed, typed interface.

## Architecture

```
User language
    ↓
 ┌─────────────────────────────┬──────────────────────────────────┐
 │ Fast path (no LLM)          │ LLM structured extraction         │
 │ intentPatterns.ts regex     │ Claude tool_use, ADMIN_TOOLS       │
 │ matches a fully regular      │ admin_query_agents /               │
 │ filter phrasing directly     │ admin_query_listings /             │
 │ (e.g. "show inactive         │ admin_query_applications           │
 │ agents", "N-bedroom under    │ (used when the phrasing is too     │
 │ $X")                         │ irregular for a fixed regex,       │
 │                              │ e.g. combined/unusual filters)     │
 └──────────────┬───────────────┴───────────────┬────────────────┘
                │                                │
                ▼                                ▼
      typed filter object (AgentQueryFilters / ListingQueryFilters / ApplicationQueryFilters)
                │
                ▼
      adminQueries.ts — queryAgents() / queryListings() / queryApplications()
      (permission check → validation → typed Supabase query → pagination/limit → error handling)
                │
                ▼
      Formatted result message, shown directly in chat
      (no confirmation — read-only; never fed back into another model call)
```

**The critical design point, same principle as Level 1**: whichever path
produces the filter object, execution is identical — `adminQueries.ts`'s
three functions are the only code that ever talks to Supabase for these
lookups. The LLM's tool schema (`ADMIN_TOOLS` in
`supabase/functions/aria-chat/tools.ts`) is typed field-by-field
(booleans, enums, numbers) — there is no field for a raw filter string, a
`WHERE` clause, or anything resembling SQL. **The LLM cannot ask for
anything the typed interface doesn't already support**, by construction,
not by convention.

## Files

- `src/components/admin/command/adminQueries.ts` — the deterministic query layer: `queryAgents()`, `queryListings()`, `queryApplications()`.
- `src/components/admin/command/intentPatterns.ts` — extended with the Level 2 fast-path patterns (`QUERY_AGENTS_ACTIVE_PATTERN`, `QUERY_LISTINGS_BEDROOMS_PRICE_PATTERN`, `QUERY_NOT_SUPPORTED_PATTERNS`).
- `src/components/admin/command/interpreter.ts` — extended with `runAgentsActiveQuery()`/`runListingsBedroomsPriceQuery()`, executing immediately and returning a `status: "query_result"` message.
- `supabase/functions/aria-chat/tools.ts` — `admin_query_agents`/`admin_query_listings`/`admin_query_applications` added to `ADMIN_TOOLS`.
- `src/components/admin/command/AdminChatPanel.tsx` — `executeQueryTool()` executes the three query tools immediately (no confirmation) when Claude proposes them, formatting the result as a plain assistant message.

## Typed Query Interfaces

```ts
type AgentQueryFilters = {
  isActive?: boolean; isPublished?: boolean; isFeatured?: boolean;
  agentType?: "internal" | "external"; nameContains?: string;
  limit?: number; offset?: number;
};

type ListingQueryFilters = {
  status?: "active" | "draft"; transactionType?: "sale" | "rental";
  priceMin?: number; priceMax?: number; bedrooms?: number;
  isFeatured?: boolean; titleContains?: string;
  limit?: number; offset?: number;
};

type ApplicationQueryFilters = {
  status?: "pending" | "reviewing" | "interview" | "approved" | "declined";
  dateFrom?: string; dateTo?: string;
  limit?: number; offset?: number;
};
```

Every one of these fields maps to a real, existing column
(cross-checked against `src/integrations/supabase/types.ts` while
building this — see "Expiring" below for what happens when a request
doesn't map to a real column). **This typed contract already caught a
real bug during implementation**: `ListingQueryFilters.transactionType`
was initially written as `"sale" | "rent"` — `tsc --noEmit` rejected it,
because the actual database enum is `"sale" | "rental"`. The type system
caught a mismatch between assumption and schema before it ever shipped,
which is exactly the protection a typed interface is supposed to provide
over a stringly-typed or LLM-generated query.

## Validation

- `queryListings`: rejects `priceMin > priceMax` with a clear error, without ever reaching the database.
- `queryApplications`: rejects `dateFrom > dateTo` the same way.
- All three: `limit` is clamped, never trusted as-is (see Pagination/Limits below).
- `queryAgents`/`resolveAgentByName`'s shared constraint: `is_active` lives on the joined `profiles` table, which isn't reliably filterable server-side via PostgREST's embedded-resource syntax at this schema's relationship configuration — filtered in application code after fetch instead, documented explicitly in the source rather than silently done.

## Permissions

Every one of the three functions calls `requireAdmin()` (from
`src/components/admin/adminGuards.ts`, the same guard used by every
mutating function in `adminOperations.ts`) as its first line, returning
`{ data: [], error: "Forbidden — admin role required.", total: null }`
immediately if the caller isn't an admin — **before** any Supabase call.
This is a deliberate strengthening beyond the original Level 2 design in
`docs/admin/ADMIN_ACTION_CATALOG.md` (which had marked query functions as
not needing a permission check, reasoning that RLS alone was sufficient
for reads) — this task's explicit instruction to "add ... permissions"
took precedence, and the extra check costs nothing while giving a much
clearer failure message than a raw RLS-rejected Postgres error would.

## Pagination and Limits

- `limit`: defaults to 20, hard-capped at 50 (`MAX_LIMIT`) regardless of what's requested — a caller (LLM or deterministic pattern) cannot ask for an unbounded result set.
- `offset`: defaults to 0, negative values ignored.
- Implemented via Supabase's `.range(offset, offset + limit - 1)`, with `{ count: "exact" }` on the `select()` so the total match count is available even though only a page of it is returned — the `total` field on every `QueryResult<T>` is there specifically so a future "load more"/paged UI has what it needs without re-querying, even though the current chat UI only surfaces the first page's results as a summary.

## Audit — Decided Not to Audit Reads, and Why

The task explicitly asks to "add ... audit where appropriate." The
judgment call made here: **plain filtered reads are not logged**,
consistent with the unbroken existing convention across this entire
codebase — `admin_activity_log` (via `logAdminActivity()`) is written by
every single mutating function already in this project, and by zero
read functions (`fetchAdminOverview`, `fetchMarketInsights`, the manual
`Array.filter` list views, and now these three query functions all match
that pattern). Introducing read-auditing for exactly these three functions
would be a new, unprecedented category with no existing model to follow,
and a real noise/volume concern (`admin_activity_log` is designed and
displayed as a change-history feed, not a request log). If read auditing
is ever wanted, it should be a deliberate, project-wide decision covering
every read consistently — not something bolted onto three functions
because they happened to be built this session.

## Error Handling

Every function returns `{ data: [], error: string, total: null }` on
failure — never throws. `adminQueries.test.ts`'s "error handling" test
confirms a raw database error surfaces as a plain string, not an
unhandled rejection. `AdminChatPanel.tsx::executeQueryTool()` and
`interpreter.ts`'s query runners both check `result.error` and format a
plain-language failure message rather than letting an error propagate
into the chat UI unhandled.

## Worked Examples

### "Show me all inactive agents." — fast path, no LLM call

1. `matchIntent()` matches `QUERY_AGENTS_ACTIVE_PATTERN`, returns `{ kind: "query_agents_active", targetValue: false }`.
2. `interpreter.ts::runAgentsActiveQuery(false)` calls `queryAgents({ isActive: false, limit: 20 })` directly.
3. Result is formatted ("Found 2 inactive agents: Mary Lim, Tom Ng.") and shown immediately — no model call, no confirmation.

Verified end-to-end in `interpreter.test.ts`.

### "Show three-bedroom properties below $3M." — fast path, no LLM call

1. `matchIntent()` matches `QUERY_LISTINGS_BEDROOMS_PRICE_PATTERN`, parses `"three"` → `3` and `"$3M"` → `3_000_000`, returns `{ kind: "query_listings_bedrooms_price", bedrooms: 3, priceMax: 3_000_000 }`.
2. `interpreter.ts::runListingsBedroomsPriceQuery(3, 3_000_000)` calls `queryListings({ bedrooms: 3, priceMax: 3_000_000, limit: 20 })`.
3. Result formatted and shown immediately.

Verified end-to-end in `interpreter.test.ts`, including the exact "$3M" phrasing from the task.

**If phrased less regularly** — e.g. "properties with 3 or more bedrooms
under three million with a sea view" — the fast-path regex would not
match (it's deliberately narrow, matching Level 1's "never guess"
philosophy), and the message would fall through to the LLM path: Claude
would call `admin_query_listings` with whatever structured subset it can
confidently extract (`bedrooms`/`priceMax`), `executeQueryTool()` would
execute that against the same `queryListings()` function, and the "sea
view" part — which has no corresponding column — would simply not be
representable in the tool call at all, the same structural protection
described next.

### "Find properties expiring this month." — honest capability boundary, not a fabricated filter

This is the example that most directly demonstrates "do not allow the LLM
to generate unrestricted queries." `properties` has no expiry-related
column anywhere in the schema (confirmed against
`src/integrations/supabase/types.ts` — the only `*_expiry` columns in the
whole database belong to `deals.otp_expiry` and an invite-token table,
neither of which is a listing concept). Two structural facts, not just a
prompt instruction, make this safe:

1. **The fast-path pattern layer intercepts it explicitly.** `QUERY_NOT_SUPPORTED_PATTERNS` matches `/expir/i` and returns a plain, honest message — "Listings don't currently track an expiry date in this system" — without ever reaching the LLM or the database.
2. **Even if it reached the LLM instead, the tool schema has no `expiry` field.** `admin_query_listings`'s `input_schema` only declares `status`/`transactionType`/`priceMin`/`priceMax`/`bedrooms`/`isFeatured`/`titleContains` — Claude cannot populate a field that doesn't exist in the schema it was given. The tool description also says so explicitly ("There is no 'expiry' field — this system does not track listing expiry dates; do not invent one"), as a second layer of defense on top of the schema itself simply not offering the option.

Verified in `interpreter.test.ts` (the fast-path interception, confirming
neither query function is ever called) and `intentPatterns.test.ts` (the
pattern match itself, using the task's exact wording).

## Testing

`src/components/admin/command/adminQueries.test.ts` (13 tests) — permission
enforcement, row mapping, validation rejections, pagination/limit
clamping, and error handling for all three query functions.
`intentPatterns.test.ts` (+8 tests, 18 total) and `interpreter.test.ts`
(+5 tests, 14 total) cover the fast-path matching and execution,
including all three of this task's worked examples verbatim. Full
project suite: 10 files / 71 tests, `tsc --noEmit` clean, `vite build`
clean.
