# Intent Model

Implemented 2026-08-17. This document describes the deterministic
interpretation layer that sits in front of the existing LLM tool-use path
for the admin Copilot — `src/components/admin/command/intentPatterns.ts`,
`entityResolvers.ts`, and `interpreter.ts`, wired into `AdminChatPanel.tsx`'s
`sendMessage()`.

## Architecture

```
User language
    ↓
[1] Exact command       (intentPatterns.ts — EXACT_SCREEN_COMMANDS)
    ↓ (no match)
[2] Alias / synonym      (intentPatterns.ts — pattern lists per verb)
[3] Pattern matching     (intentPatterns.ts — regex capture of entity text)
    ↓ (matched a verb, have raw entity text or none needed)
[4] Entity resolution    (entityResolvers.ts — DB lookup by name/title)
    ↓ (resolved to exactly one row, or no entity was needed)
Function                 (the exact same adminOperations.ts / marketInsights.ts
                           function the LLM tool-use path already calls)
    ↓
Permission                (requireAdmin(), inside the function — unchanged)
Validation                (inside the function — unchanged)
Confirmation               (same pendingActions UI — unchanged)
Execution                  (same executeAction() switch — unchanged)
    ↓ (steps 1-4 found no match at all)
[5] Structured LLM extraction   (existing streamARIA + ADMIN_TOOLS — unchanged)
[6] AI reasoning                 (not implemented — see docs/copilot/COPILOT_CAPABILITY_MATRIX.md)
```

**The critical design point**: steps 1-4 do not introduce a new execution
path. `interpretAdminMessage()` produces an `AdminPendingAction` — the
identical `{id, name, input, title, description}` shape a resolved LLM
tool call already produces — so it flows into the exact same
`SET_PENDING_ACTIONS` → confirm → `executeAction()` pipeline already built
for the LLM path. `executeAction()` required **zero new code** to support
the deterministic path; it cannot tell the difference between an action
that arrived via regex match and one that arrived via Claude, because
there is no difference once a `AdminPendingAction` object exists. This is
what satisfies "the final execution must always call a registered project
function" — there is exactly one execution path, with two front doors.

## Priority Order (implemented exactly as specified)

1. **Exact command** — a fixed lowercase string → screen map
   (`EXACT_SCREEN_COMMANDS` in `intentPatterns.ts`). Zero ambiguity, zero
   cost. Covers "dashboard", "listings", "agents", etc.
2. **Alias/synonym** — multiple phrasings mapped to the same verb category
   (e.g. "publish", "make live", "put live", "go live" all mean the same
   thing). Implemented as parallel regex lists per verb, checked in a fixed
   order.
