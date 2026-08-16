# Missing Capability Research

Research pass, 2026-08-16, following the steps in
`AI_copilot_functions_Skills_Knowledge/# MISSING CAPABILITY RESEARCH
PROTOCOL.md`: re-search the project, re-search the base library, then
research the web only for what's still missing. Source: every item marked
**D — Not Found** (or requiring significant new build work) in
`docs/system/LIBRARY_TO_PROJECT_MAPPING.md`. **Nothing is implemented here —
stopping before Step 6/7 of the protocol (project adaptation/implementation)
per this turn's explicit instruction.**

**Scope note on the protocol's Step 4** ("add it to the Base Skills &
Knowledge Library before implementing"): this pass produces the research
records the protocol describes, but does **not** write into
`AI_copilot_functions_Skills_Knowledge/base-library/` itself — that's a
shared resource outside this project's repo, and promoting findings into it
wasn't explicitly requested this turn. Flagging this as a deliberate scope
boundary, not an oversight; doing so is a one-line follow-up if wanted.

## Step 1/2 Re-Verification (before going to the web)

- **Project re-search**: confirmed via `grep` across `src/` and `supabase/`
  for `textSearch|full.text|trigram|pg_trgm|fuzzystrmatch|similarity(` —
  no full-text search, fuzzy matching, or time-bucketed query exists
  anywhere in the codebase today. **One relevant fact found**: the
  `pg_trgm` Postgres extension is **already enabled** in the project's own
  base migration (`supabase/migrations/20260219211720_...sql:9`, `create
  extension if not exists "pg_trgm"`) — installed but currently unused by
  any query. This materially changes the entity-resolution research below:
  no new extension install is required, only new queries against an
  extension already present.
- **Library re-search**: confirmed `03-property/property-search/`,
  `08-system/`, `09-integrations/`, `10-reporting/`, `04-content/` under
  `base-library/` contain **zero files** (directory scaffolding only, no
  content) — this reconfirms, rather than merely repeats,
  `LIBRARY_TO_PROJECT_MAPPING.md`'s D classifications for search, reporting,
  and time-series capabilities.

---

## Research Record 1 — Server-Side Filtered Querying (`queryListings`, `queryAgents`, `queryApplications`)

**Problem**: `AdminListingsPage.tsx` and `AgentsListPage.tsx` currently fetch
a full dataset and filter with `Array.filter` client-side. Neither the
manual UI nor the Copilot has a real server-side, filterable query — this
blocks every Level 2 admin Copilot capability identified in
`docs/copilot/COPILOT_CAPABILITY_MATRIX.md`.

