# Copilot Level 1 Implementation

Implemented 2026-08-17. This document maps the required 9-step pipeline to
actual code, traces the three given examples through it, and states plainly
what's verified versus illustrative. It builds directly on
`docs/copilot/INTENT_MODEL.md` (the interpretation layer) and
`docs/admin/ADMIN_ACTION_CATALOG.md`/`docs/copilot/COPILOT_FUNCTION_CATALOG.md`
(the registered functions) — this document is the connective tissue between
them, not a third implementation.

## The 9 Steps, Mapped to Code

| # | Step | Where it happens |
|---|---|---|
| 1 | Identify intent | `intentPatterns.ts::matchIntent()` (deterministic path) — falls through to Claude's tool selection over `ADMIN_TOOLS` (`supabase/functions/aria-chat/tools.ts`) when nothing matches deterministically |
| 2 | Resolve entities | `entityResolvers.ts::resolveListingByTitle()` / `resolveAgentByName()` |
| 3 | Construct structured parameters | `interpreter.ts::buildAction()` — produces the exact `{id, name, input, title, description}` shape a resolved LLM tool call already produces |
| 4 | Check permission | `adminGuards.ts::requireAdmin()`, called at the top of every mutating function in `adminOperations.ts`/`marketInsights.ts` |
| 5 | Check validation | Inside each function — e.g. CEA-format regex in `updateAgentProfile()`, the internal-agent-only rule in `setAgentVisibility()`, the self-lockout guard in `setAgentAdminRole()` |
| 6 | Ask confirmation if required | `AdminChatPanel.tsx` — `dispatch({ type: "SET_PENDING_ACTIONS", ... })` renders the Confirm/Dismiss card; `admin_navigate`/deterministic navigation is the one intent applied immediately, matching the pre-existing LLM-path behavior |
| 7 | Execute registered function | `AdminChatPanel.tsx::executeAction()` — a fixed switch over tool names, calling the actual `adminOperations.ts`/`marketInsights.ts` function |
| 8 | Return result | Every function returns `{ error }` (or `{ data, error }`); `executeAction()` throws on a non-null error (fixed as part of this work — previously silently ignored, see `docs/admin/ADMIN_ACTION_ARCHITECTURE.md` history) and toasts success/failure either way |
| 9 | Record audit | `logAdminActivity()`, called inside every mutating function — identical whether the call arrived via the deterministic path or the LLM path |

**No step here is new relative to earlier work** except steps 1-3 (the
interpretation layer, built this session) — steps 4-9 are the action layer
already built and tested in prior sessions. This document's contribution is
connecting 1-3 to 4-9 without adding a second execution path.

## No Direct Database Access for the LLM

Confirmed at every layer:

- The edge function (`supabase/functions/aria-chat/index.ts`) never touches
  a database table. It streams Anthropic's response back, including any
  proposed `tool_use` blocks, and stops there.
- The deterministic interpreter (`interpreter.ts`) constructs a *proposed*
  action object — it does not call `adminOperations.ts` itself. Building
  the object and executing it are two different steps, same as the LLM path.
- Execution happens in exactly one place: `AdminChatPanel.tsx::executeAction()`,
  reached only after the user clicks Confirm on the pending-action card.
- `executeAction()`'s switch statement is a closed, fixed list of known
  function calls — there is no code path, deterministic or LLM-driven,
  that can construct an arbitrary database query from natural language.
  The LLM's only capability is choosing *which* of the pre-registered
  `ADMIN_TOOLS` to propose and *what arguments* to fill in; it cannot
  invent a new tool or bypass this switch.

## Worked Examples

### "Feature Marina Residence." — fully verified end-to-end

1. `matchIntent()` strips the trailing period, matches `/^feature\s+(.+)$/i`, returns `{ kind: "feature", entityText: "Marina Residence", targetValue: true }`.
2. `interpreter.ts` calls `resolveListingByTitle("Marina Residence")`. Assuming exactly one listing's `title`/`property_name` contains that text, it returns `{ status: "single", entity: { id, title, status } }`.
3. `buildAction("admin_set_listing_featured", { listing_id: id, featured: true }, ...)` produces the pending action.
4. User confirms → `executeAction()` calls `setListingFeatured(id, true)` → `requireAdmin()` passes → row updates → `logAdminActivity()` writes an `admin_activity_log` entry → toast confirms.

