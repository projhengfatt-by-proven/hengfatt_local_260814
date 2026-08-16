# Role Inventory

Discovery pass, 2026-08-15. Read-only survey.

## Roles That Actually Exist

Only **two** meaningful roles exist in the system, both backed by the `user_roles` table (`role` column, enum `app_role`: `"admin" | "agent" | "user"`). Do not assume finer-grained roles (e.g. "moderator", "editor") — none exist anywhere in code, RLS, or the Copilot tool schemas.

### `admin`

- **Granted via**: `user_roles` row with `role = 'admin'`. Set/revoked through edge function `admin-set-user-role`, invoked by `setAgentAdminRole()` in `src/components/admin/adminOperations.ts:189-212` (callable from `AgentsListPage.tsx` and, going forward, could be exposed as a Copilot tool — currently isn't, see `docs/copilot/EXISTING_COPILOT_INVENTORY.md`).
- **Gates**: every `/admin/*` route via `AdminProtectedRoute` (`src/components/AdminProtectedRoute.tsx`) — binary check, no per-page or per-action granularity within admin. Also gates the admin path of the `aria-chat` edge function server-side (403 if absent, `supabase/functions/aria-chat/index.ts:86-98`).
- **Pages available**: all 11 routed admin pages (Dashboard, Copilot, Agents, Edit Agent, Activity Log, Listings, New Listing, Market Insights, Insight Detail, Applications, Reports, Settings) — see `docs/admin/ADMIN_ACTIVITY_INVENTORY.md` for the full activity breakdown.
- **Actions available**: everything in `src/components/admin/adminOperations.ts` (agent visibility/active/invite/admin-role, listing status/featured, application review) plus Market Insights CRUD (`src/lib/marketInsights.ts`) plus field-level agent profile edits (`updateAgentProfile`, added this session).
- **Database permissions**: RLS `has_role(auth.uid(), 'admin')` full-access policies exist on every admin-relevant table (`properties`, `agent_profiles`, `agent_applications`, plus the admin-only `admin_activity_log` insert policy). This is the real enforcement boundary — not the UI.
- **Copilot permissions**: full `ADMIN_TOOLS` set (7 tools) — see `docs/copilot/EXISTING_COPILOT_INVENTORY.md`.

### `agent`

- **Not a `user_roles` row at all.** An "agent" is inferred by having an `agent_profiles` row keyed to their `profiles.id` — there is no `role = 'agent'` entry anywhere. This is a meaningful distinction from `admin`, which *is* a `user_roles` row.
- **Gates**: `/portal/agent` (`AgentCommand.tsx`) checks `role === "agent" || role === "admin"` inline (client-side, no shared protected-route wrapper). `/portal/agent/listings`, `/listings/new`, `/listings/:id/edit` each independently check `supabase.auth.getSession()` — session presence only, not explicitly re-verifying the agent/admin role client-side (the real gate for these is RLS on `properties`, not the route guard).
- **Pages available**: the in-Copilot scene set (Dashboard, Leads, Lead Detail, Listings, Listing Detail, Listing Form, Calendar, Viewing Detail, Commission Calculator, Files) plus the separate standalone `/portal/agent/listings*` pages — see `docs/system/EXISTING_FUNCTION_INVENTORY.md` and `docs/system/DUPLICATE_LOGIC_REPORT.md` for how these two listing UIs relate (they are not the same code).
- **Actions available**: lead CRUD/status/reassign (`leadOperations.ts`, `leadShareOperations.ts`), viewing book/reschedule/status (`viewingOperations.ts`), task create/complete (`taskOperations.ts`), file upload/rename/delete/move/notes (`useFileOperations.ts` + inline `FilesScene.tsx` handlers), listing CRUD (three separate implementations — see duplicate-logic report).
- **Database permissions**: RLS `auth.uid() = agent_id` (or `= user_id` for files/tasks) owner-only policies on `leads`, `viewings`, `properties`, `agent_tasks`, `agent_files`, `agent_memory`, `message_templates`, `documents_generated`. Admin retains full access to all the same tables via `has_role`.
- **Copilot permissions**: full `ARIA_TOOLS` set (13 tools). **Note**: unlike the admin path, the agent-role Copilot path has **no server-side role/permission check** in the edge function — any authenticated (or per the audit, potentially unauthenticated) caller can retrieve the tool list and a streamed completion; RLS still blocks the actual writes if attempted, but this is an asymmetry worth a separate ticket.

### `user`

- Public/member role. Referenced in the `app_role` enum but **not used to gate anything in the current codebase** — `/portal/member` renders a static placeholder (`MemberPortal` in `PlaceholderPages.tsx`) with no auth check at all, and no page in the app currently checks for `role === "user"` specifically.

## Role → Page → Action → Permission Matrix (summary)

| Role | Pages | DB write scope (RLS) | Copilot tools |
|---|---|---|---|
| `admin` | all `/admin/*` (11 pages) | full access to all admin-relevant tables via `has_role` | `ADMIN_TOOLS` (7) |
| `agent` | `/portal/agent` scenes (10) + `/portal/agent/listings*` (3 standalone pages) | own rows only (`agent_id`/`user_id` scoped) across leads/viewings/properties/tasks/files | `ARIA_TOOLS` (13, no server-side role check) |
| `user` | `/portal/member` (placeholder, unbuilt) | none observed | none |

## Gaps Found

- No `AgentProtectedRoute` / `MemberProtectedRoute` equivalent to `AdminProtectedRoute` — every agent-portal entry point re-implements its own auth check inline.
- `/portal/member` has zero auth enforcement at the route level.
- Agent-role Copilot has no server-side permission check (admin-role Copilot does).
- The `agent` "role" is structurally different from `admin`/`user` (inferred from data presence rather than an explicit `user_roles` row) — worth being deliberate about if role logic is refactored later, since it means "does this user have an `agent_profiles` row" and "is this user's `user_roles.role = 'admin'`" are not parallel checks today.
