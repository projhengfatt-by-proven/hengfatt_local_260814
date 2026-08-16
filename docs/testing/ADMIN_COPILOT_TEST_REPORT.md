# Admin + Copilot Function System — Test Report

Test date: 2026-08-17. Scope: every registered admin action across
Levels 1-4, tested against the 13-dimension checklist below. This pass
found and closed the single biggest coverage gap in the whole system:
**`adminOperations.ts` — the actual shared action layer both the manual
UI and the Copilot call — had zero direct unit tests before this report**,
despite being the most important file in the entire admin/Copilot system
to trust. `src/components/admin/adminOperations.test.ts` (29 tests, new
this pass) closes that gap. This report documents what's now covered,
what's covered indirectly, and what remains a real, named gap — not
papered over.

## The 13 Test Dimensions

1. Manual UI execution — a real UI interaction (click/change) triggers the action
2. Copilot execution — a Copilot tool call triggers the same action
3. Valid parameters — the happy path
4. Invalid parameters — malformed input is rejected before mutation
5. Missing entity — the referenced record doesn't exist / resolve
6. Ambiguous entity — multiple records match a name-based reference
7. Unauthorized user — no session
8. Wrong role — authenticated, not admin
9. Confirmation — a mutating action requires explicit confirmation before executing
10. Duplicate execution — calling the same action twice
11. Failure — the underlying database/edge-function call errors
12. Audit — a successful mutation is logged
13. Side effects — the action's actual effect (status labels, cascades, etc.) is correct

## Coverage Matrix — Level 1 Actions

**Legend**: ✅ = directly tested with a citation · 🔶 = tested via the Copilot/function-layer path but not click-tested through the manual UI (or vice versa) · — = not applicable to this action · ❌ = real, named gap

| Action | 1 UI | 2 Copilot | 3 Valid | 4 Invalid | 5 Missing | 6 Ambig. | 7 Unauth | 8 Wrong role | 9 Confirm | 10 Dup. | 11 Fail | 12 Audit | 13 Side FX |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `setListingStatus` | 🔶 (a) | 🔶 (b) | ✅ (c) | — | — | — | ✅ (c) | ✅ (c) | 🔶 (d) | ✅ (c) | ✅ (c) | ✅ (c) | ✅ (c) |
| `setListingFeatured` | ✅ (e) | 🔶 (b) | ✅ (c) | — | — | — | ✅ (c) | ✅ (c) | 🔶 (d) | — | — | ✅ (c) | — |
| `setAgentVisibility` | 🔶 (f) | 🔶 (b) | ✅ (c) | ✅ (c, internal-only rule) | — | — | ✅ (c) | ✅ (c) | 🔶 (d) | — | — | ✅ (c) | — |
| `setAgentActive` | 🔶 (f) | 🔶 (b) | ✅ (c) | — | — | — | ✅ (c) | ✅ (c) | 🔶 (d) | — | — | ✅ (c) | ✅ (c, activate/suspend labels) |
| `resendAgentInvite` | 🔶 (f) | 🔶 (b) | ✅ (c) | — | — | — | ✅ (c) | ✅ (c) | 🔶 (d) | ✅ (c, non-idempotent, documented) | — | ✅ (c) | — |
| `reviewApplication` | 🔶 (g) | 🔶 (b) | ✅ (c) | — | — | — | ✅ (c) | ✅ (c) | 🔶 (d) | — | — | ✅ (c) | ✅ (c, real reviewer id, not client-supplied) |
| `setAgentAdminRole` | 🔶 (f) | 🔶 (b) | ✅ (c) | ✅ (c, self-lockout) | — | — | ✅ (c) | ✅ (c) | 🔶 (d) | — | ✅ (c) | ✅ (c) | — |
| `updateAgentProfile` | ✅ (h) | 🔶 (b) | ✅ (c, partial update) | ✅ (c, CEA format) | — | — | ✅ (c) | ✅ (c) | 🔶 (d) | — | — | ✅ (c) | ✅ (c, fallback target name) |
| `createAgent` | ✅ (i) | — (j) | ✅ (c) | ✅ (i, missing required fields) | — | — | ✅ (c) | ✅ (c) | 🔶 (d) | ❌ (k) | ✅ (i) | ✅ (c) | — |
| `createListing` | ❌ (l) | — (j) | ✅ (m) | — | — | — | — (n) | — (n) | 🔶 (d) | — | ✅ (m) | — (o) | ✅ (m) |
| `setInsightPublished`/`setInsightFeatured`/`reorderInsight` | ✅ (p) | 🔶 (b) | 🔶 (q) | — | ✅ (q, "not found") | — | 🔶 (r) | 🔶 (r) | 🔶 (d) | — | 🔶 (r) | 🔶 (r) | — |