**Recommended solution**: Use Postgres's built-in `ILIKE` for short-field
matching (agent names, listing titles — both well under the length where
full-text search pays off), not `tsvector`/full-text search. Supabase's own
comparison is explicit on this: full text search is recommended for **long**
text fields (>1000 characters, e.g. article bodies); for **short fields**
(<255 characters, e.g. names/titles) on **small datasets** (<1000 rows —
which matches this project's agent/listing counts), plain `ILIKE` needs no
special indexing and is the simpler, correct choice. Numeric/enum filters
(`price_min`/`price_max`, `status`, `is_featured`) are plain `.eq()`/`.gte()`/`.lte()`
chains on the Supabase JS client — no new capability needed for those parts.

**Source**: Supabase official documentation.
**Repository**: N/A (managed Postgres service + open-source client library, `supabase/supabase-js`).
**License**: Apache-2.0 (`supabase-js` client); Postgres itself is PostgreSQL License (permissive, MIT-like).
**Version**: current Supabase JS client already in use by this project (`src/integrations/supabase/client.ts`) — no version bump needed, `.textSearch()`/`.ilike()`/`.eq()` are all present in the already-installed client.
**Dependencies**: none new. If dataset size grows past ~1000 rows per table and `ILIKE` performance degrades, the documented upgrade path is a generated `tsvector` column + GIN index + `.textSearch()` — not needed at current scale.

**Implementation notes**:
- `queryListings`/`queryAgents`/`queryApplications` should be plain Supabase JS client calls (`.select().ilike(...).eq(...).limit(...)`), not new Postgres functions — this keeps them consistent with how every existing `adminOperations.ts` function already talks to Supabase (client-side JS, RLS-scoped), rather than introducing a new RPC-function pattern just for reads.
- Cap `limit` server-side (the JS client passes it straight through to Postgres's `LIMIT`) to bound worst-case query cost, as already specified in `docs/admin/ADMIN_ACTION_CATALOG.md`.
- If Market Insights or listings content ever needs true long-text search (body/description fields), the generated-column + GIN-index pattern documented at `supabase.com/docs/guides/database/full-text-search` is the right escalation — not needed for the current `queryListings`/`queryAgents`/`queryApplications` scope, which filters on short structured fields only.

**Security notes**: These are pure reads under the existing admin RLS
policies (`has_role(auth.uid(),'admin')` full-read access, already
confirmed present on `properties`/`agent_profiles`/`agent_applications` in
`docs/ADMIN_UI_CURRENT_STATE.md` §6) — no new authorization surface, no
`SECURITY DEFINER` function needed (plain client-side queries run as the
calling admin, RLS-scoped automatically).

**Compatibility**: Fully compatible with the existing Supabase JS client and
the project's RLS model — this is the "no adaptation needed for the
dependency, only new call sites" case.

**Tests**: standard integration test — seed known rows, assert filter
combinations return the expected subset; assert `limit` is honored; assert
an admin-scoped call never returns rows an RLS policy would otherwise block
(defense-in-depth check, even though RLS already guarantees this).

**Limitations**: `ILIKE` substring matching is exact-substring, not
typo-tolerant — "Jon Tan" will not match "John Tan". That gap is
deliberately deferred to Research Record 2 (entity resolution), which is a
distinct capability with its own accuracy/tuning requirements, not a
reason to over-build the plain filter functions.

**Reusable components**: `.ilike()`, `.eq()`, `.gte()`/`.lte()`, `.limit()`
— all already part of the Supabase JS client already imported project-wide
(`src/integrations/supabase/client.ts`). No new package.

**Project-specific adaptations**: Field names per the project's actual
schema (`full_name`, `title`, `status`, `price`, `is_featured`, etc., per
`docs/ADMIN_UI_CURRENT_STATE.md` §6) — straightforward mapping, no
translation layer needed.

**Sources**:
- [Full Text Search | Supabase Docs](https://supabase.com/docs/guides/database/full-text-search)
- [Postgres Full Text Search vs the rest](https://supabase.com/blog/postgres-full-text-search-vs-the-rest)
- [Different ways to Search Text in PostgreSQL](https://aiven.io/blog/different-ways-to-search-text-in-postgresql)

---

## Research Record 2 — Entity Resolution / Fuzzy Name Matching (`resolveAgentByName`, `resolveListingByTitle`)

**Problem**: `admin_find_agent`/`admin_find_listing` (per
`docs/copilot/COPILOT_FUNCTION_CATALOG.md`) need to resolve a natural
utterance ("John Tan", "the Brick House") to a concrete row, tolerating
minor spelling variation, without a fully separate search service.

**Recommended solution**: `pg_trgm` (trigram similarity), already installed
in this project's database (see Step 1/2 re-verification above). Trigram
matching breaks a string into overlapping 3-character sequences and scores
similarity by shared-trigram overlap — this is the documented default
starting point for this exact problem: "reach for pg_trgm first, every
time... about 70% of real-world dedup/matching problems do not need
anything more sophisticated" than trigram similarity alone.

**Source**: PostgreSQL official `pg_trgm` extension documentation; corroborating engineering write-ups on production usage patterns.
**Repository**: N/A — `pg_trgm` ships as a standard PostgreSQL contrib extension, already present in this project's Postgres instance.
**License**: PostgreSQL License (permissive).
**Version**: whatever ships with the project's current Supabase-managed Postgres version — already active (`create extension if not exists "pg_trgm"`, confirmed present).
**Dependencies**: none new — the extension is already installed; this is net-new *query* work only, using `similarity(column, query) > threshold` or the `%` operator, optionally backed by a GIN/GiST trigram index (`CREATE INDEX ... USING gin (full_name gin_trgm_ops)`) if the agents/listings tables grow large enough for it to matter (not required at current row counts).

**Implementation notes**:
- Normalize both sides before comparing (lowercase, trim whitespace) — cheap, catches a large share of "different-but-really-the-same" cases before the trigram comparison even runs.
- **Threshold tuning is empirical, not theoretical** — the documented best practice is testing candidate thresholds (Postgres's `pg_trgm.similarity_threshold`, or filtering `similarity() > X` directly in the query) against a small labeled sample of real agent names / listing titles from this project's own data, not picking a number from a blog post.
- For higher precision than trigram alone provides, the documented escalation pattern is: use `pg_trgm` to pull the top ~20 candidates (index-backed, fast), then rescore those 20 with a positional algorithm like Jaro-Winkler (via the `fuzzystrmatch` extension) for final ranking — worth keeping in reserve, not needed for a first version given the project's data volume.
- `resolveAgentByName`/`resolveListingByTitle` should return a single match above a high-confidence threshold, or a short candidate list below it (already specified in `docs/admin/ADMIN_ACTION_CATALOG.md`) — this maps directly onto trigram's native `similarity()` score, no extra logic needed to produce a confidence-ranked candidate list.

**Security notes**: Same as Record 1 — a read-only query under existing
admin RLS, no new authorization surface. No `SECURITY DEFINER` needed.

**Compatibility**: Extension already installed and active in this exact
database — zero migration risk, this is purely new query code.

**Tests**: known-typo test set (e.g. "Jon Tan" → "John Tan", "Brik House" →
"The Brick House") with expected match/no-match outcomes at the chosen
threshold; a test asserting names/titles that are genuinely different don't
false-positive-match.

**Limitations** (documented, worth stating plainly rather than
over-promising): trigram similarity **breaks down** on strings of very
different lengths (a short query against a long title can score poorly even
when it's a legitimate substring — worth combining with a plain `ILIKE`
fallback check, not trigram alone), on abbreviations sharing no characters
with the full form (won't catch "JT" for "John Tan"), and on anything
semantic rather than orthographic (won't know "the Brick House" and "our
Toa Payoh 4-bed" refer to the same listing if the user describes it by
description rather than title). These are acceptable, named limitations for
an admin tool used by staff who typically know roughly-correct names — not a
blocker to building this.

**Reusable components**: `pg_trgm`'s `similarity()` function and `%`
operator, called directly from a Supabase query (`.select().gt('similarity',
threshold)` via a computed column, or more simply via a thin Postgres RPC
function if the JS client can't express a `similarity()` filter directly —
worth confirming JS-client expressiveness during implementation, not
resolved here).

**Project-specific adaptations**: none beyond wiring the two target tables/columns (`profiles.full_name` / `properties.title`).

**Sources**:
- [Entity Resolution in Postgres: Trigrams vs Embeddings](https://concepttocloud.com/news/entity-resolution-in-postgres-trigrams-vs-embeddings)
- [Fuzzy Matching in PostgreSQL: Taming Messy Text With pg_trgm](https://medium.com/@techybob/fuzzy-matching-in-postgresql-taming-messy-text-with-pg-trgm-bc3af9335f2f)
- [Fuzzy text matching with PostgreSQL pg_trgm, fuzzystrmatch extension](https://medium.com/@varun.santhikumar94/fuzzy-text-matching-with-postgresql-pg-trgm-fuzzystrmatch-extension-3cb25c2216b1)

---

## Research Record 3 — Bulk/Batch Operation Execution (`bulkPublishListings`, `bulkResendInvites`, `batchReviewApplications`)

**Problem**: these three functions need to apply a mutation across many rows
atomically-ish (with clear partial-failure reporting), triggered from a
single Copilot-confirmed action — nothing like this exists in the project
today (confirmed absent, `docs/system/MISSING_CAPABILITY_REPORT.md`).

**Recommended solution**: A Postgres function (called via Supabase's
`.rpc()`), accepting a JSONB array of target IDs (or re-deriving the set
server-side from the same filter criteria the confirmation preview used —
per the per-record-scope-reverification requirement already established in
`docs/system/LIBRARY_TO_PROJECT_MAPPING.md` §1.4), wrapped in a single
Postgres transaction so the whole batch either succeeds or the documented
partial-failure result shape is returned. This is the standard, officially
documented pattern for bulk writes through Supabase's REST/RPC layer:
"for operations that span multiple tables or require business logic,
database functions called via RPC are ideal... the entire function [is]
treated as a transaction that rolls back if any operation fails," which
specifically avoids the network/connection-pool overhead of firing one
REST call per row (the naive alternative).

**Source**: Supabase official RPC documentation; Supabase community
engineering guidance on bulk operations.
**Repository**: N/A — uses the already-installed `supabase-js` client's `.rpc()` method against a project-authored Postgres function (no external package).
**License**: Apache-2.0 (`supabase-js`); the function itself is project-authored SQL, not third-party code.
**Version**: current `supabase-js`, already in use.
**Dependencies**: none new.

**Implementation notes**:
- Per `docs/admin/ADMIN_ACTION_CATALOG.md`'s existing spec for these three
  functions: prefer re-deriving the candidate set from `criteria` at
  execution time over accepting a pre-resolved ID list from the client — the
  RPC function should take the same filter shape `queryListings`/`queryAgents`/`queryApplications`
  already accept, not a raw ID array, closing the exact Backpack-sourced
  vulnerability class flagged in `LIBRARY_TO_PROJECT_MAPPING.md` §1.4.
- Return a structured `{ succeeded: [], failed: [{id, error}] }` shape (already specified in the action catalog) rather than an all-or-nothing transaction failure — Postgres supports this via a function that catches per-row errors in a loop (`BEGIN ... EXCEPTION WHEN OTHERS ...` per iteration) inside an outer transaction, rather than one giant transaction that aborts entirely on the first bad row. This is a deliberate deviation from "wrap everything in one transaction" — worth being explicit that "atomic" here means "atomic per decision to run the batch," not "all rows succeed or none do," matching the already-specified partial-failure-tolerant contract.
- `resendAgentInvite`'s non-idempotent, email-sending nature (already flagged in the action catalog) means `bulkResendInvites` must not silently retry on partial failure — the caller needs the per-item result to decide whether to re-run only the failed subset, not the whole batch.

**Security notes**: **Critical finding from this research, not previously
in the project's docs**: a Postgres function called via `.rpc()` can be
declared `SECURITY DEFINER` (runs as the function's *owner*, bypassing the
calling user's RLS policies) or `SECURITY INVOKER` (default; runs as the
calling user, RLS still applies normally). Official Postgres security
guidance is unambiguous: `SECURITY DEFINER` is "almost never" what you want
for general-purpose code, and every `SECURITY DEFINER` function touching an
RLS-protected table needs an explicit audit — it is "the most common way to
accidentally hand out cross-tenant/cross-role access." **These three bulk
functions should be `SECURITY INVOKER` (the default)**, so they still run
under the calling admin's RLS scope exactly like every other action-layer
function in this project — there is no reason identified so far to need
`SECURITY DEFINER` privilege escalation for a bulk publish/resend/review
operation that an admin could already do one-by-one under their own RLS
grant. If a future need for `SECURITY DEFINER` arises here, the
`search_path` must also be explicitly pinned (a documented, real attack
vector: an unqualified operator/function reference inside a `SECURITY
DEFINER` body can resolve to an attacker-planted object in a
writable schema instead of the intended system one).

**Compatibility**: Fully compatible with the project's existing Supabase
setup and RLS model, provided `SECURITY INVOKER` is used as recommended
above.

**Tests**: partial-failure scenario (some rows succeed, one fails — assert
the successful ones commit and the failure is reported, not silently
swallowed or the whole batch rolled back); re-run-safety test for the
idempotent operations (`bulkPublishListings`); a **negative** test asserting
`bulkResendInvites` does *not* silently re-send to already-succeeded
recipients on a retry of a partially-failed batch.

**Limitations**: Postgres per-row exception handling inside a function adds
implementation complexity beyond a naive single-transaction approach — worth
budgeting real engineering time here, not treating this as a copy-paste of
Research Records 1/2.

**Reusable components**: Supabase's `.rpc()` client method (already in use
project-wide via `supabase.functions.invoke` for edge functions — note
`.rpc()` targets a Postgres function directly, a different mechanism from
edge functions, worth not conflating the two during implementation).

**Project-specific adaptations**: the three functions' bodies are entirely
project-specific (target `properties`/`profiles`/`agent_applications`
respectively) — no generic library code applies beyond the pattern itself.

**Sources**:
- [JavaScript: rpc | Supabase Docs](https://supabase.com/docs/reference/javascript/rpc)
- [Bulk Data Operations for Self-Hosted Supabase: A Complete Guide](https://www.supascale.app/blog/bulk-data-operations-for-selfhosted-supabase-a-complete-guid)
- [Abusing SECURITY DEFINER functions in PostgreSQL](https://www.cybertec-postgresql.com/en/abusing-security-definer-functions/)
- [Preventing Privilege Escalation in PostgreSQL Row-Level Security (RLS)](https://hoop.dev/blog/preventing-privilege-escalation-in-postgresql-row-level-security-rls)

---

## Research Record 4 — Time-Bucketed Trend Query (`queryEnquiryTrend`)

**Problem**: `explainEnquiryTrend`/`recommendFeaturedListings` (Level 4
Copilot capabilities per `docs/copilot/COPILOT_FUNCTION_CATALOG.md`) need a
deterministic data source that counts `property_enquiries`/`property_view_logs`
bucketed by day/week — nothing like this exists in the schema or codebase
today (confirmed, `docs/system/MISSING_CAPABILITY_REPORT.md`).

**Recommended solution**: Plain Postgres `date_trunc()`, no extension. This
project does not need TimescaleDB's `time_bucket()` (which supports
arbitrary intervals like "every 5 minutes") — the two required granularities
(day, week) are both natively supported by `date_trunc('day', ...)`/`date_trunc('week', ...)`
directly, which is explicitly documented as sufficient for standard
calendar-aligned bucketing without any extension.

**Source**: PostgreSQL/Neon official `date_trunc()` documentation; corroborating engineering references on time-series bucketing without TimescaleDB.
**Repository**: N/A — built into every Postgres installation, including Supabase-managed instances, no extension to install.
**License**: PostgreSQL License (permissive) — it's core Postgres.
**Version**: any Postgres version this project runs on already supports `date_trunc()` — no version constraint.
**Dependencies**: none.

**Implementation notes**:
- `SELECT date_trunc('day', created_at) AS bucket, count(*) FROM property_enquiries WHERE property_id = $1 AND created_at BETWEEN $2 AND $3 GROUP BY bucket ORDER BY bucket` is the entire core query — a plain Supabase RPC function or even a `.rpc()`-free approach isn't strictly needed if the JS client can express `group by` (it generally cannot directly; a thin SQL function via `.rpc()` is the practical path, consistent with Research Record 3's mechanism).
- **Do not adopt TimescaleDB** for this — it would be a new, heavier dependency (a Postgres extension requiring either a TimescaleDB-enabled Postgres instance or self-hosting, likely unavailable on standard Supabase-managed Postgres without their specific add-on support) to solve a problem `date_trunc()` already solves at this project's actual required granularity (day/week only, not arbitrary intervals). This is a case where reaching for the "more powerful" tool would be over-engineering relative to the stated requirement in `docs/admin/ADMIN_ACTION_CATALOG.md`.
- For custom intervals beyond day/week (not currently required), the documented `date_trunc`-only technique is epoch-based bucketing (`to_timestamp(floor(extract(epoch from ts) / N) * N)` for an N-second bucket) — noted for completeness, not needed for the current spec.

**Security notes**: read-only, same profile as Research Records 1/2 — no
new authorization surface, `SECURITY INVOKER` if implemented as an RPC
function (same reasoning as Record 3).

**Compatibility**: No new dependency, works on any Postgres version, no
Supabase plan/tier restriction (unlike TimescaleDB, which may require a
specific hosting tier or self-managed Postgres).

**Tests**: known date range with known enquiry counts, assert correct
per-bucket counts at both `day` and `week` granularity; boundary test at
week edges (Postgres's `date_trunc('week', ...)` follows ISO 8601,
Monday-start — worth confirming this matches the admin's expectation, a
small but real detail).

**Limitations**: `date_trunc` produces gaps for buckets with zero events (no
row is returned for a day with no enquiries) — if the eventual chart/UI
needs a zero-filled continuous series, that requires a `generate_series()`
left-join against the bucketed counts, a small additional step not covered
by `date_trunc` alone. Worth specifying explicitly when this function is
actually implemented.

**Reusable components**: `date_trunc()` itself — core Postgres, always available.

**Project-specific adaptations**: table/column names (`property_enquiries.created_at`, `property_view_logs`) per this project's actual schema.

**Sources**:
- [Postgres date_trunc() function - Neon Docs](https://neon.com/docs/functions/date_trunc)
- [Simplified Time-Series Analytics Using the time_bucket() Function](https://dzone.com/articles/simplified-time-series-analytics-using-the-time-bu) (used here as a *negative* reference — confirms `time_bucket()`/TimescaleDB is the heavier alternative correctly avoided, per Implementation Notes above)

---

## Research Record 5 — AI-Grounded Recommendation Functions (`recommendFeaturedListings`, `explainEnquiryTrend`)

**Problem**: these are the two genuinely Level 4 (AI-reasoning-required)
capabilities identified in `docs/copilot/COPILOT_FUNCTION_CATALOG.md` — the
risk specific to this category, distinct from Records 1-4, is that an LLM
asked to "recommend" or "explain" without being forced to ground its answer
in the actual query results can hallucinate plausible-sounding but false
specifics (wrong view counts, invented trend causes).

**Recommended solution**: "Agentic context grounding" — force the model to
read from the authoritative data source (the Research Record 1/4 query
functions) immediately before generating its answer, rather than letting it
reason from general knowledge or from a stale/partial context blob. This is
already directionally how this project's existing admin Copilot context
works (`AdminOverview` is built fresh and passed in per-request,
`docs/copilot/EXISTING_COPILOT_INVENTORY.md`) — the two new L4 functions
should follow the identical shape: call the deterministic query function
first, pass its literal result into the prompt, and instruct the model
explicitly that it may only reference figures present in that result.

**Source**: Anthropic official documentation and engineering guidance on reducing hallucination and grounding agentic responses (directly applicable since this project already uses `claude-sonnet-5` via `supabase/functions/aria-chat/`, no new AI provider being introduced).
**Repository**: N/A — a prompting/architecture pattern, not a library or package.
**License**: N/A.
**Version**: N/A (applies to the already-integrated Claude API, no version-specific behavior identified).
**Dependencies**: none new — this reuses the existing `aria-chat` edge function and `streamARIA()` client exactly as they exist today; only the prompt content and the fact that a query function's result is injected as context changes.

**Implementation notes**:
- Documented, directly-applicable techniques from Anthropic's own guidance: give Claude the information it needs rather than asking it to retrieve/infer it (i.e., call `queryListings`/`queryEnquiryTrend` first, then hand the result to the model — never let the model "recall" figures from earlier in the conversation or from the general `AdminOverview` context blob for these two specific functions); explicitly permit the model to say it doesn't know/has insufficient data, rather than a prompt that implicitly pressures it to always produce a confident recommendation.
- For `recommendFeaturedListings`, the grounding source is `queryListings({status: "active"})`'s result (Research Record 1) — the prompt should require the recommendation to cite the specific `view_count`/recency figures actually present in that result, not vague generalities.
- For `explainEnquiryTrend`, the grounding source is `queryEnquiryTrend()`'s bucketed counts (Research Record 4) — same principle: the explanation must be traceable to the actual numbers returned, and the model should be told to flag "the data doesn't show an obvious single cause" as an acceptable, correct answer rather than inventing one.

**Security notes**: No new security surface beyond what's already documented
for the existing Copilot execution model (`docs/copilot/EXISTING_COPILOT_INVENTORY.md`)
— these two functions are explicitly read-only/advisory (per
`docs/copilot/COPILOT_FUNCTION_CATALOG.md`, the recommendation itself never
writes; any resulting action still goes through its own normal confirm
flow). The one item worth carrying forward from
`LIBRARY_TO_PROJECT_MAPPING.md` §6: the library's own placeholder spec for
the equivalent function (`recommend_featured_properties`) marks
`confirmation_required: true` even for the recommendation step itself — this
research doesn't resolve that disagreement, it's flagged again here as
still needing a deliberate decision before implementation, not something
this pass should silently pick a side on.

**Compatibility**: Fully compatible — uses the exact same `claude-sonnet-5` model and `aria-chat` edge function path already in production for every other admin Copilot interaction.

**Tests**: a grounding test — feed the function a known, controlled query
result and assert the model's output only references figures present in
that result (no invented numbers); a "no clear answer" test — feed
`explainEnquiryTrend` a flat/unremarkable trend and assert the model says so
rather than fabricating a cause.

**Limitations**: grounding reduces but does not eliminate hallucination risk
— per Anthropic's own guidance this is a "context and verification problem,"
not something a single prompting technique fully solves; ongoing spot-review
of actual recommendations against actual data is a reasonable operational
practice once this ships, not a one-time implementation task.

**Reusable components**: the existing `streamARIA()` client
(`src/lib/ariaClient.ts`) and `aria-chat` edge function — no new AI
integration code, only new prompt content and new query-function call sites
feeding it.

**Project-specific adaptations**: prompt wording specific to real-estate
listing performance and enquiry-trend framing — domain-specific, not
transferable from generic guidance.

**Sources**:
- [Reduce hallucinations - Claude Platform Docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)
- [What Is Agentic Context Grounding? The Pattern Behind Claude Design and Vertical AI Apps](https://www.mindstudio.ai/blog/agentic-context-grounding-claude-design-patterns)
- [How Anthropic enables self-service data analytics with Claude](https://claude.com/blog/how-anthropic-enables-self-service-data-analytics-with-claude)

---

## Summary

| # | Capability | Recommended approach | New dependency? | Complexity |
|---|---|---|---|---|
| 1 | `queryListings`/`queryAgents`/`queryApplications` | Plain `ILIKE`/`.eq()` via existing Supabase JS client | None | Low |
| 2 | `resolveAgentByName`/`resolveListingByTitle` | `pg_trgm` (already installed, unused) | None | Low–Medium |
| 3 | `bulkPublishListings`/`bulkResendInvites`/`batchReviewApplications` | Postgres RPC function, `SECURITY INVOKER`, per-row error handling in one transaction | None | Medium–High |
| 4 | `queryEnquiryTrend` | Plain `date_trunc()`, explicitly not TimescaleDB | None | Low |
| 5 | `recommendFeaturedListings`/`explainEnquiryTrend` | Agentic context grounding over Records 1/4's outputs, existing `aria-chat` path | None | Medium (prompt design + ongoing verification, not a code dependency) |

**Notable overall finding**: none of the five researched capabilities
require a new package, extension, or external service — every recommended
solution uses infrastructure already present in this project (Postgres
core, an already-installed extension, the existing Supabase client, the
existing Claude integration). The main net-new engineering effort is in
Record 3 (bulk operations, transaction/error-handling design) and Record 5
(prompt design + the discipline of grounding, not new code plumbing).

**Stopping here per this turn's instruction** — no implementation, no
Base Library update. Next natural step, if requested, is Protocol Step 4
(promoting any of these five patterns into
`AI_copilot_functions_Skills_Knowledge/base-library/`) or Protocol Step
6/7 (actual project implementation) — both require separate authorization.
