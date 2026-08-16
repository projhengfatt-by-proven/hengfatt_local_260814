# Manual UI → Action Layer Map

Written 2026-08-17, after auditing and refactoring every admin UI mutation
to go through the shared action layer (`src/components/admin/adminOperations.ts`,
`src/lib/marketInsights.ts`, `src/lib/listingOperations.ts`). Every mutating
button/form in the admin portal now calls one of these functions — no
admin UI component performs an inline `.insert()`/`.update()`/`.delete()`
or an inline `supabase.functions.invoke()` for a write. Read-only pages
(`AdminDashboard.tsx`, `ReportsPage.tsx`, `ActivityLogPage.tsx`,
`SettingsPage.tsx`, `AdminInsightDetailPage.tsx`, `AdminCopilotPage.tsx`)
are excluded — they perform no mutations.

## Listings — `AdminListingsPage.tsx`

| Manual UI element | Action | Source |
|---|---|---|
| Publish / Unpublish toggle | `setListingStatus(id, status)` | `adminOperations.ts` |
| Feature / Unfeature toggle | `setListingFeatured(id, value)` | `adminOperations.ts` |

## Listings — Create flow (`src/pages/portal/NewListingPage.tsx`, mounted at `/admin/listings/new`)

| Manual UI element | Action | Source |
|---|---|---|
| "Publish Listing" / "Save as Draft" (final step) | `createListing({ ownerId, createdByUserId, isDraft, fields, photos, floorPlans, linkFolderName })` | `src/lib/listingOperations.ts` *(new this session)* |

**Refactor note**: this component was previously performing 5 separate
inline mutations directly in `handleSave` (`properties` insert,
`property_images` insert loop, `property_floor_plans` insert loop,
`property_private_notes` insert, `agent_files` update for folder linking) —
found during this session's audit. All five now live in one function in
`createListing()`. This component is **shared with the agent portal**
(`/portal/agent/listings/new` uses the identical component) — the action
lives in `src/lib/listingOperations.ts` rather than `adminOperations.ts`
specifically because it is not admin-exclusive logic; creating a listing is
the same operation regardless of which portal the caller is in. The
Storage-upload step (turning a picked `File` into a public URL) remains in
the component — that's file I/O, not a business decision, and moving it
into the action layer would have required changing the existing
upload-path-depends-on-created-property-id sequencing, which this refactor
deliberately preserved unchanged to avoid destabilizing a flow with no
prior test coverage.

## Agents — `AgentsListPage.tsx`

| Manual UI element | Action | Source |
|---|---|---|
| Publish / Unpublish (Team page) toggle | `setAgentVisibility(agentId, { is_published })` | `adminOperations.ts` |
| Feature / Unfeature (homepage) toggle | `setAgentVisibility(agentId, { is_featured })` | `adminOperations.ts` |
| Activate / Suspend toggle | `setAgentActive(agentId, isActive)` | `adminOperations.ts` |
| Resend Invite button | `resendAgentInvite(email)` | `adminOperations.ts` |
| Grant / Revoke Admin role toggle | `setAgentAdminRole(agentId, enabled)` | `adminOperations.ts` (self-lockout guard added this session) |

## Agents — Create flow (`src/components/admin/AddNewAgentForm.tsx`)

| Manual UI element | Action | Source |
|---|---|---|
| "Create Agent & Send Invite" submit | `createAgent(input)` | `adminOperations.ts` *(new this session)* |

**Refactor note**: previously called `supabase.functions.invoke("send-agent-invite")`
directly inline — found during this session's audit. Also closes a real
gap: agent creation was the **only** admin mutation with no
`admin_activity_log` entry; `createAgent()` now logs "Agent invited" like
every other admin action.

## Agents — Field-level edit (`src/pages/admin/EditAgentPage.tsx`)

| Manual UI element | Action | Source |
|---|---|---|
| "Save Changes" (profile fields, publish/feature flags) | `updateAgentProfile(agentId, profileUpdate, agentUpdate)` | `adminOperations.ts` |

