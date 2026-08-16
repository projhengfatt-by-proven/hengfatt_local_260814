# Duplicate Logic Report

Discovery pass, 2026-08-15. Concrete instances of the same operation implemented more
than once, found by tracing actual code rather than assuming from structure.

## 1. Listing status-toggle / delete — duplicated across 3 agent-portal files

None of these call `setListingStatus()`/`setListingFeatured()` from `adminOperations.ts`, and **none write to `admin_activity_log`** — meaning agent-initiated publish/unpublish/delete of a listing currently leaves no audit trail anywhere, unlike the same actions taken from the admin side.

- `src/pages/portal/AgentListingsPage.tsx:79-95` — `toggleStatus()` + `handleDelete()` (cascades deletes into `property_images`, `property_private_notes`, `agent_files`, `properties`).
- `src/pages/portal/EditListingPage.tsx:236-253` — near-identical `toggleStatus()`/`handleDelete()`, but with a **different cascade set**: also deletes `property_price_history` and `property_floor_plans`, which the version above omits. The two copies aren't just duplicated — they're inconsistent with each other.
- `src/components/command/scenes/ListingFormScene.tsx:369-388` — a third, essentially line-for-line copy of the same pair.

**Risk**: a listing deleted through one entry point may leave orphaned rows in tables the other entry points remember to clean up. Consolidating into one function (mirroring how `leadOperations.ts`/`viewingOperations.ts` are already done) would fix both the audit gap and the cascade inconsistency in one move.

## 2. Two independent, non-interlinked listing-management UIs (agent-facing)

- **In-Copilot**: `ListingsScene.tsx` → `ListingDetailScene.tsx` → `ListingFormScene.tsx`, all writing directly against `properties`/`property_images`.
- **Standalone**: `AgentListingsPage.tsx` → `NewListingPage.tsx` → `EditListingPage.tsx` (routed at `/portal/agent/listings*`).

These are not two views of the same flow — they are two **separate, unlinked** implementations. `AgentCommand.tsx` (the `/portal/agent` command center) has no link anywhere to the standalone `/portal/agent/listings*` routes, and the standalone pages use their own `useNavigate`/`Link`, never `dispatch({type:"NAVIGATE"})` into the Copilot's scene system. An agent could plausibly use either path and get a materially different UI for the same task, with two separately-maintained create/edit form implementations.

## 3. `folder_create` — duplicated between chat and manual UI

- Copilot path: `AIChatPanel.tsx:602-632` — inline insert into `agent_files`, own local `slugify()` (`AIChatPanel.tsx:26`), payload uses `file_name: ".folder"`, hardcodes `category: "listing"`, checks for an existing folder with the same name first.
- Manual path: `FilesScene.tsx`'s `confirmCreateFolder()` (`FilesScene.tsx:269-297`) — own separate `toSlug()` (`FilesScene.tsx:65`), payload uses `file_name: "folder-placeholder"`, lets the user pick the category, does **not** check for an existing duplicate folder name.

Same target table, two independently-maintained insert paths with different slugging, different placeholder filenames, and different duplicate-checking behavior. This is the agent-portal analog of the admin `EditAgentPage` duplication that was fixed earlier this session — same shape of problem, not yet addressed here.

## 4. `admin_activity_log` inserts — confirmed NOT duplicated (admin side)

Checked specifically because this was flagged as a risk pattern: `logAdminActivity()` in `adminOperations.ts:16` is the **only** function that inserts into `admin_activity_log` (`marketInsights.ts` now calls it too, rather than inserting independently, as of this session's fix). `adminOverview.ts` and `ActivityLogPage.tsx` only `select` from it. No duplicate writer exists on the admin side — the gap is that agent-portal actions don't call it at all (see item 1).

## 5. Toast-on-error boilerplate (low priority, informational)

The same shape — `toast({ title, description: error.message, variant: "destructive" })` — repeats near-identically across many files with no shared wrapper/hook. Representative examples: `AdminListingsPage.tsx:68,126,139`, `NewListingPage.tsx:124,192,238`, `EditListingPage.tsx:183`. This is boilerplate, not a functional bug — a `withToastError`/mutation-wrapper helper would reduce it but isn't urgent.

## 6. Price/number formatting — partially consolidated

`formatSGD()` (`src/lib/listingHelpers.ts:1-2`) is the shared currency formatter and is correctly imported in several places (e.g. `AgentListingsPage.tsx:4`). However, roughly 10 other locations reimplement `.toLocaleString()` formatting ad hoc instead of using it, producing visually-similar but not guaranteed-identical output: `CommissionScene.tsx:124,130,131,138,145`, `ListingsScene.tsx:69`, `ListingDetailScene.tsx:108`, `PropertiesPage.tsx:160,164`, `PropertyDetailPage.tsx:174,181,222`, `intentPacks/real-estate.ts:39`. Real de-dup opportunity, low urgency.

## Already Fixed This Session (for reference — not open items)

- `EditAgentPage.tsx` previously had its own inline `profiles`/`agent_profiles` update calls plus a duplicated local `logActivity()` helper, bypassing `adminOperations.ts` entirely. Now uses the new shared `updateAgentProfile()`.
- `marketInsights.ts`'s `saveMarketInsight()` previously did not write to `admin_activity_log` at all. Now calls the shared `logAdminActivity()`.

## Priority Read

Item 1 (listing status/delete triplication with an inconsistent cascade + missing audit trail) is the highest-value fix — it's both a duplication problem and a real data-integrity/audit gap. Item 2 (two unlinked listing UIs) is a larger structural decision, not a quick fix — worth a deliberate call on which implementation should be canonical before touching it. Items 3, 5, 6 are smaller and lower-risk.
