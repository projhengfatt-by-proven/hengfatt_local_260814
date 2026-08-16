# Existing Function Inventory

Discovery pass, 2026-08-15. Catalogs reusable functions/modules across the codebase —
edge functions, shared action-layer modules, and utilities — so future work knows what
already exists before writing something new.

## Edge Functions (`supabase/functions/`)

See `docs/system/SYSTEM_ARCHITECTURE.md` §4 for the full table (purpose + invocation site per function). Six total: `aria-chat`, `classify-intent`, `admin-set-user-role`, `resend-agent-invite`, `send-agent-invite`, `analyse-agent-files`. Not repeated here to avoid two copies drifting.

## Admin Action Layer — `src/components/admin/adminOperations.ts`

The shared write layer for admin operations, used by both manual UI buttons and the admin Copilot's `executeAction()`:

| Function | Table(s) | Used by (manual) | Used by (Copilot) |
|---|---|---|---|
| `setAgentVisibility(agentId, {is_published, is_featured})` | `agent_profiles` | `AgentsListPage.tsx` | `admin_set_agent_visibility` |
| `setAgentActive(agentId, isActive)` | `profiles` | `AgentsListPage.tsx` | `admin_set_agent_active` |
| `resendAgentInvite(email)` | (edge fn `resend-agent-invite`) | `AgentsListPage.tsx` | `admin_resend_agent_invite` |
| `setListingStatus(listingId, status)` | `properties` | `AdminListingsPage.tsx` | `admin_set_listing_status` |
| `setListingFeatured(listingId, value)` | `properties` | `AdminListingsPage.tsx` | `admin_set_listing_featured` |
| `reviewApplication(id, status, notes)` | `agent_applications` | `ApplicationsPage.tsx` | `admin_review_application` |
| `setAgentAdminRole(agentId, enabled)` | (edge fn `admin-set-user-role`) → `user_roles` | `AgentsListPage.tsx` | **no Copilot tool** |
| `updateAgentProfile(agentId, profileUpdate, agentUpdate)` *(added this session)* | `profiles` + `agent_profiles` | `EditAgentPage.tsx` | **no Copilot tool** |
| `logAdminActivity(...)` *(now exported)* | `admin_activity_log` | internal to the above | internal to the above; also called directly by `marketInsights.ts` as of this session |

## Market Insights — `src/lib/marketInsights.ts`

Separate module (not merged into `adminOperations.ts`), used only by `MarketInsightsPage.tsx`/`AdminInsightDetailPage.tsx`. `fetchMarketInsights()`, `saveMarketInsight()` (handles both create and update, now calls `logAdminActivity()` as of this session), plus pure helpers (`marketInsightToForm`, `slugifyInsightTitle`, `buildInsightHref`, `extractInsightId`, `formatInsightDate`). No Copilot tool exists for any of this.

## Agent Portal Action Layer — per-domain modules under `src/components/command/scenes/`

Unlike admin's single `adminOperations.ts`, the agent portal splits its shared action layer by domain — each with an explicit code comment stating it exists specifically so manual UI and the matching ARIA tool can't drift apart:

| Module | Functions | Table(s) |
|---|---|---|
| `leadOperations.ts` | `createLead()`, `updateLeadStatus()` | `leads` |
| `leadShareOperations.ts` | `shareLead()` (creates pending `lead_shares` row), `acceptLeadShare()`/`declineLeadShare()` (RPC `accept_lead_share`) | `lead_shares` |
| `viewingOperations.ts` | `bookViewing()`, `rescheduleViewing()`, `updateViewingStatus()` | `viewings` |
| `taskOperations.ts` | `createTask()`, `setTaskCompletion()` | `agent_tasks` |
| `useFileOperations.ts` | rename/delete folder, delete/move file, note CRUD (also syncs `rag_documents`) — each writes `file_activity_log` | `agent_files`, `file_activity_log`, `rag_documents` |

**Not covered by a shared module**: `folder_create` (duplicated between `AIChatPanel.tsx` inline and `FilesScene.tsx`'s own `confirmCreateFolder()` — see `docs/system/DUPLICATE_LOGIC_REPORT.md`), and file upload (`FilesScene.tsx`'s `handleUpload()`, inline, no Copilot tool at all).

**`lead_draft_message`** and **`viewing_lookup`**/**`lead_view`** have no operation module because they don't write (draft-only / read-only respectively) — implemented inline in `AIChatPanel.tsx`.

## Listing Management — three separate, non-shared implementations (agent-facing)

No single shared module exists for listing CRUD on the agent side. Three independent implementations were found:
1. `src/pages/portal/NewListingPage.tsx` / `EditListingPage.tsx` — standalone routed pages, shared between admin (`isAdminMode` branch) and agent standalone routes.
2. `src/components/command/scenes/ListingFormScene.tsx` — a second, separate in-Copilot create/edit wizard.
3. `src/pages/portal/AgentListingsPage.tsx` — its own list/delete/status-toggle logic, independent of both of the above.

See `docs/system/DUPLICATE_LOGIC_REPORT.md` for the specific duplicated logic (status toggle, delete cascades) across these.

## Shared Utilities — `src/lib/`

- `listingHelpers.ts` — `formatSGD()` (currency formatter). Correctly reused in several places, but **not** used consistently — roughly 10 files reimplement `toLocaleString()` price/number formatting instead (see duplicate-logic report).
- `userRoles.ts` — `getUserRoles(userId)`, `userHasRole(userId, role)` — the one shared role-check helper, used by `AdminProtectedRoute.tsx` and a few admin pages.
- `ariaClient.ts` — `streamARIA()` (Copilot chat streaming client), `classifyIntent()` (agent-only fast-path).
- `intentPacks/` — static example-phrase packs for `classify-intent` (`real-estate.ts`, `_empty`).
- `agentInviteCopilot.ts`, `listingCopilot.ts`, `marketInsightCopilot.ts` — AI-draft-generation helpers used by the three tested admin pages (`*.test.tsx`) to prefill forms from a natural-language prompt; separate concept from the ARIA tool-calling Copilot (these generate structured drafts, not proposed writes).

## Summary

The admin side now has one consistent, fully-adopted action layer (`adminOperations.ts` + `marketInsights.ts` sharing its audit logger). The agent side has a *correct but more fragmented* pattern — several well-factored per-domain modules (`leadOperations.ts` etc.) that are genuinely shared between manual UI and Copilot, plus one clear gap (`folder_create`) and one larger structural issue (three independent listing-management implementations, none of which share code with each other) — detailed in `docs/system/DUPLICATE_LOGIC_REPORT.md`.
