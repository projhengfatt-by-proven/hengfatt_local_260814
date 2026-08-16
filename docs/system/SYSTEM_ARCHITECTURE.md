# System Architecture

Discovery pass, 2026-08-15. Read-only survey — describes what exists, proposes nothing.

## 1. Stack

React + **Vite** (not Next.js) + `react-router-dom` + Supabase (Postgres, Auth, Storage, Edge Functions). Package name `vite_react_shadcn_ts` — scaffolded via Lovable (`lovable-tagger` devDependency, used conditionally in `vite.config.ts:12`). shadcn/ui primitives under `src/components/ui/`.

## 2. Project Structure

```
src/
  pages/            top-level routed pages (public site, auth, agent command center)
  pages/admin/      admin portal pages
  pages/portal/     standalone agent listing pages (AgentListingsPage, NewListingPage, EditListingPage)
  components/
    admin/          admin shell + action layer (AdminLayout, adminOperations.ts, command/ subfolder)
    command/        agent Copilot command-center UI (chat, canvas, scenes/)
    auth/           BrandedLeftPanel.tsx only
    home/, layout/  public site UI
    ui/             shadcn primitives
  hooks/            use-mobile.tsx, use-toast.ts — no custom useAuth
  lib/              ariaClient.ts, marketInsights.ts, listingHelpers.ts, userRoles.ts, intentPacks/, *Copilot.ts helpers
  integrations/supabase/   generated client.ts + types.ts
  test/             example.test.ts (placeholder), setup.ts (vitest jsdom setup)

supabase/
  functions/        6 edge functions (see §4)
  migrations/        14 timestamped .sql files (Feb–Aug 2026) + seed_sample_leads.sql
  EDGE_FUNCTION_SECRETS(.example).md, config.toml
```

## 3. Route Map (`src/App.tsx`)

| Route | Component | Protection |
|---|---|---|
| `/`, `/about`, `/team`, `/properties`, `/properties/:slug`, `/listings`, `/listings/:id`, `/insights`, `/insights/:slug`, `/services`, `/contact`, `/apply` | `StandardPages()` inside `Layout` (Navbar+Footer) | none — public |
| `/portal/member` | `MemberPortal` (placeholder stub, `PlaceholderPages.tsx`) | **none** — no auth check at all |
| `/agent-login`, `/admin/login`, `/auth/callback`, `/reset-password` | dedicated auth pages | n/a (auth flow itself) |
| `/portal/agent` | `AgentCommand` (full-screen command center) | **not wrapped in a protected-route component** — does its own inline `supabase.auth.getUser()` check (`AgentCommand.tsx:73`) |
| `/portal/agent/listings`, `/portal/agent/listings/new`, `/portal/agent/listings/:id/edit` | `AgentListingsPage`, `NewListingPage`, `EditListingPage` | each does its **own inline** `supabase.auth.getSession()` check — no shared wrapper |
| `/admin/*` (dashboard, copilot, agents, agents/:id/edit, activity, listings, listings/new, properties, insights, insights/:id, applications, reports, settings) | nested under `AdminLayout` | `AdminProtectedRoute` — role check via `user_roles` (see `docs/admin/ROLE_INVENTORY.md`) |
| `*` | `NotFound` | — |

**Gap**: `AdminProtectedRoute` is the *only* protected-route component in the app. Agent-portal pages and `/portal/member` do not share an equivalent — auth checks are duplicated ad hoc, and `/portal/member` currently has none.

## 4. Backend / Edge Functions (`supabase/functions/`)

| Function | Purpose | Invoked via |
|---|---|---|
| `aria-chat` | Copilot chat/tool-use endpoint — streams Anthropic SSE, picks `ADMIN_TOOLS`/`ARIA_TOOLS` by `assistantRole`, server-side 403 for non-admins on the admin path (no equivalent check on the agent path) | raw `fetch` from `src/lib/ariaClient.ts:51` (needed for SSE streaming, not `.invoke()`) |
| `classify-intent` | Embedding-based intent classifier (OpenAI `text-embedding-3-small`, cosine similarity vs. static intent packs) | raw `fetch` from `ariaClient.ts:2` — **agent-portal path only**, no auth check at all |
| `admin-set-user-role` | Verifies caller is admin, grants/revokes a role via service-role client | `adminOperations.ts:190` (`setAgentAdminRole`) |
| `resend-agent-invite` | Verifies caller is admin, re-sends an invite | `adminOperations.ts:92` |
| `send-agent-invite` | Verifies caller is admin, sends a new invite (likely triggers `N8N_INVITE_WEBHOOK_URL`) | `AddNewAgentForm.tsx:113` |
| `analyse-agent-files` | Verifies `agent_id === caller.id`, AI-analyzes uploaded agent files | `FilesScene.tsx:320` |

All 6 have a live call site — none appear orphaned. Invocation is split: the 4 admin/agent-role-check functions use `supabase.functions.invoke(...)`; the 2 Copilot functions use raw `fetch` because they need streaming.

## 5. Background / Scheduled Jobs