*(Already migrated in an earlier session — listed here for completeness of the map, not new this pass.)*

## Applications — `ApplicationsPage.tsx`

| Manual UI element | Action | Source |
|---|---|---|
| Approve / Decline / Interview / Reviewing status change | `reviewApplication(id, status, notes)` | `adminOperations.ts` |

## Market Insights — `MarketInsightsPage.tsx`

| Manual UI element | Action | Source |
|---|---|---|
| Create / full-form Save | `saveMarketInsight(id, form)` | `marketInsights.ts` |
| Publish / Move to draft toggle | `setInsightPublished(id, published)` | `marketInsights.ts` (narrow wrapper, new this session) |
| Feature / Unfeature toggle | `setInsightFeatured(id, featured)` | `marketInsights.ts` (narrow wrapper, new this session) |
| Reorder (display order) | `reorderInsight(id, displayOrder)` | `marketInsights.ts` (narrow wrapper, new this session) |

**Refactor note**: the three toggle handlers previously duplicated a
`{ ...marketInsightToForm(item), <field> }` spread-and-save pattern inline
in the page component. They now call these narrow functions instead — the
same functions the admin Copilot's new `admin_set_insight_published`/
`admin_set_insight_featured`/`admin_reorder_insight` tools call, so manual
UI and Copilot share one code path here too.

## Copilot Parity

Every action above with a corresponding Copilot tool executes through the
exact same function as its manual-UI counterpart — confirmed in
`src/components/admin/command/AdminChatPanel.tsx`'s `executeAction()`,
which calls `setListingStatus`, `setListingFeatured`, `setAgentVisibility`,
`setAgentActive`, `resendAgentInvite`, `reviewApplication`,
`setAgentAdminRole`, `updateAgentProfile`, `setInsightPublished`,
`setInsightFeatured`, and `reorderInsight` — the identical set used by the
manual UI table above. The LLM never mutates the database directly: it
proposes a tool call, the user confirms, and only then does
`executeAction()` invoke the action-layer function — the same
authorization (`requireAdmin()`), validation, and audit logging apply
regardless of which path triggered the call.

`createAgent` and `createListing` do **not** yet have a Copilot tool (agent
creation and listing creation are both multi-field, multi-step flows not
in this session's tool-wiring scope) — manual UI is currently their only
caller. This is a documented gap, not an oversight: if a Copilot tool is
added for either later, it must call these same functions, not reimplement
their logic.

## What Was NOT Changed

- `AdminListingsPage.tsx`, `AgentsListPage.tsx`, `ApplicationsPage.tsx`,
  `EditAgentPage.tsx`, `MarketInsightsPage.tsx`'s create/edit form path —
  already routed through the action layer in earlier sessions, confirmed
  clean by this session's audit, no changes needed.
- Read-only admin pages — no mutations exist to migrate.
- The agent-portal's own listing management (`AgentListingsPage.tsx`,
  `EditListingPage.tsx`, `ListingFormScene.tsx`) — out of scope for this
  pass (this document covers **Admin UI** specifically, per the task); the
  duplicated status-toggle/delete logic there was already flagged
  separately in `docs/system/DUPLICATE_LOGIC_REPORT.md` §1 and is not
  touched by this refactor.

## Verification

`tsc --noEmit`, full `vitest run` (6 files / 13 tests, including 2 new test
files covering the two newly-migrated operations), and `vite build` all
pass after every change in this session. New tests:
- `src/lib/listingOperations.test.ts` — 6 tests covering `createListing()`: owner scoping, draft vs. active status, photo/floor-plan row insertion, conditional private-notes insertion, and conditional folder-linking.
- `src/components/admin/AddNewAgentForm.test.tsx` — 3 tests covering `createAgent()` call shape on submit, action-layer error surfacing without losing form state, and client-side CEA validation blocking the call entirely.
