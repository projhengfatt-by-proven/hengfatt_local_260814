# Project Context — HengFatt Property

**Purpose:** Singapore real-estate agency SaaS — public marketing site +
member/client portal + agent portal (with an AI command-center, "ARIA") +
admin panel. Originally scaffolded via Lovable.dev, now continued with
Claude Code.

**Architecture:** SPA + Supabase backend (BaaS), no separate server process.
Automation (agent-invite orchestration, planned WhatsApp/notification
pipelines) runs in n8n, called from Supabase Edge Functions.

**Stack:**
- Frontend: Vite + React + TypeScript, Tailwind CSS, shadcn/ui, react-router-dom, react-hook-form + zod.
- Backend: Supabase — Postgres, Auth (GoTrue), RLS, Edge Functions (Deno), Storage.
- Automation: n8n (self-hosted inside a VPN, reverse-proxied — the instance itself already exists; the Supabase-side connection is what's still pending — see project-status.md and `ONBOARDING_CHECKLIST.md`).
- Testing: Vitest (`src/test/`).
- Design tokens: navy `hsl(213 52% 11%)`, gold `hsl(42 52% 54%)`, cream `hsl(36 33% 93%)`; Playfair Display (headings) + DM Sans (body) — defined in `src/index.css` / `tailwind.config.ts`. Reuse these, don't invent new ones.

**Database:** 29 tables across 9+ migrations (`supabase/migrations/`). Key
tables: `profiles`, `user_roles`, `agent_profiles`, `leads`, `lead_shares`,
`properties`/listings, `viewings`, `agent_files`, `agent_invite_failures`,
plus several live-but-dormant tables (`whatsapp_messages`,
`unanswered_queries`, `notifications`, `social_*`, `market_reports`) whose
frontend/consumer code doesn't exist yet.

**Authentication:** Supabase Auth. Two login surfaces — `/agent-login`
(agent + admin) and `/admin/login`. Agents are **invite-only**, created by an
admin via `send-agent-invite` → n8n → GoTrue `/invite`. No self-serve
sign-up exists for agents (by design) or for members/clients (a known gap —
`/portal/member` has no login/registration page in front of it at all).

**Authorization:** Role-based via `user_roles` table (`agent`/`admin`) +
Postgres RLS policies per table. Never trust a frontend role check alone —
every access path needs its own RLS policy or Edge Function auth check (see
`lead_shares`'s RLS in `20260810000000_lead_reassignment.sql` for the
project's most carefully-reasoned example, including WITH CHECK vs USING
subtleties).

**AI ("ARIA"):** In-app chat command center for agents
(`src/components/command/`) with a tool-dispatch pattern — every user-facing
activity must be reachable both by a manual UI control and by an ARIA tool
call using the *same* shared "operations" module (`src/components/command/scenes/*Operations.ts`).
This "dual-execution" rule is this project's core architectural constraint —
see `BUILD_GUIDE.md` §17. A separate `aria-whatsapp` Edge Function exists
live in Supabase (deployed, but its source isn't in this repo and nothing
currently calls it — see `BUILD_GUIDE.md` §13b item 2).

**Integrations:** n8n (agent invite orchestration; WhatsApp/notifications
pipelines designed but not built — `BUILD_GUIDE.md` §13b). No payment/billing
integration exists.

**Deployment:** Not yet a git repository (`.git` doesn't exist in this
folder as of this writing). Originally deployed via Lovable's platform
(`hengfattproperty.lovable.app`); no separate CI/CD pipeline observed.

**Major constraints:**
- `BUILD_GUIDE.md` is the project's single source of truth for what's
  built/placeholder and the agreed build order — read it before proposing
  new pages or features.
- Every new activity must satisfy the dual-execution rule (manual UI + ARIA
  tool), or it's incomplete by this project's own definition of "done."
- n8n itself is not live yet (secrets never set) — see project-status.md.
