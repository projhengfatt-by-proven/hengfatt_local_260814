# Project Status — HengFatt Property

Snapshot as of 2026-08-13. For full detail and dated history, see
`BUILD_GUIDE.md` Part B (§9–11) and Part F (§20–21). This file is a concise
index into that, not a replacement for it — re-derive from `BUILD_GUIDE.md`
and the code if this drifts stale.

## Completed
- Public marketing site (Home, Team, Properties/PropertyDetail).
- Auth: `/agent-login`, `/admin/login`, `/auth/callback` (invite + first
  password set), `/reset-password`.
- Agent invite pipeline (code-complete): `send-agent-invite` Edge Function →
  n8n `agent-invite` workflow → `auth.users`/`profiles`/`user_roles`/`agent_profiles`.
  `resend-agent-invite` Edge Function for stuck/expired invites.
- Agent Command Center (ARIA) core: chat panel, tool-dispatch pattern,
  scenes for Listings, Leads (incl. lead reassignment via `lead_shares`),
  Calendar/Viewings, Files, Commission.
- Admin panel: Agents list/add/edit, Listings, Activity Log.
- Database: 29 tables across migrations, RLS on the tables actively used.

## In Progress / Partially Built
- Agent Command Center scenes that are placeholders: Social, Notifications, Market.
- `aria-whatsapp` Edge Function exists live in Supabase but nothing calls it
  or acts on its output yet (no source in this repo either — pulled from
  the live bundle during audit).

## Broken (confirmed bugs)
- ~~`ResetPasswordPage.tsx` always redirected to `/admin/login` regardless of
  which login surface the user came from~~ — **fixed 2026-08-13**, now
  routes by the account's actual role.
- ~~`resend-agent-invite/index.ts` hardcoded `siteUrl` to the Lovable
  domain~~ — **fixed 2026-08-13**, now reads `SITE_URL` env var with that
  value as fallback. Requires the `SITE_URL` secret to actually be set on
  Supabase (tracked in `ONBOARDING_CHECKLIST.md` A13).
- `AgentLoginPage.tsx` redirects to `/portal/agent/setup` when
  `agent_profiles` is missing, but that route doesn't exist in `App.tsx` —
  falls through to the catch-all `NotFound` page. Not urgent (n8n always
  creates the row synchronously today) but a landmine if invite ever fails partway.

## Missing
- **n8n's connection to Supabase is not wired live** — the n8n instance
  itself already exists (self-hosted inside a VPN, reverse-proxied; not
  Railway — see `ONBOARDING_CHECKLIST.md`'s "Superseded 2026-08-13" note).
  Workflow JSON exists (`n8n/workflows/agent-invite.json` + error handler)
  but the connecting Supabase secrets (`N8N_INVITE_WEBHOOK_URL`,
  `N8N_INVITE_WEBHOOK_SECRET`) were never set. This is the actively
  in-progress task (see `ONBOARDING_CHECKLIST.md` Section A).
- No self-serve sign-up/login for members/clients at all (`/portal/member`
  is a bare route).
- No bulk import path for leads/properties/calendar/commission history — a
  new agent's prior book of business has to be re-keyed manually through the UI.
- No admin override to reassign a departed agent's leads/listings/viewings
  (only the agent themself can initiate a `lead_shares` transfer).
- No MFA on the agent/admin portal.
- No self-serve profile completion for agents (CEA no., bio, etc. are
  admin-entered only, no post-activation edit path for the agent).
- No ARIA tool for "invite an agent" — onboarding is manual-form-only,
  inconsistent with this project's own dual-execution rule.

## Technical Debt
- Listing form exists as two independent implementations (Command-Center
  scene + standalone page) — see `BUILD_GUIDE.md` §19 "common pitfalls."
- `git` repo was never initialized for this project folder as of this
  writing; `.env` is not yet in `.gitignore`.

## Risks
- Partial invite failures: if the n8n workflow errors after the GoTrue
  invite step succeeds, the person has a login-capable account with no
  role/profile row. `agent_invite_failures` table logs this, but it's
  unconfirmed whether anything reads/alerts on that log.
- Suspending an agent (`is_active = false`) doesn't invalidate an
  already-open session for that agent, and doesn't cascade to their open
  leads/listings/viewings.

## Recommended Next Steps
1. Finish wiring n8n live (Supabase secrets, per the existing self-hosted
   VPN instance — not Railway) and run `ONBOARDING_CHECKLIST.md` end to
   end — in progress.
2. Decide and scope the bulk-import path for a new agent's existing book of
   business (biggest confirmed business-impact gap).
3. Write the admin + agent onboarding guide once the checklist passes.
4. Decide the member/client sign-up flow (open roadmap item, not yet designed).
