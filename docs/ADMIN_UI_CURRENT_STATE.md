# Admin UI — Current State Audit

Audited 2026-08-15. Read-only survey of the existing admin portal before any
Command Center revamp. This documents *what exists today*; it does not
propose changes. See `docs/ADMIN_UI_REVAMP.md` (to be written) for the
target architecture.

This app is **React + Vite + react-router** (not Next.js) with a Supabase
backend. That corrects an assumption in the revamp brief that requested it.

## 1. Roles

Only two roles exist in the system, both backed by the `user_roles` table
(`role` enum `app_role`: `"admin" | "agent" | "user"`):

- **admin** — checked via `userHasRole(userId, "admin")` (`src/lib/userRoles.ts:6-23`), gates `AdminProtectedRoute` (`src/components/AdminProtectedRoute.tsx:7-39`) and is enforced **server-side** in the `aria-chat` edge function before any admin tool list is returned (`supabase/functions/aria-chat/index.ts:86-98`, 403 if absent).
- **agent** — not a `user_roles` row at all. An "agent" is any user with an `agent_profiles` row; access to `/portal/agent` is gated by `role === "agent" || role === "admin"` in `AgentCommand.tsx` (client-side check, session + `user_roles` lookup, no admin-role row required for agents since they simply don't have one).
- **user** — public/member role, not used anywhere in the admin surface.

There is no per-page or per-action role granularity beyond this binary
admin check — every `/admin/*` route requires the same admin role.

## 2. Page Inventory

| Page | Route | Purpose | Data sources (tables) | Manual actions available | Copilot access | Role |
|---|---|---|---|---|---|---|
| `AdminDashboard.tsx` | `/admin` (index) | Overview metrics + quick links | `fetchAdminOverview` → `agent_profiles`, `properties`, `agent_applications`, `admin_activity_log` | none (read-only + nav links) | via `admin_navigate` | admin |
| `AdminCopilotPage.tsx` | `/admin/copilot` | Chat-left/scene-right command center (just rebuilt) | delegates to whichever scene is active | n/a | is the copilot | admin |
| `AgentsListPage.tsx` | `/admin/agents` | List/manage agents: publish, feature, activate/suspend, resend invite, grant/revoke admin role, create new agent | `agent_profiles`, `user_roles` | `setAgentVisibility`, `setAgentActive`, `resendAgentInvite`, `setAgentAdminRole` (all via `adminOperations.ts` — shared with Copilot) | `admin_set_agent_visibility`, `admin_set_agent_active`, `admin_resend_agent_invite` map to the same functions | admin |
| `EditAgentPage.tsx` | `/admin/agents/:id/edit` | Edit one agent's profile fields, avatar, publish/feature toggles | `agent_profiles`, `profiles`, `admin_activity_log`, storage bucket `agent-avatars` | **inline `supabase.update()` calls + a duplicated local `logActivity()`** — does NOT call `adminOperations.ts` | none — Copilot has no equivalent tool for field-level agent edits | admin |
| `ActivityLogPage.tsx` | `/admin/activity` | Read-only audit trail | `admin_activity_log` | none (read-only) | none | admin |
| `AdminListingsPage.tsx` | `/admin/listings` (also mounted at `/admin/properties`) | List/manage listings: publish/unpublish, feature | `properties` | `setListingStatus`, `setListingFeatured` (via `adminOperations.ts` — shared with Copilot) | `admin_set_listing_status`, `admin_set_listing_featured` map to the same functions | admin |
| `NewListingPage.tsx` (shared with agent portal) | `/admin/listings/new` | Create listing | `properties` | own form/insert logic (portal-shared component, not audited in depth here) | no dedicated Copilot tool | admin |
| `ApplicationsPage.tsx` | `/admin/applications` | Review agent applications: approve/decline/interview | `agent_applications` | `reviewApplication` (via `adminOperations.ts` — shared with Copilot) | `admin_review_application` maps to the same function | admin |
| `MarketInsightsPage.tsx` | `/admin/insights` | List/create/edit market insight reports, AI draft generation | `market_reports` via `src/lib/marketInsights.ts` (a **separate** module from `adminOperations.ts`) | create/update/publish, all inline via `marketInsights.ts` | **none** — no Copilot tool exists for insights, and `admin_navigate`'s screen enum doesn't include `insights` either (see §4) | admin |
| `AdminInsightDetailPage.tsx` | `/admin/insights/:id` | View one market insight report | `market_reports` via `marketInsights.ts` | same as above | none | admin |
| `ReportsPage.tsx` | `/admin/reports` | Aggregate reporting dashboard | `fetchAdminOverview` (same as Dashboard) | none (read-only) | via `admin_navigate` | admin |
| `SettingsPage.tsx` | `/admin/settings` | Static hub linking to other admin sections | none | none | via `admin_navigate` | admin |
| `AdminPlaceholder.tsx` | *(unrouted)* | Not referenced in `App.tsx` — dead/unused file | — | — | — | — |

## 3. Admin Shell (`AdminLayout.tsx`)

- **Desktop**: collapsible left sidebar, collapse state persisted to `localStorage["admin-sidebar-collapsed"]`. Nav items (`AdminLayout.tsx:27-37`): Dashboard, Copilot, Agents, Activity Log, Listings, Insights, Applications, Reports, Settings.
- **Mobile**: hamburger button → full-screen scrim + left slide-in drawer (same `SidebarContent`, reused). **No bottom navigation exists anywhere in the app today** — not in admin, not in the agent portal, not on the public site. This would be new construction, not a migration.
- No Quick Access / context panel exists in the admin shell today (the agent portal has one — see below).

## 4. Copilot / ARIA Architecture

- **Client**: `src/lib/ariaClient.ts` streams from edge function `aria-chat`, parses Anthropic-style SSE, returns `{ cleanText, toolCalls[] }`. Used by `AdminChatPanel.tsx` (`assistantRole: "admin"`, just built this session) and `AIChatPanel.tsx` (`assistantRole: "agent"`, the pre-existing agent portal chat).
- **Edge function** (`supabase/functions/aria-chat/`): picks a tool set by role — `ADMIN_TOOLS` (7 tools, `tools.ts:219-317`) vs `ARIA_TOOLS` (13 tools for the agent portal, `tools.ts:6-217`). Model: `claude-sonnet-5`, streamed, `max_tokens: 2048`.
- **Execution model**: the LLM only *proposes* tool calls (system prompt explicitly frames writes as proposals — `prompt.ts:30-31`). All actual Supabase writes happen **client-side**, after user confirmation, in `AdminChatPanel.tsx`'s `executeAction()` (admin) or `AIChatPanel.tsx`'s equivalent switch (agent). `admin_navigate` is the one exception — it applies immediately, no confirm step.
- **RLS is the real enforcement boundary** — every admin-relevant table has `has_role(auth.uid(), 'admin')` policies (base migration `20260219211720_*.sql:397-506`) that would still block a forged/bypassed client call.
- **Server-side role check asymmetry**: the admin path 403s non-admins *before* returning any tool definitions (`aria-chat/index.ts:86-98`). **The agent path has no equivalent check** — any authenticated (or even unauthenticated) caller can currently retrieve the full `ARIA_TOOLS` list and a streamed completion; RLS is still the backstop for the actual writes, but this is worth flagging as a gap outside the scope of this admin-focused revamp.
- **Intent classification** (`classify-intent` edge function, embedding-based) is used **only** by the agent portal (`AIChatPanel.tsx:551`) — the admin copilot relies solely on Claude's native tool-use and never calls it.
- **Context sent to the model**: admin gets a materially richer context (`AdminOverview`: counts, pending invites, urgent applications, draft listings, recent activity — `adminOverview.ts`) vs. the agent portal's 4 flat counters (`AgentContext` in `CommandContext.tsx`) plus long-term `agent_memory` rows.
- **Known drift bug (found during this audit, not yet fixed)**: `admin_navigate`'s server-side `screen` enum (`tools.ts:229`) is `dashboard, agents, add_agent, activity, listings, applications, reports, settings, copilot` — it does **not** include `insights`, so the Copilot can never navigate to Market Insights by voice/text today. Conversely `add_agent` and `copilot` have no matching entry in the client's `SCREEN_TO_SECTION` map (`AdminCommandContext.tsx`) — `add_agent` is special-cased separately, but `copilot` silently no-ops. This enum is manually duplicated between Deno (`tools.ts`) and React (`AdminCommandContext.tsx`) with no shared source of truth — the same pattern exists on the agent-portal side (`screen_navigate` vs `SceneType`), currently in sync there only by coincidence.

## 5. Action-Layer Reuse (manual UI vs. Copilot)

`src/components/admin/adminOperations.ts` is a real, shared action layer —
but it's only *partially* adopted:

**Shared (manual UI and Copilot call the same function):**
- Listings: `setListingStatus`, `setListingFeatured` — used by both `AdminListingsPage.tsx` and `AdminChatPanel.tsx`.
- Applications: `reviewApplication` — used by both `ApplicationsPage.tsx` and `AdminChatPanel.tsx`.
- Agents (list-level): `setAgentVisibility`, `setAgentActive`, `resendAgentInvite`, `setAgentAdminRole` — used by both `AgentsListPage.tsx` and `AdminChatPanel.tsx`.

**Not shared (gap):**
- `EditAgentPage.tsx` bypasses `adminOperations.ts` entirely — its own inline `supabase.from("agent_profiles"/"profiles").update()` calls plus a duplicated local `logActivity()` helper. A Copilot-driven agent-field edit today would either need a new tool + new shared function, or would silently diverge from the manual edit path's logging.
- Market Insights CRUD goes through `src/lib/marketInsights.ts`, a wholly separate module with no `adminOperations.ts` equivalent and no Copilot tools at all.

## 6. Supabase Schema (tables relevant to admin)

Source of truth: `src/integrations/supabase/types.ts` (generated from the
live DB — more complete than the tracked migration files). RLS pattern is
consistent across the schema: public read where applicable (e.g. `properties`
where `status='active'`), owner-only write (`auth.uid() = agent_id` etc.),
and `has_role(auth.uid(), 'admin')` full-access for every admin-relevant
table.

- `profiles` — base user record (no role column).
- `user_roles` — `role` enum `app_role` (`admin | agent | user`), separate table by design (avoids privilege escalation via profile edits).
- `agent_profiles` — public agent directory record: `is_published`, `is_featured`, `display_order`, `cea_no`, `agent_type`.
- `agent_applications` — recruiting applications: `status` enum, `reviewed_by`, `admin_notes`.
- `properties` (listings) — `agent_id`, `status`, `approval_status`, `is_featured`, `slug`, `view_count`; satellites: `property_images`, `property_audio`, `property_floor_plans`, `property_price_history`, `property_private_notes`, `property_enquiries`, etc.
- `admin_activity_log` — append-only admin audit trail (`admin_id`, `action`, `target_type/id/name`, `changes` jsonb).
- `market_reports` — market insights content (admin-managed).
- `agent_files`, `documents_generated`, `file_activity_log` — file/document management (agent-portal-facing; no dedicated admin page currently manages these directly beyond what's visible through agent records).
- `notifications` — per-user (`user_id`, `is_read`) — no dedicated admin notifications page today.
- `leads`, `clients`, `deals`, `appointments`, `viewings`, `agent_tasks`, `agent_performance` — CRM/pipeline/schedule tables, all owned by the **agent portal** (`agent_id` scoped), not currently surfaced anywhere in the admin portal.

## 7. Design Tokens (already established — reuse, do not reinvent)

- Colors (`src/index.css:40-48`, HSL): `--navy: 213 52% 11%`, `--navy-light: 213 40% 20%`, `--gold: 42 52% 54%` (`-light`/`-dark` variants), `--cream: 36 33% 93%` (`-dark` variant), `--charcoal`, `--surface`.
- Fonts: `Playfair Display` (serif, `font-heading`) for display headings, `DM Sans` (sans, `font-body`) for interface/body text (`tailwind.config.ts:16-19`, loaded via Google Fonts in `src/index.css:1`).
- Convention observed throughout `src/components/command/` and `src/components/admin/`: dark navy surfaces (`bg-navy`, `bg-[hsl(210,50%,12%)]`) with `text-cream` and `text-gold` accents for the "shell" chrome; the working canvas / admin pages themselves use light cream/white surfaces. This already matches the target navy-shell / ivory-canvas / gold-accent direction — no new tokens needed.

## 8. Closest Existing Precedent: the Agent Portal Command Center

`src/pages/AgentCommand.tsx` + `src/components/command/*` already implements
the target 4-zone shape (chat | canvas | quick-access, plus a bottom action
bar) for the **agent** role. It is the best available reference for
migrating the **admin** shell to the same shape:

- `CommandContext.tsx` — reducer/provider for scene state, chat messages, agent context.
- `DynamicScreen.tsx` — scene switcher rendering real feature components (not chat-rendered text).
- `AIChatPanel.tsx` — collapsible chat, `w-full lg:w-[380px]`, absolute-positioned overlay on mobile.
- `QuickAccessPanel.tsx` — **right-edge overlay** panel (`fixed right-0 ... w-[220px]`), no distinct mobile behavior currently (no `lg:hidden`/`md:hidden` classes found) — would need mobile handling if reused for admin.
- `ActionBar.tsx` — bottom bar that toggles between a thin collapsed "handle" and an expanded horizontal icon-scroll row of scene shortcuts. **This is the closest existing precedent for a mobile bottom-nav pattern** — nothing resembling a true bottom tab bar exists anywhere in the codebase yet, so a new admin mobile bottom nav would be new construction most naturally modeled on this collapse/expand mechanic rather than copied wholesale.
- Mobile chat toggle: floating action button, `fixed bottom-20 right-4` (positioned above `ActionBar`).

Note: the admin shell I built this session (`AdminCommandContext.tsx` /
`AdminChatPanel.tsx` / `AdminDynamicScreen.tsx`) deliberately does **not**
mirror this file-for-file — it's scoped to the Copilot page only, sits
inside the existing `AdminLayout` sidebar rather than replacing it, and has
no Quick Access panel or mobile bottom nav yet. Extending it to the full
shell described in the revamp brief is the next phase of work, not yet done.

## 9. Problems / Gaps Found

1. ~~**Enum drift** — `admin_navigate` screen enum (server) vs. `AdminSection`/`SCREEN_TO_SECTION` (client) are out of sync today: `insights` is unreachable via Copilot, `copilot` silently no-ops.~~ **Fixed 2026-08-15**: added `"insights"` to the `admin_navigate` screen enum in `supabase/functions/aria-chat/tools.ts` (already mapped client-side in `AdminCommandContext.tsx`), and documented the `"copilot"` case as an intentional no-op in `AdminChatPanel.tsx` rather than a silent gap. **Requires `supabase functions deploy aria-chat` to take effect** — not yet deployed. No shared source of truth between the Deno edge function and the React client still exists (same manual-duplication pattern on the agent-portal side too) — worth a follow-up if this drifts again.
2. ~~**Action-layer gap** — `EditAgentPage.tsx` and all of Market Insights bypass `adminOperations.ts`~~ **Partially fixed 2026-08-15**: added `updateAgentProfile()` to `adminOperations.ts` (shared `profiles` + `agent_profiles` update + activity logging) and migrated `EditAgentPage.tsx` to use it, removing its duplicated local `logActivity()`. `logAdminActivity` is now exported from `adminOperations.ts` and `src/lib/marketInsights.ts`'s `saveMarketInsight()` now calls it too, so Market Insight create/update actions are now audit-logged for the first time. **Still no Copilot tool exists for agent field-edits or market insights** — the action layer is unified, but Copilot access to these operations is a separate, not-yet-built feature.
3. **No mobile bottom nav anywhere in the app** — this is new construction for the revamp, not a migration of an existing pattern. Not started.
4. **No Quick Access / context panel in the admin shell** — exists only in the agent portal today, and even there has no mobile-specific behavior. Not started.
5. **Agent-portal edge function has no server-side role check** — pre-existing, out of scope for an admin-focused revamp, but worth a separate ticket.
6. **`AdminPlaceholder.tsx`** — dead file, unrouted, safe to leave alone or remove separately (not part of this revamp's scope).
