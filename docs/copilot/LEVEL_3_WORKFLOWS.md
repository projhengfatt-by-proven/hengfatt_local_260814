# Copilot Level 3 Workflows

Implemented 2026-08-17. Level 3: a workflow coordinates several
already-registered, individually-deterministic functions in sequence. The
LLM (or the deterministic fast-path pattern layer) may select *which*
workflow to run and, in principle, help fill in its parameters — but every
step inside the workflow is fixed application code, not something the LLM
constructs at runtime.

## The Two Worked Examples: One Built, One Honestly Rejected

This task's two example workflows have very different footing against
this project's actual schema, and this implementation treats that
difference transparently rather than papering over it.

### "Publish all approved properties that are ready." — fully implemented

Real columns back every step: `properties.approval_status`,
`properties.status`, and a well-defined "ready" bar (required fields +
at least one photo, mirroring the same standard already enforced in
`NewListingPage.tsx` at creation time). See `src/components/admin/command/workflows.ts`.

### "Prepare expiring listings for review." — not implemented, honestly

`properties` has no expiry-related column anywhere in the schema (the
same finding already made for the Level 2 "Find properties expiring this
month" example — confirmed again against `src/integrations/supabase/types.ts`).
There is nothing to "find" for this workflow's first step,
`find_expiring_properties()`, because expiring listings aren't a concept
this database currently supports. Rather than build a workflow around a
fabricated filter, `matchIntent()` intercepts this phrasing
(`WORKFLOW_NOT_SUPPORTED_PATTERNS`) and returns an honest explanation —
"There's no expiry date tracked on listings in this system... this
workflow would need a schema change." If listing expiry is added to the
schema later, this workflow becomes buildable using the exact same
pattern as the one that *is* implemented below — nothing about this
implementation would need to change, only a new find-function and a new
pattern/tool entry.

## Workflow Definition

`src/components/admin/command/workflows.ts` defines the one implemented
workflow (`publish_approved_listings`) as a fixed sequence of typed
function calls, not as data or a config the LLM can shape:

```
findApprovedDraftListingsWithPublishability()   (query: approval_status='approved' AND status='draft')
    ↓
isListingPublishable(row, photoCount)            (pure validator — per-candidate)
    ↓ split into ready / notReady
setListingStatus(id, "active")                    (existing, already-registered function — reused, not duplicated)
    ↓
[update_search_index — explicit no-op, see below]
    ↓
logAdminActivity(...)                             (existing, reused — one summary entry)
```

This maps directly onto the task's own example shape
(`find_approved_properties → validate_publishable → publish_property →
update_search_index → audit`), with one deliberate, documented deviation:
**`update_search_index()` is a documented no-op.** This project has no
search-indexing infrastructure at all (`search_properties` remains
`PLANNED` in the base library's own function inventory, confirmed absent
in `docs/system/MISSING_CAPABILITY_REPORT.md`). Rather than fabricate a
fake indexing call that does nothing while pretending to, the code
comment and the result message both say so explicitly — every published
listing's result includes `"search index update skipped — no indexing
infrastructure configured"`. If search indexing is added later, that's
exactly one new step to insert into this same sequence.

## Two-Phase Shape: Preview, Then Execute

- **`previewPublishApprovedListings()`** — read-only. Runs the find +
  validate steps and returns `{ ready, notReady }` with reasons for every
  excluded candidate. This is what powers the confirmation card's
  description.
- **`executePublishApprovedListings({ confirmed: true, onProgress? })`** —
  **re-derives the candidate set from scratch** rather than trusting the
  list the preview showed. This is not a stylistic choice — it's the same
  safety rule already established in
  `docs/system/LIBRARY_TO_PROJECT_MAPPING.md` §1.4 (the Backpack reorder
  finding: a bulk operation that trusts a client-supplied/stale ID list
  instead of re-verifying scope at execution time is a real vulnerability
  class). Between the preview and the confirm click, a listing could have
  been edited, unapproved, or published by someone else — re-running find
  + validate at execution time is what keeps the eventual publish action
  correct regardless of what changed in between.

## Workflow Validation

`isListingPublishable()` is a pure function (`(row, photoCount) => { ok,
reasons }`) — no I/O, fully unit-testable, checked in
`workflows.test.ts` for both the fully-ready case and the "report every
missing requirement, not just the first" case. Every excluded listing's
`reasons` array is shown to the admin, not just a bare exclusion — the
same "why can't this be published" transparency `publish_property.md`'s
"a publishable check should be a standalone pure function... so the UI
can show why" already recommended.

## Permissions

Both `previewPublishApprovedListings()` and `executePublishApprovedListings()`
call `requireAdmin()` as their first line — the same guard used
everywhere else in this codebase. `executePublishApprovedListings()` also
enforces `confirmed !== true` as a hard rejection independent of whatever
UI-level confirmation already happened, matching the contract-level guard
already established for `docs/admin/ADMIN_ACTION_CATALOG.md`'s High-risk
functions.

## Confirmation

The deterministic fast-path (`"Publish all approved properties that are
ready."`) builds a **fully previewed** confirmation card — the pending
action's description already lists which listings will publish and which
will be skipped and why, computed by calling `previewPublishApprovedListings()`
before the card is even shown. The LLM tool-use path
(`admin_workflow_publish_approved_listings` in `ADMIN_TOOLS`) uses a
generic description instead ("This will publish every approved listing
that passes the readiness checks... you'll see exactly which ones after
confirming") — **a deliberate, documented asymmetry**: giving the LLM
path the same rich preview would require a second network round-trip
between tool-call and confirmation-card-render that this session's scope
didn't extend to. The full per-item breakdown is still shown to the
admin either way — on the fast path, before confirming; on the LLM path,
in the result summary immediately after. Both paths still require an
explicit Confirm click before anything is published — this asymmetry is
about *how much detail is visible before* confirming, not about whether
confirmation is required.

## Progress

`executePublishApprovedListings()` accepts an optional `onProgress(done,
total)` callback, invoked once per candidate as the batch works through
`ready` sequentially. `AdminChatPanel.tsx::executeWorkflowAction()` wires
this to `UPSERT_ASSISTANT`, replacing a single chat message's content in
place ("Publishing 2 of 5...") as the workflow runs, rather than leaving
the admin looking at a static "thinking" indicator for a multi-item batch.
Verified in `workflows.test.ts` ("calls onProgress once per ready
listing, in order").

## Failure Handling

Per-item, not all-or-nothing: `executePublishApprovedListings()` continues
processing the remaining candidates if one `setListingStatus()` call
fails, collecting failures into a `failed` array rather than aborting the
batch. This matches the partial-failure-tolerant design already
established for bulk operations in
`base-library/02-admin/bulk-actions/bulk_operation_execution.md` — a
transient failure on one listing shouldn't block N-1 other legitimate
publishes. Verified in `workflows.test.ts` ("reports per-item failures
without aborting the rest of the batch").

## Rollback — Where It's Actually Needed, and Where It Isn't

**No listing is ever mutated unless it already passed validation.**
`isListingPublishable()` runs *before* any write — a candidate that fails
validation is excluded from the `ready` list entirely and never reaches
`setListingStatus()`. This means there is nothing to roll back for the
excluded candidates: they were never attempted, not attempted-then-undone.
This is the strongest, cheapest form of "rollback" — prevention instead
of reversal.

For the candidates that *are* attempted: **true transactional rollback
(status change + audit entry as one atomic unit) is not implemented**,
consistent with an already-documented, pre-existing limitation —
`docs/system/LIBRARY_TO_PROJECT_MAPPING.md` §2 already flagged that
`setListingStatus()` performs its update and its audit-log write as two
separate calls, not one database transaction, and that gap is inherited
here unchanged (this workflow calls the same, already-registered
function rather than duplicating its logic with a "fixed" version, per
this task's explicit instruction that individual operations must remain
the same deterministic functions). In practice this is low-risk for this
specific operation — a `status` column update is what it is; if the
audit-log write fails after a successful status change, the listing is
still validly published, just under-logged for that one item, which the
batch-summary audit entry (see below) still captures in aggregate. Full
per-item transactional guarantees are a reasonable future improvement to
`setListingStatus()` itself, not something this workflow can add on top
without modifying that function.

## Audit

Two layers, matching the pattern already established for bulk operations:

1. **Per-item**: `setListingStatus()` already calls `logAdminActivity()`
   internally for every successful publish — inherited automatically,
   not duplicated.
2. **Batch summary**: `executePublishApprovedListings()` additionally
   writes one `"Bulk publish: approved listings workflow"` entry with
   `{ succeeded, failed, skipped }` counts — the same "per-item entries +
   one summary entry for the batch" shape documented in
   `base-library/02-admin/bulk-actions/bulk_operation_execution.md`.
   Verified in `workflows.test.ts`.

## Testing

`src/components/admin/command/workflows.test.ts` (13 tests) —
`isListingPublishable`'s validation logic, permission enforcement on both
phases, the re-derive-at-execution-time behavior, partial-failure
handling, progress callback ordering, and the batch-summary audit entry.
`intentPatterns.test.ts` (+4 tests, 22 total) and `interpreter.test.ts`
(+5 tests, 19 total) cover both worked examples verbatim, including the
"nothing to publish" and "candidates exist but none are ready" query-result
paths. Full project suite: 11 files / 93 tests, `tsc --noEmit` clean,
`vite build` clean.

## What Would Need Deploying

Same as every prior Copilot-layer change this session: the new
`admin_workflow_publish_approved_listings` tool added to
`supabase/functions/aria-chat/tools.ts` requires `supabase functions
deploy aria-chat` to reach the LLM tool-use path — not run automatically.
The deterministic fast-path (`"Publish all approved properties that are
ready."` matched directly by `intentPatterns.ts`) works immediately on
the next client deploy, with no edge-function dependency at all.