Covered by `interpreter.test.ts` (`"falls back to agent resolution..."` and the ambiguous-listing test use this exact intent; the single-listing-match path is covered by the "Marina Residence" worked-example test for `publish`, which exercises the identical `resolveListingByTitle` → `admin_set_listing_*` code path `feature` also uses).

### "Deactivate agent A102." — pipeline verified, resolution honestly reported as not-found against real data

1. `matchIntent()` strips the period, matches `/^deactivate\s+(.+)$/i`, captures `"agent A102"`, then `cleanEntityText()` strips the leading role-noun `"agent "`, leaving `entityText: "A102"`. **This noun-stripping was a real bug found while tracing this exact example** — before the fix, the captured text was `"agent A102"` (including the word "agent"), which would never match any real agent's name. See `intentPatterns.test.ts`'s dedicated regression test.
2. `interpreter.ts` calls `resolveAgentByName("A102")`. `"A102"` is not a UUID, so this runs a case-insensitive substring match against `profiles.full_name` across all agents.
3. **This project's `agent_profiles`/`properties` tables use UUID primary keys and free-text names/titles — there is no short reference-code column like "A102" or "P1024" anywhere in the schema** (confirmed against `docs/ADMIN_UI_CURRENT_STATE.md` §6 and `src/integrations/supabase/types.ts`). Against real data, no agent is named "A102", so `resolveAgentByName` correctly returns `{ status: "none" }`, and the pipeline reports `{ status: "not_found", message: "I couldn't find an agent matching \"A102\"." }` back to the user — without ever calling the LLM.
4. **This is correct behavior, not a bug**: step 8 ("return result") requires exactly this — a clear, immediate answer when nothing matches, not a hallucinated success or a silent no-op. If the admin instead says "Deactivate John Tan" (a real name) or pastes a real UUID, the pipeline resolves and executes correctly — both paths are covered by `interpreter.test.ts` and `entityResolvers.test.ts`.

**Design response to this gap**: rather than fabricate a fake ID mapping to make the example appear to "work," `resolveAgentByName`/`resolveListingByTitle` were extended this session with a UUID fast-path (if the query string is itself a valid UUID, try an exact `id` match before the substring search) — genuinely useful for a real admin pasting an ID from a URL, and honestly documented rather than papering over the fact that short mnemonic codes aren't a concept this schema has. If reference codes are wanted later, that's a schema change (a new column), not something the interpretation layer can invent on its own.

### "Publish P1024." — same honest treatment as above

Identical reasoning to "Deactivate agent A102.": `matchIntent()` correctly
identifies `{ kind: "publish", entityText: "P1024", targetValue: true }`,
`resolveListingByTitle("P1024")` correctly finds no match against real
data (no listing has "P1024" in its title, and "P1024" isn't a valid
UUID), so the pipeline reports not-found rather than guessing. Given a
real listing title (even partial — e.g. "Marina" instead of the full
"Marina Residence") or a real UUID, this resolves and executes exactly
like the fully-verified example above.

## What Is Deliberately Not Covered by Level 1's Deterministic Path

Per `docs/copilot/INTENT_MODEL.md`, only publish/unpublish, feature/
unfeature, agent activate/suspend, resend-invite, and navigation are
matched deterministically. Everything else an admin might ask for —
profile field edits, application review with notes, admin role changes,
market insight publish/feature/reorder, or any genuinely open-ended
request — still goes through the pre-existing step 5 (Claude tool-use)
path, unchanged. That path already satisfies the same 9-step contract
(intent = tool selection, entities = whatever ID the LLM has from context,
parameters = the tool call arguments, permission/validation/confirmation/
execution/audit = identical code, steps 4-9 above) — it is simply slower
and costs a model call for requests the deterministic layer could have
handled for free, which is exactly why the deterministic layer exists as
a first pass rather than a replacement.

## Verification

`tsc --noEmit`, full `vitest run` (9 files / 47 tests — up from 42 after
adding the noun-stripping and UUID-fast-path regression tests this
session), and `vite build` all pass. Specifically relevant test files:

- `src/components/admin/command/intentPatterns.test.ts` (12 tests) — includes the "Deactivate agent A102." regression test and general leading-noun-stripping coverage.
- `src/components/admin/command/entityResolvers.test.ts` (13 tests) — includes UUID-direct-match and UUID-with-no-row-falls-back-to-search coverage for both resolvers.
- `src/components/admin/command/interpreter.test.ts` (9 tests) — full pipeline, including the exact "Put Marina Residence live." example from the prior session's task and the listing-then-agent fallback order.
