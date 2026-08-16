# Admin Action / Function Layer — Architecture

Design pass, 2026-08-15. Defines how the admin action layer should be
structured so Manual UI, Copilot, a future API, a future workflow engine, and
future background jobs all call the **same** functions rather than
duplicating business logic per interface. This is a design document —
**nothing here is implemented**. See `docs/admin/ADMIN_ACTION_CATALOG.md` for
the per-function contracts and `docs/copilot/COPILOT_FUNCTION_CATALOG.md` for
the Copilot-specific adapter layer built on top of it.

## 1. Current State (baseline this design extends, not replaces)

`src/components/admin/adminOperations.ts` already implements the correct
pattern for 8 functions: Manual UI and the Copilot's `executeAction()` both
call the exact same exported function (`setListingStatus`, `setAgentActive`,
etc. — see `docs/system/EXISTING_FUNCTION_INVENTORY.md`). This document
generalizes that already-proven pattern to the functions identified as
missing in `docs/copilot/COPILOT_CAPABILITY_MATRIX.md`, and extends it to
cover consumers that don't exist yet (API, Workflow, Background jobs) without
disturbing what already works.

**Decision: keep the action layer where it already lives**
(`src/components/admin/`), split by domain as it grows, rather than
relocating everything to a new `src/lib/actions/` directory. The existing
file is small enough to keep growing, and a same-directory split
(`adminOperations.ts`, `adminQueries.ts`, `adminWorkflows.ts`) is a smaller,
lower-risk move than a repo-wide relocation for no functional benefit.

## 2. Layering