**None exist.** Confirmed by direct search: no `cron`/`pg_cron` in any migration or edge function (the only "schedule" hits are business-domain `scheduled_at` columns on viewing/booking tables — not job infrastructure), no `.github/workflows/` directory at all, and only two `setInterval` calls in the whole `src/` tree, both cosmetic UI timers (a chat placeholder-text rotator and a number count-up animation), not data sync. No React Query `refetchInterval` usage anywhere. Everything in this app is either an on-demand edge function call or a synchronous DB read triggered by user action.

## 6. Auth

- **Client**: `src/integrations/supabase/client.ts:11-17` — `persistSession: true`, `autoRefreshToken: true`, `storage: localStorage`. URL/key are hardcoded in this generated file rather than read from `import.meta.env` (despite `.env` defining `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`, which *are* read elsewhere, e.g. `ariaClient.ts`).
- **No global auth context or hook** — zero `useAuth`/`AuthContext`/`AuthProvider` matches anywhere in `src/`. Every component that needs session/role state calls `supabase.auth.getSession()`/`getUser()` directly, independently.
- **Only one protected-route component**: `AdminProtectedRoute` (`src/components/AdminProtectedRoute.tsx`) — session check + `userHasRole(userId, "admin")` (`src/lib/userRoles.ts`) against the `user_roles` table, redirects to `/admin/login` if absent.
- Auth flow pages: `AgentLoginPage`, `AdminLoginPage`, `AuthCallbackPage` (`/auth/callback`), `ResetPasswordPage`. No dedicated signup page — agent onboarding goes through `AgentApplication.tsx` (`/apply`) plus the admin-invite edge functions.

## 7. Configuration

- **`package.json` scripts**: `dev` (vite), `build`, `build:dev` (`--mode development`), `lint` (eslint), `preview`, `test` (`vitest run`), `test:watch` (`vitest`).
- **`vite.config.ts`**: dev server `host: "::"`, `port: 8080`; `@` → `./src` alias; `componentTagger()` (Lovable) only in dev mode.
- **Env vars actually read** (`import.meta.env.VITE_*`, grepped): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (both `ariaClient.ts`), `VITE_ACTIVE_INTENT_PACK` (`lib/intentPacks/index.ts:19`). Root `.env` also defines `VITE_SUPABASE_PROJECT_ID`, which nothing in `src/` reads.
- **Edge function secrets doc is out of date**: `supabase/EDGE_FUNCTION_SECRETS.example.md` lists `SITE_URL`, `N8N_INVITE_WEBHOOK_URL`, `N8N_INVITE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` — but `classify-intent/index.ts` reads `OPENAI_EMBEDDING_API_KEY` at runtime, which is undocumented there.
- No `.env.example` exists at the repo root.

## 8. Tests

Vitest (`vitest.config.ts`: `environment: "jsdom"`, `globals: true`, `setupFiles: ["./src/test/setup.ts"]`). Setup stubs `matchMedia`/`ResizeObserver` for jsdom and imports `@testing-library/jest-dom`. No Playwright/Cypress — no e2e/integration tooling at all.

**Complete test file list (4 total)**:
- `src/test/example.test.ts` — trivial placeholder, no real coverage.
- `src/pages/admin/AdminListingsPage.test.tsx` — Copilot-draft-to-form flow for listing creation.
- `src/pages/admin/AgentsListPage.test.tsx` — Copilot-draft-to-form flow for agent invite.
- `src/pages/admin/MarketInsightsPage.test.tsx` — Copilot-draft-to-form flow for market insight creation.

Coverage is narrow: all three substantive tests exercise the same "AI draft → prefilled form" pattern on admin pages. No coverage of auth, RLS-dependent behavior, the agent portal, or any edge function.

## 9. Design Tokens (established, reused throughout)

- Colors (`src/index.css:40-48`, HSL): `--navy: 213 52% 11%` (`-light` variant), `--gold: 42 52% 54%` (`-light`/`-dark`), `--cream: 36 33% 93%` (`-dark`), plus `--charcoal`, `--surface`.
- Fonts: `Playfair Display` (serif, `font-heading`), `DM Sans` (sans, `font-body`) — `tailwind.config.ts:16-19`, loaded via Google Fonts in `src/index.css:1`.
- Convention: dark navy shell chrome (`bg-navy`, `text-cream`, `text-gold` accents) around light cream/white working canvases — already matches a "command center" visual direction without new tokens.

## 10. Data Model (see `docs/admin/ROLE_INVENTORY.md` and `docs/system/EXISTING_FUNCTION_INVENTORY.md` for role/action detail)

Source of truth: `src/integrations/supabase/types.ts` (generated from the live DB, more complete than tracked migrations). Consistent RLS pattern across nearly every table: public read where applicable, owner-only write (`auth.uid() = agent_id`/`user_id`), `has_role(auth.uid(), 'admin')` full access for admin-relevant tables. Full table-by-table breakdown lives in `docs/ADMIN_UI_CURRENT_STATE.md` §6 (written earlier this session) — not repeated here.
