# Admin Activity Inventory

Discovery pass, 2026-08-15. Every discrete admin activity found in code, organized by the
requested capability categories. Not limited to visible buttons — includes what each
button/action actually does underneath (function, table, log).

## CRUD

- **Agents**: Read (`AgentsListPage.tsx`, `agent_profiles` + `user_roles`), Update — field-level (`EditAgentPage.tsx` → `updateAgentProfile()`, unified onto the shared action layer this session), Create (`AgentsListPage.tsx` inline "Add New Agent" via `AddNewAgentForm.tsx` → `send-agent-invite` edge function). No hard-delete of agents found anywhere.
- **Listings**: Read (`AdminListingsPage.tsx`), Create (`/admin/listings/new` → shared `NewListingPage.tsx`, `isAdminMode` branch), Update (status/featured via `adminOperations.ts`), no admin-side delete found (delete exists only on the agent side — see `docs/system/DUPLICATE_LOGIC_REPORT.md`).
- **Applications**: Read + Update (`ApplicationsPage.tsx` → `reviewApplication()`), no create/delete (applications are member-submitted via `/apply`).
- **Market Insights**: full Create/Update (`MarketInsightsPage.tsx` → `saveMarketInsight()`, now audit-logged as of this session), Read (`AdminInsightDetailPage.tsx`), no delete found.
- **Activity Log**: Read-only (`ActivityLogPage.tsx`) — append-only by design, no update/delete anywhere (correct for an audit trail).

## Approval

- Agent applications: approve/decline/interview/reviewing status transitions via `reviewApplication()` (`ApplicationsPage.tsx`, `adminOperations.ts:154-187`), each logged to `admin_activity_log`.
- Listing `approval_status`/`approved_by`/`approved_at`/`rejection_reason` columns exist on `properties` (per schema), but **no admin UI surface for listing approval was found** — worth flagging in `docs/system/MISSING_CAPABILITY_REPORT.md`; the columns exist but nothing in `src/pages/admin` reads or writes them.

## Publication / Visibility

- Listings: publish/unpublish (`status: active|draft` via `setListingStatus()`).
- Agents: publish/unpublish on the public Team page and homepage spotlight (`is_published`, `is_featured` via `setAgentVisibility()`).
- Market Insights: publish/unpublish (`published_at` timestamp toggle via `saveMarketInsight()`, `MarketInsightsPage.tsx`).

## Featured Content

- Listings: feature/unfeature (`setListingFeatured()`).
- Agents: feature/unfeature, restricted to `agent_type === "internal"` (`setAgentVisibility()`, enforced both client-side in `EditAgentPage.tsx`/`AgentsListPage.tsx` and server-side in `adminOperations.ts:36-46` which rejects featuring a non-internal agent).
- Market Insights: feature/unfeature + manual `display_order` reordering (`MarketInsightsPage.tsx`, `toggleFeatured`/reorder handlers calling `saveMarketInsight()`).

## User / Agent Management

- Activate/suspend an agent's account (`setAgentActive()` → `profiles.is_active`).
- Resend invite / password-reset email (`resendAgentInvite()` → `resend-agent-invite` edge function).
- Grant/revoke admin role (`setAgentAdminRole()` → `admin-set-user-role` edge function → `user_roles` table).
- Field-level profile editing: name, phone, avatar (upload to `agent-avatars` bucket or URL), CEA number (validated `R\d{6}[A-Z]` format), position, agent type (internal/external), years of experience, specialisations, languages, WhatsApp/display email/LinkedIn, bilingual bio — all via `updateAgentProfile()` as of this session.
- Create new agent (invite flow via `AddNewAgentForm.tsx` → `send-agent-invite`).

## Authentication

- Admin login (`AdminLoginPage.tsx`), sign-out (`AdminLayout.tsx:69-73`, `supabase.auth.signOut()` → redirect to `/agent-login`). No admin-specific MFA/session-management UI found.

## Content / Media

- Market Insights body/description/cover image/attached file URL (`MarketInsightsPage.tsx` form fields, `market_reports` table).
- Agent avatar upload (`EditAgentPage.tsx` → Storage bucket `agent-avatars`).
- Listing images (via the shared `NewListingPage.tsx`/`EditListingPage.tsx` forms, `property_images` table) — not audited field-by-field here since those pages are shared with the agent portal (see `docs/system/EXISTING_FUNCTION_INVENTORY.md`).

## Settings

- `SettingsPage.tsx` is a **static, read-only links/reference hub** — "Public visibility rules", "Agent onboarding and email", "Admin control surface" — no form inputs, no Supabase writes anywhere on this page. There is currently no admin-editable system setting of any kind.

## Reports

- `ReportsPage.tsx` — aggregate KPI dashboard via `fetchAdminOverview()` (same data source as `AdminDashboard.tsx`): agent/listing/application counts, published/active/pending breakdowns. Read-only, no export/scheduling.

## Search

- Client-side substring filtering only, on both `AdminListingsPage.tsx` and `AgentsListPage.tsx` (`Array.filter` over already-fetched data) — no server-side full-text search (`textSearch`/`ilike` on the query) and no server-side pagination-aware search anywhere in the admin portal.

## Bulk Operations

- **None found.** No multi-select checkbox pattern exists in `src/pages/admin/*` or `src/components/admin/*` — every action (publish, feature, activate, review) operates on a single row at a time via its own button.

## Scheduling

- No scheduling capability exists in the admin portal itself. (Viewing/appointment scheduling exists but is entirely agent-portal-scoped — see `docs/system/EXISTING_FUNCTION_INVENTORY.md`.) No cron/background jobs anywhere in the system (`docs/system/SYSTEM_ARCHITECTURE.md` §5).

## Notifications

- The `notifications` table exists in the schema (per-user, `is_read` flag) but is **never queried or written anywhere in the codebase** — not in admin, not in the agent portal. The one UI hook (`TopBar.tsx` bell icon in the agent command center) only navigates to a `notifications` scene that renders a "coming soon" placeholder. No admin notifications page or bell exists at all.

## Audit

- `admin_activity_log` — append-only, viewed via `ActivityLogPage.tsx`. As of this session, `logAdminActivity()` (`adminOperations.ts`) is the **single confirmed writer** to this table (previously `EditAgentPage.tsx` had a duplicate local logger, now removed; `marketInsights.ts` now also writes through the same function). Agent-portal actions (leads, viewings, tasks, listing changes made from the agent side) do **not** write to this table — there is no unified cross-role audit trail, only an admin-side one plus the separate `file_activity_log` for agent file operations.

## System Operations

- **None found.** No system health/status page, no cache-clear/reindex/maintenance-mode controls anywhere in `src/pages/admin`.

## Integrations

- **None found as an admin-manageable feature.** The only "integration" surface is developer-configured edge-function secrets (`N8N_INVITE_WEBHOOK_URL`, `ANTHROPIC_API_KEY`, `OPENAI_EMBEDDING_API_KEY`) — none of these are exposed or editable through any admin UI.

## Complete Admin Page List (cross-reference)

See `docs/ADMIN_UI_CURRENT_STATE.md` §2 (written earlier this session) for the full page-by-page table with routes, data sources, and role access — not duplicated here to avoid drift between two copies of the same table.