```
┌─────────────────────────────────────────────────────────────────┐
│  CONSUMERS (presentation-only — no business logic)              │
│                                                                   │
│  Manual UI          Copilot            API           Workflow    Background │
│  (button/form   (tool-call args   (request body,  (step config,   Jobs      │
│   → confirm       from LLM →       future —        future —      (future — │
│   dialog)          confirm card)   doesn't exist    doesn't       doesn't   │
│                                     yet)            exist yet)    exist yet)│
└──────────────────────────────┬────────────────────────────────────┘
                                │  same function signature, always
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  ACTION LAYER  (src/components/admin/*.ts — domain-split)       │
│                                                                   │
│  adminOperations.ts   — L1 direct-function mutations (existing) │
│  adminQueries.ts       — L2 read/filter/resolve functions (new)  │
│  adminWorkflows.ts     — L3 multi-step orchestration (new)       │
│                                                                   │
│  Every function: validates input → checks permission →           │
│  performs the Supabase call → logs to admin_activity_log if a    │
│  mutation → returns { data, error }, never throws.                │
└──────────────────────────────┬────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATA LAYER — Supabase Postgres + RLS                            │
│  RLS (`has_role(auth.uid(),'admin')`) is the real security        │
│  boundary regardless of what the action layer checked.            │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Principles

1. **One function, every caller.** No interface gets its own copy of the
   write logic. This is already true for the 8 existing `adminOperations.ts`
   functions and must hold for everything new.
2. **Functions are presentation-agnostic.** They don't know or care whether
   they were called from a button click, a confirmed Copilot tool card, an
   API request, or a workflow step. They take structured input, return
   structured output.
3. **Confirmation is the caller's job, not the function's.** The action
   layer does not prompt. It exposes a `risk` classification (already
   established per-activity in the capability matrix); each consumer decides
   how to gate on that — Manual UI shows a dialog, Copilot shows a
   confirm/dismiss card, a future Workflow engine shows an itemized bulk
   preview, a future background job either skips high-risk actions entirely
   or requires a pre-approved policy. High-risk functions accept an explicit
   `{ confirmed: true }` flag as a lightweight contract-level guard rail —
   omitting it on a High-risk call is itself a validation error, independent
   of whatever UI-level confirmation the caller already did.
4. **Audit is automatic, not opt-in.** Every mutating function calls
   `logAdminActivity()` internally (already true today). Higher-level
   functions (queries, workflows) inherit this for free by calling into the
   L1 functions rather than writing to tables directly.
5. **Errors are returned, never thrown.** `{ data, error: string | null }`
   is the established contract (`adminOperations.ts` today) — every consumer
   handles failure the same way, no interface needs its own try/catch
   translation layer.
6. **Idempotency is explicit, not assumed.** Most "set field to value"
   functions are naturally idempotent (`setListingStatus(id, "active")`
   twice has the same end state). A few are not — `resendAgentInvite` sends
   an email on every call. Each function's contract states this explicitly
   (see catalog) so workflow/retry logic doesn't accidentally double-send.
7. **RLS is the backstop, not the only check.** The action layer performs
   its own permission check (or defers to RLS deliberately) but must not
   assume RLS alone is sufficient UX — a function that lets RLS reject a
   write returns a generic Postgres error unless the layer itself checks
   first and returns a clear `{ error: "Forbidden" }`.

## 4. The Server-Context Problem (blocks Workflow/Background-job consumers)

Every existing action function imports the **browser singleton** Supabase
client (`src/integrations/supabase/client.ts`), which carries the calling
user's session implicitly. This works for Manual UI and Copilot because both
run in the browser as the logged-in admin. It **cannot work as-is** for:

- A future server-side **API** (no browser session to carry).
- A future **Workflow engine**, if it runs server-side (e.g. as an edge
  function) rather than as a client-driven multi-step Copilot conversation.
- A future **background job** (no user session at all — would need a
  service-role client plus its own explicit permission check, since there's
  no admin's JWT for RLS to key off of).

**Design requirement for any function added to this layer**: accept an
optional `client` parameter (a Supabase client instance) that defaults to
the browser singleton if omitted. This is a small signature change
(`function setListingStatus(id, status, client = supabase)`) that costs
nothing for existing Manual UI/Copilot callers (they don't pass it, get the
default) but makes every function usable from a server context that
constructs and injects its own client. This is **not implemented** — it's a
prerequisite noted here so it's not discovered as a blocker later, once a
Workflow engine or background job is actually being built.

## 5. Domain Split

| File (existing/new) | Level | Contents |
|---|---|---|
| `adminOperations.ts` (existing) | L1 | Direct-function mutations: listings, agents, applications, insights, admin-role |
| `adminQueries.ts` (new) | L2 | Filtered reads + entity resolution: `queryAgents`, `queryListings`, `queryApplications`, `resolveAgentByName`, `resolveListingByTitle`, `queryEnquiryTrend` |
| `adminWorkflows.ts` (new) | L3 | Multi-step orchestration built on the above two files: `bulkPublishListings`, `bulkResendInvites`, `batchReviewApplications` |

L4 (AI reasoning) is deliberately **not** part of this layer — it lives in
`docs/copilot/COPILOT_FUNCTION_CATALOG.md` instead, since reasoning over data
returned by L2 queries is a Copilot-specific concern (it calls the LLM), not
a deterministic admin action. The distinction matters: the action layer
must be usable without any AI involved at all (e.g. a future plain REST API
consumer that never touches Claude); L4 functions inherently cannot be.

## 6. Consumer-by-Consumer Notes

- **Manual UI**: calls functions directly from event handlers, same as today. No change required to existing call sites.
- **Copilot**: tool schema → LLM proposes call → confirm card → `executeAction()` invokes the matching action-layer function. See `docs/copilot/COPILOT_FUNCTION_CATALOG.md` for the tool-to-function mapping.
- **API** *(does not exist today)*: if/when a public or internal REST API is added, its route handlers should be thin — parse request, call the action function, serialize the response. No business logic in the route handler itself.
- **Workflow** *(does not exist today)*: an orchestration layer that calls L2 query functions to build a candidate set, then either calls L3 workflow functions directly or drives repeated L1 calls with a bulk-confirmation UI in between. Whether "Workflow" ends up being a Copilot-only conversational pattern or a standalone engine is an open design question, not decided here.
- **Background jobs** *(do not exist today — confirmed absent system-wide, `docs/system/SYSTEM_ARCHITECTURE.md` §5)*: would need the server-context client-injection change (§4) plus a policy for which risk levels a job is allowed to execute unattended. Not scoped further here since no scheduling infrastructure exists yet to run them.

## 7. What This Document Does Not Cover

- The agent-portal action layer (`leadOperations.ts` etc.) already follows an
  equivalent per-domain pattern and is out of scope here — this document is
  admin-only, matching the scope of the three source docs it's derived from.
- Bulk-confirmation UI implementation details (component design) — noted as
  a requirement in `docs/admin/ADMIN_FUNCTION_REQUIREMENTS.md` and referenced
  again in the workflow catalog entries, but not designed here.
