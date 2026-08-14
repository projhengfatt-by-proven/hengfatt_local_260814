# Agent Onboarding — QA Checklist

Companion to `BUILD_GUIDE.md` Part F. This is the test script we run once, live, against the real Supabase project + n8n, to prove the onboarding flow actually works end to end — not just that the code looks right. Each row gets a Status as we go: **Not Run / Pass / Fail / Blocked**.

Two confirmed bugs were already patched in code before this test run (see row **C6** and secret **A12** below for how each is verified):
- `ResetPasswordPage.tsx` now routes back to `/agent-login` or `/admin/login` based on the account's actual role, instead of always `/admin/login`.
- `resend-agent-invite/index.ts` now reads `SITE_URL` from an env var (falls back to the old hardcoded domain if unset) instead of hardcoding it.

---

## A. Infrastructure — one-time setup (BUILD_GUIDE §13, revised for self-hosted n8n)

**Superseded 2026-08-13:** n8n is self-hosted inside the VPN, not Railway.
`BUILD_GUIDE.md` §13's Railway-specific steps (deploy container, attach
Postgres plugin, generate domain) don't apply — that infrastructure already
exists. A **reverse proxy exposes only the webhook path publicly** while the
n8n admin UI stays VPN-locked; only that public webhook URL goes to
Supabase, never the admin UI URL.

| # | Check | Status | Notes |
|---|---|---|---|
| A1 | n8n instance is up and reachable on the VPN (admin UI) | | already exists — confirm, don't build |
| A2 | Reverse proxy confirmed to forward **only** the webhook path (e.g. `/webhook/agent-invite`) publicly — admin UI, other endpoints stay VPN-only | | verify this is scoped narrowly, not a blanket public proxy to the whole n8n instance |
| A3 | The public webhook URL actually resolves from *outside* the VPN (test with `curl` from a machine/network not on the VPN, or an external tool) — Supabase's edge functions call it from Supabase's cloud, not from inside your network | | this is the step most likely to silently fail if the proxy/firewall rule is scoped wrong |
| A4 | n8n env vars set on the existing instance: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `N8N_INVITE_WEBHOOK_SECRET` | | |
| A5 | Both workflows imported/present (`agent-invite.json`, `agent-invite-error-handler.json`) — check if already imported before re-importing | | |
| A6 | SMTP credential attached to "Send Failure Alert Email" node (or explicitly skipped) | | |
| A7 | Error Workflow wired: Agent Invite → Agent Invite - Error Handler | | |
| A8 | Both workflows re-saved once, then toggled **Active** | | |
| A9 | Production webhook URL (through the reverse proxy, public form) copied — this is what becomes `N8N_INVITE_WEBHOOK_URL` on the Supabase side | | |
| A10 | Reverse proxy uses HTTPS (not plain HTTP) for the public webhook path — the invite payload includes name/email/phone, and the shared secret header, both should travel encrypted | | |
| A11 | Supabase secrets set: `N8N_INVITE_WEBHOOK_URL` (the A9 public URL), `N8N_INVITE_WEBHOOK_SECRET` (must match A4 exactly) | | |
| A12 | Supabase secret set (new): `SITE_URL` — the real public site URL, so `resend-agent-invite` links point to the right domain | | |
| A13 | Migration `20260805000000_agent_invite_failures.sql` applied | | |
| A14 | Edge function `send-agent-invite` deployed with current code | | |
| A15 | Edge function `resend-agent-invite` deployed with current code (picks up the `SITE_URL` fix) | | |
| A16 | Supabase → n8n connectivity smoke test: trigger `send-agent-invite` (or just `curl` the webhook URL with the shared-secret header from *outside* the VPN) and confirm n8n receives it, before running a real invite through the UI | | catches a wrong firewall rule/proxy scope before it looks like an "agent invite" bug |

## B. Happy path — new agent invited and activates

| # | Check | Status | Notes |
|---|---|---|---|
| B1 | Admin submits "Add New Agent" with a real test email → sees "Agent invited!" toast | | |
| B2 | Within a minute, `auth.users`, `profiles`, `user_roles` (`agent`), `agent_profiles` all have a matching row for the test email | | |
| B3 | Invite email arrives at the test inbox | | |
| B4 | Clicking the invite link lands on `/auth/callback` → "Welcome aboard, set a password" screen (not a blank/error screen) | | |
| B5 | Setting a password (≥8 chars, matching confirm) succeeds and redirects to `/portal/agent` | | |
| B6 | `profiles.password_set_at` is now set (not null) for that user | | |
| B7 | Log out, log back in via `/agent-login` with the new password → lands on `/portal/agent` | | |

## C. Failure / edge cases

| # | Check | Status | Notes |
|---|---|---|---|
| C1 | Inviting the same email twice → admin sees a clear "already invited" error, not a silent failure or duplicate rows | | |
| C2 | Admin clicks "Resend Invite" for a not-yet-activated test agent → a new email arrives and the link still works | | |
| C3 | Resend link points at the correct domain (confirms A13/the `SITE_URL` fix actually took effect) | | |
| C4 | Login attempt with wrong password → "Invalid email or password", no session created | | |
| C5 | Admin toggles a test agent `is_active = false` → that agent can no longer log in (`AgentLoginPage` blocks it) | | |
| C6 | Forgot-password flow from `/agent-login` → email arrives → reset → redirected to `/agent-login` (not `/admin/login`) — confirms the B2-labeled fix above | | |
| C7 | Expired/invalid reset link → `ResetPasswordPage` shows the "Link Expired" screen, not a crash | | |
| C8 | (Optional, destructive on purpose) Temporarily break one n8n step (e.g. disable the Upsert Agent Profile node) → confirm a row appears in `agent_invite_failures` and (if SMTP configured) an alert email arrives | | |

## D. Known gaps — not pass/fail, just confirm still true

These are documented in BUILD_GUIDE.md Part F as open items, not fixed as part of this pass. Confirm they still behave as described (i.e. nothing quietly changed):

| # | Check | Status | Notes |
|---|---|---|---|
| D1 | No bulk import exists for leads/properties/calendar — new agent's prior book of business still has to be re-keyed manually | | |
| D2 | No admin override to reassign a departed agent's leads/listings/viewings | | |
| D3 | No self-serve MFA | | |
| D4 | No self-serve profile completion (CEA no. etc. still admin-entered only) | | |

---

## How to run this

1. Work through **Section A** first — this is entirely you, in the Railway/n8n/Supabase dashboards. Report back after each subsection (or all at once) so I can verify the CLI-checkable parts (migration applied, function deployed, secrets present) from my side.
2. Once A is fully green, we run **B** together: you submit the invite form and relay back what you see at each step (toast text, email content, screen shown) — I can't see your inbox or your browser, so I'm relying on your reports to mark each row.
3. **C** and **D** follow once B is fully green.
4. Any **Fail** gets logged as a new dated entry in `BUILD_GUIDE.md`'s Progress Log, not silently fixed and forgotten.