3. **Pattern matching** — regex capture groups extract the raw entity text
   from the matched phrase (e.g. `/^publish\s+(.+)$/i` captures "Marina
   Residence" from "publish Marina Residence"). Steps 2 and 3 are
   implemented together in `intentPatterns.ts` since they share the same
   regex-list mechanism — the distinction is conceptual (alias = which verb
   phrasing, pattern = how the entity text is extracted), not a separate
   code path.
4. **Entity resolution** — `resolveListingByTitle()`/`resolveAgentByName()`
   turn the captured text into a real row ID via a database query. See
   `docs/copilot/ENTITY_RESOLUTION.md` for the full design of this step.
5. **Structured LLM extraction** — the pre-existing `streamARIA()` +
   `ADMIN_TOOLS` tool-use flow. Unchanged. Reached only when
   `interpretAdminMessage()` returns `{ status: "unmatched" }` — meaning
   none of steps 1-4 produced a confident result.
6. **AI reasoning** — genuinely open-ended requests ("which applications
   need attention", "summarise the dashboard") are handled by the existing
   free-form conversational path (no tool call, just a grounded answer) —
   this is a `status: "unmatched"` outcome that falls through to step 5,
   which already handles this correctly today. No new Level 4 code was
   written, per this task's explicit instruction not to build Level 4 yet.

## Intents Covered (deliberately narrow)

| Intent | Verb category | Entity type | Function called |
|---|---|---|---|
| Navigate | exact command | none | `navigateTo(screen)` (client-side only, no DB) |
| Publish/unpublish listing | `publish` (ambiguous, see below) | listing | `admin_set_listing_status` → `setListingStatus()` |
| Publish/unpublish agent (Team page) | `publish` (ambiguous, see below) | agent | `admin_set_agent_visibility` → `setAgentVisibility()` |
| Feature/unfeature listing | `feature` (ambiguous, see below) | listing | `admin_set_listing_featured` → `setListingFeatured()` |
| Feature/unfeature agent (homepage) | `feature` (ambiguous, see below) | agent | `admin_set_agent_visibility` → `setAgentVisibility()` |
| Activate/suspend agent | `agent_active` (unambiguous) | agent | `admin_set_agent_active` → `setAgentActive()` |
| Resend invite | `resend_invite` (unambiguous, entity is a bare email, no DB lookup needed) | none | `admin_resend_agent_invite` → `resendAgentInvite()` |

**Deliberately not covered** (left entirely to step 5, the existing LLM
path): agent profile field edits (`admin_update_agent_profile`), admin
role grant/revoke (`admin_set_agent_role`), application review
(`admin_review_application`), and market insight publish/feature/reorder.
Reasoning: these either require free-form field extraction (profile edits,
review notes) that a fixed regex can't safely capture, or are high-risk
enough (admin role changes) that routing them through an LLM's more
careful, context-aware tool-use flow is preferable to a brittle pattern
match. Adding these later is possible but was not attempted here — this
model prioritizes correctness over coverage.

## Known Ambiguity: "publish" and "feature" Can Mean Listing or Agent

Both verbs apply to two different entity types in this admin portal
(listings have publish/feature; agents have publish-to-Team-page/feature-
on-homepage). The pattern-matching stage (steps 2/3) cannot know which
type the user means from the verb alone — resolution happens at step 4:

1. Try `resolveListingByTitle(entityText)` first.
2. If no listing matches, try `resolveAgentByName(entityText)`.
3. If neither matches, return `not_found`.
4. If either resolves to multiple candidates, return `ambiguous`
   immediately — the *other* entity type is never checked once one type
   produces ambiguous results (e.g. if "Marina Residence" matches two
   listings, agents are never queried, even if there's also exactly one
   agent named "Marina Residence" — extremely unlikely in practice, but a
   real, documented limitation of the fixed try-order).

**Listings are tried first** because "publish"/"feature" a listing is the
far more common admin action in a real-estate portal than publishing/
featuring an agent profile. This is a deliberate default, not a neutral
choice — if a project's usage pattern skewed the other way, the order
should be reconsidered. `agent_active` (activate/suspend) has no such
ambiguity, since listings have no equivalent "activate an account" concept
— that intent always resolves against agents only.

## Why Not Skip Straight to the LLM for Everything

The existing system already handles all of these requests correctly via
`streamARIA()` + Claude's tool use. This layer exists purely for the
"cheapest reliable method" requirement: an exact command or a clear
"publish X" phrasing needs no model call at all — it's a regex match plus
one bounded database query, both close to instant and free, versus a
network round-trip to Anthropic for something that was never ambiguous in
the first place. The LLM remains the correct tool for anything genuinely
open-ended; this layer only intercepts the subset of requests that don't
need it.

## Failure Modes and Their Handling

- **No pattern matches at all** → `{ status: "unmatched" }` → falls through
  to the LLM. This is the safe default: the interpreter never blocks a
  request it can't confidently handle.
- **Pattern matches, entity resolves to zero rows** → `{ status: "not_found" }`
  → a plain-language message is shown directly in chat, **no LLM call is
  made**. This is a deliberate cost/latency optimization: if the
  deterministic layer already knows with certainty that no listing or
  agent matches the given name, asking the LLM to figure that out too
  would just be a slower, more expensive way to reach the same answer.
- **Pattern matches, entity resolves to multiple rows** → `{ status: "ambiguous" }`
  → candidate names are listed in chat, asking the user to be more
  specific. Same no-LLM-call reasoning as above.
- **Pattern matches, entity resolves to exactly one row** → `{ status: "resolved" }`
  → a pending action card appears, identical in every way to one the LLM
  would have produced. The user still explicitly confirms before anything
  executes — this layer does not weaken the confirmation requirement.

## Testing

`src/components/admin/command/intentPatterns.test.ts` (10 tests),
`entityResolvers.test.ts` (10 tests), `interpreter.test.ts` (9 tests) — 29
tests total, covering: the task's own worked example end-to-end, every
alias/pattern variant, the listing-then-agent fallback order, ambiguous
and not-found outcomes, and confirmation that entity resolution is never
called for intents that don't need it (navigate, resend-invite).
