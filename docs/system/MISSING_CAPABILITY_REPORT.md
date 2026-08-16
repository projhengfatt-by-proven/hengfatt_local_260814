# Missing Capability Report

Discovery pass, 2026-08-15. What the requested capability checklist (CRUD, approval,
publication, featured content, user management, agent management, content, media,
settings, reports, search, bulk operations, scheduling, notifications, audit, system
operations, integrations) actually covers today, based on what exists in code — not
what a spec assumes should exist.

## Present (see other docs for detail)

CRUD, approval (applications only — see gap below), publication, featured content, user/agent management, content/media (Market Insights + agent avatars + listing images), reports (read-only KPIs), audit (admin-side only) — all covered in `docs/admin/ADMIN_ACTIVITY_INVENTORY.md`.

## Absent

| Capability | Present? | Evidence |
|---|---|---|
| **Bulk operations** | No | No multi-select/checkbox pattern in any admin page — every action (publish, feature, activate, review) is single-row only. |
| **Full-text / server-side search** | No | `AdminListingsPage.tsx` and `AgentsListPage.tsx` both do `Array.filter` substring matching over already-fetched data — no Postgres `textSearch`/`ilike` query, no server-side pagination-aware search. |
| **Notifications (surfaced)** | No | `notifications` table exists in the schema and is never queried or written anywhere in `src/`. The only UI hook is a bell icon in the agent command center `TopBar.tsx` that navigates to a scene which renders "coming soon" (`PlaceholderScene.tsx`). No admin notifications page or bell exists at all. |
| **System health / status page** | No | `ReportsPage.tsx` is business KPIs only, not infrastructure health. No health-check/uptime UI anywhere. |
| **Editable settings** | No | `SettingsPage.tsx` is a static, read-only links/reference hub — no form inputs, no writes. |
| **Integration management** | No | No API-key/webhook/third-party-connection UI anywhere. The only "integrations" are developer-configured edge-function secrets, not exposed in-app. |
| **Listing approval workflow** | No (partially schema-ready) | `properties` has `approval_status`/`approved_by`/`approved_at`/`rejection_reason` columns, but no admin page reads or writes them — the columns exist in the database with no UI surface. |
| **Scheduled/background jobs** | No | Confirmed absent system-wide — no cron/pg_cron, no GitHub Actions, no polling. See `docs/system/SYSTEM_ARCHITECTURE.md` §5. |
| **Cross-role unified audit trail** | No | Admin actions are logged (`admin_activity_log`); agent-portal actions (leads, viewings, tasks, listing changes) are not, except file operations (`file_activity_log`). No single place to see "everything that happened," admin or agent. |
| **Shared/centralized auth state** | No | No `AuthContext`/`useAuth` hook anywhere — every page independently calls `supabase.auth.getSession()`/`getUser()`. Not a "missing feature" so much as missing infrastructure that every future auth-dependent feature will otherwise have to re-solve per-page. |
| **Protected-route coverage for non-admin roles** | No | Only `AdminProtectedRoute` exists. Agent-portal pages and `/portal/member` have no shared equivalent; `/portal/member` currently has zero auth check. |

## Copilot Tool-Surface Gaps

- **Admin**: no tool for `setAgentAdminRole` (promote/demote — function exists in `adminOperations.ts`, unreachable via chat), none for Market Insights CRUD, and — following directly from the table above — no tool could exist yet for bulk actions, search, notifications, settings, or listing approval, because none of those are built as features in the first place.
- **Agent**: no tool to *accept* a `lead_reassign` share (manual-only), no chat-driven folder rename/delete (create-only), no chat-driven file notes or listing delete.

## Test Coverage Gaps

Only 4 test files exist total, 3 of which test the same narrow pattern (AI-draft-to-form prefill on 3 admin pages). No coverage of: auth/session behavior, RLS-dependent access control, any agent-portal page, any edge function, or any of the duplicate-logic risk areas identified in `docs/system/DUPLICATE_LOGIC_REPORT.md`. No e2e/integration test tooling (no Playwright/Cypress) exists to catch cross-page regressions.

## Reading This Report

None of the above are recommendations to build — this is strictly an inventory of what does not exist today, so that future planning starts from an accurate baseline rather than an assumption that a typical admin portal's capability set is already present. Several absences (bulk operations, server-side search, editable settings, integrations, system health) may simply be genuinely out of scope for this application's size and shouldn't be treated as automatic backlog items.