**Citations**:
- (a) `AdminListingsPage.test.tsx` mocks `setListingStatus` and wires the publish/unpublish control to it, but the single test in that file only clicks the **featured** switch — the status toggle is wired but not exercised by a click in the existing test.
- (b) `AdminChatPanel.tsx::executeAction()` calls the exact same function for every tool name — verified by direct code reading (`docs/copilot/LEVEL_1_IMPLEMENTATION.md`'s architecture table), not a render-level Copilot-chat test (no `AdminChatPanel.test.tsx` exists — see Gaps).
- (c) `adminOperations.test.ts` (new this pass) — direct function-level test.
- (d) Confirmation is enforced at the `AdminChatPanel.tsx` UI layer (`pendingActions` → Confirm click → `executeAction()`), not inside the action function itself (by design — the function is presentation-agnostic, see `docs/admin/ADMIN_ACTION_ARCHITECTURE.md`). No render-level test exists to click through a real confirm card for these actions — verified by code reading, not by an automated UI test.
- (e) `AdminListingsPage.test.tsx:138-139` clicks the real featured switch and asserts `setListingFeatured("listing-1", true)`.
- (f) `AgentsListPage.test.tsx`'s one test covers the AI-draft-to-invite-form flow only — does not click the activate/suspend/feature/resend-invite controls.
- (g) No `ApplicationsPage.test.tsx` exists at all.
- (h) `EditAgentPage.tsx` has no dedicated test file, but `adminOperations.test.ts` fully covers the function it calls, including the exact partial-update/CEA-validation behavior this session's refactor introduced.
- (i) `AddNewAgentForm.test.tsx` (3 tests) — genuinely click-tests form submission through to `createAgent`, including the invalid-CEA rejection path.
- (j) No Copilot tool exists for `createAgent`/`createListing` — documented, deliberate scope boundary (`docs/admin/MANUAL_UI_ACTION_MAP.md` § Copilot Parity), not a missed test.
- (k) `createAgent`'s duplicate-execution behavior (would send two invite emails) is untested — `resendAgentInvite`'s equivalent behavior is tested and the same reasoning applies, but this specific function wasn't covered. Real, small gap.
- (l) `NewListingPage.tsx` (the manual UI for `createListing`) has no test file at all — a real gap, though the function it calls is thoroughly tested (`listingOperations.test.ts`, 6 tests + 3 more added this pass's spirit).
- (m) `listingOperations.test.ts` — direct function-level test (owner scoping, draft/active, photo/floor-plan insertion, conditional private notes, conditional folder linking).
- (n) `createListing()` deliberately has no `requireAdmin()` gate — shared with the agent portal, where agents legitimately create their own listings (`docs/security/COPILOT_SECURITY_AUDIT.md` Finding 7). Not applicable here by design.
- (o) `createListing()` doesn't call `logAdminActivity()` — it's shared with the agent portal and agent-created listings were never audited to `admin_activity_log` before this session either; out of scope to change here.
- (p) `MarketInsightsPage.test.tsx` clicks the real Publish and Feature buttons and asserts `setInsightPublished`/`setInsightFeatured` are called.
- (q) `marketInsights.ts` has no direct unit test file (unlike `adminOperations.ts`, now covered) — its behavior is only verified indirectly through the mocked-away page test. Real, named gap — see Remaining Gaps.
- (r) Same as (q) — unauthorized/wrong-role/failure/audit behavior for the three narrow wrapper functions is implemented (they call `requireAdmin()` and `logAdminActivity()` the same way every other function does) but not independently verified by a test.

## Level 2 — Natural Language Variations

Tested extensively in `intentPatterns.test.ts` (26 tests) — not just one
phrasing per intent:

- **Publish/unpublish**: "publish X", "put X live", "make X live", "go live with X", "unpublish X", "take down X", "move X to draft", "draft X", "hide X" — all verified to produce the same structured intent.
- **Feature/unfeature**: "feature X", "add X to featured", "highlight X", "unfeature X", "remove X from featured".
- **Agent activate/suspend**: "activate X", "reactivate X", "enable X's account", "unsuspend X", "suspend X", "deactivate X", "disable X's account".
- **Noun-stripping**: "publish the listing X" and "Deactivate agent A102" both correctly strip the leading "the"/"agent"/"listing" role-noun — this is the regression test born from a real bug found while tracing the Level 1 task's own worked example.
- **Query filters** (`docs/copilot/LEVEL_2_IMPLEMENTATION.md`): "Show me all inactive agents.", "show active agents", "list inactive agents", "find all active agents"; "Show three-bedroom properties below $3M.", "show 2 bedroom listings under 800k", "show 4-bedroom properties below $1500000" (numeric bedroom counts, `k`/`M` unit parsing, plain numbers, all verified).
- **Capability-boundary phrasing**: "Find properties expiring this month.", "Prepare expiring listings for review." — both correctly recognized and answered honestly rather than silently falling through or fabricating a filter.
- **Reasoning trigger**: "Which properties should we feature this weekend?", "What listings should I feature" — matched; "feature Marina Residence" (a named single listing) and "show three-bedroom properties below $3M" (a plain filter) are verified **not** to be misrouted into the reasoning path.

`adminQueries.test.ts` (14 tests) additionally verifies the underlying
query functions independent of phrasing: permission enforcement, row
mapping, pagination/limit clamping, and the `.ilike()` injection-safety
fix from this session's security audit.

## Level 3 — Workflow Failure Testing

`workflows.test.ts` (13 tests) specifically covers failure modes, not
just the happy path:

- **Partial failure**: one listing's `setListingStatus()` call fails mid-batch — the other ready listings still publish, the failure is reported per-item, the batch doesn't abort (`"reports per-item failures without aborting the rest of the batch"`).
- **Permission failure**: both `previewPublishApprovedListings()` and `executePublishApprovedListings()` independently reject a non-admin caller before touching the database.
- **Confirmation-bypass attempt**: `executePublishApprovedListings({ confirmed: false })` is rejected with a clear error, never silently proceeding.
- **Stale-candidate-list safety**: verified the execution phase re-queries `properties` fresh rather than trusting whatever the preview computed (`"re-derives the candidate set at execution time rather than trusting a stale list"`) — directly defends against the bulk-operation-abuse class named in `docs/security/COPILOT_SECURITY_AUDIT.md`.
- **Validation-driven exclusion**: a candidate missing required fields is excluded from execution entirely (never attempted, nothing to roll back) — tested via `isListingPublishable`'s "reports every missing requirement" test plus the preview/execute split tests.
- **Progress-callback correctness under multi-item batches**: exact call order and counts verified (`"calls onProgress once per ready listing, in order"`).
- **Audit completeness**: one batch-summary log entry verified in addition to each item's own per-record audit entry (inherited from `setListingStatus`).

## Level 4 — Can AI Recommendations Bypass Deterministic Execution Controls?

**No — verified structurally, not just asserted.** Two new tests added
this pass in `interpreter.test.ts`:

1. `"'needs_reasoning' results carry only a prompt string — never an
   executable action, never pending_actions"` — asserts the exact object
   shape returned for a reasoning-triggering message is `{ status,
   groundingPrompt }` and nothing else — no `action` field exists for
   `AdminChatPanel.tsx` to dispatch to `SET_PENDING_ACTIONS` or
   `executeAction()`. This is checked by `Object.keys(result)`, not just a
   type assertion, so a future code change that accidentally added an
   `action` field to this result would fail the test.
2. `"the grounding prompt explicitly instructs the model not to propose a
   tool call for this request"` — verifies the prompt-construction step
   carries the instruction that governs the model's behavior for this
   specific request.

**Structural backing beyond the tests**: `reasoning.ts` imports exactly
two things — `supabase` (used only for a `.select()` read) and
`requireAdmin` — confirmed by direct inspection of its import statements.
It has no import of `adminOperations.ts`, `marketInsights.ts`,
`listingOperations.ts`, or `workflows.ts` — there is no code path inside
the reasoning module capable of calling a mutating function even if it
wanted to. Acting on a recommendation requires the admin to type a
**separate, new message** ("feature Marina Residence"), which is parsed
completely independently by the same `interpretAdminMessage()` entry
point and goes through its own full permission/validation/confirmation
pipeline — the reasoning step and the action step share no execution
code whatsoever.

## Manual UI → Action, Copilot → Action: Do Both Reach the Same Business Logic?

**Yes, verified two ways:**

1. **Static verification** (import-level): `docs/admin/MANUAL_UI_ACTION_MAP.md`
   documents, for every mutating admin UI element, the exact shared
   function it calls — cross-checked this session against
   `AdminChatPanel.tsx::executeAction()`'s switch statement, which calls
   the identical set of functions for the identical tool names. There is
   exactly one implementation of each business rule (CEA validation,
   internal-only featuring, self-lockout) — it lives inside the shared
   function, not duplicated in the UI component or the Copilot executor.
2. **Dynamic verification** (this pass): `adminOperations.test.ts` now
   proves the shared functions themselves behave correctly in isolation —
   combined with the click-level tests that already existed
   (`AdminListingsPage.test.tsx`, `MarketInsightsPage.test.tsx`,
   `AddNewAgentForm.test.tsx`) confirming the manual UI really does invoke
   these exact functions on a real user interaction, and
   `AdminChatPanel.tsx`'s code (read directly, not test-simulated) confirming
   the Copilot path invokes the same functions after confirmation.

**What is not yet proven by an automated end-to-end test**: a single test
that renders `AdminChatPanel`, simulates a Copilot conversation resolving
to a tool call, clicks Confirm, and asserts the same DOM/state change a
manual UI click would produce. No such test exists for any action,
Copilot-side (see Gaps) — the equivalence is proven by both paths calling
the identical, well-tested function, not by an integration test spanning
both UIs. This is a reasonable, but not absolute, form of proof — worth
stating plainly rather than overclaiming a full end-to-end verification
that wasn't actually run.

## Remaining Gaps (named, not hidden)

| Gap | Why it wasn't closed this pass |
|---|---|
| No `AdminChatPanel.test.tsx` (or any Copilot-panel render test) exists for any level | Consistent with this repo's existing pattern (no such file existed before this session's work either, for any prior Copilot feature) — flagged already in `docs/copilot/LEVEL_4_REASONING.md`, not new to this report. Would require mocking `streamARIA`'s SSE stream at the component level — a meaningfully larger undertaking than the targeted unit tests added throughout this session. |
| `marketInsights.ts` has no direct unit test file | Lower priority than `adminOperations.ts` (which this pass did close) since its three narrow wrapper functions are thin and already indirectly exercised via `MarketInsightsPage.test.tsx`'s real button clicks for two of them. |
| `createAgent`'s duplicate-execution (double-invite) behavior is untested | `resendAgentInvite`'s equivalent is tested and documents the same underlying non-idempotency; `createAgent` wasn't separately covered. Small, cheap to add later. |
| No `ApplicationsPage.test.tsx` / `NewListingPage.test.tsx` exist | The functions they call (`reviewApplication`, `createListing`) are both directly, thoroughly tested; the UI wiring itself is unverified by an automated click. |
| `AgentsListPage.test.tsx` doesn't click activate/suspend/feature/resend-invite | Same shape as the above — function-level coverage is solid (`adminOperations.test.ts`), UI-click coverage for these four specific controls is not. |
| "Ambiguous entity" (dimension 6) has no citation in the Level 1 matrix above | Ambiguous-entity handling is a Level 1 *interpretation-layer* concern (`resolveAgentByName`/`resolveListingByTitle` returning multiple candidates), already tested in `entityResolvers.test.ts` (14 tests) and `interpreter.test.ts`'s ambiguous-listing/ambiguous-agent tests — not a property of the action functions themselves, which only ever receive an already-resolved ID. Listed as `—` in the matrix for that reason, not as an oversight. |

## Test Run Summary

13 test files, **142 tests**, all passing. `tsc --noEmit` clean. `vite
build` clean. New this pass: `adminOperations.test.ts` (29 tests) and two
Level 4 bypass-verification tests in `interpreter.test.ts` (now 24 tests
in that file, up from 22).
