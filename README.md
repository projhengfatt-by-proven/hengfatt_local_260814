# HengFatt Property

Originally scaffolded via Lovable.dev; **Lovable is no longer used for this
project as of 2026-08-14** — hosting moved to Vercel, source of truth is now
the `projhengfatt-by-proven/hengfatt_local_260814` GitHub repo. The sections
below reflect that current setup, not the original Lovable-only workflow.

## Project info

- **Live site**: https://hengfatt-local-260814-bgch.vercel.app/
- **Repo**: `projhengfatt-by-proven/hengfatt_local_260814` (GitHub, private)
- **Hosting**: Vercel (project `hengfatt_byProven`) — auto-deploys on every push to `main`; other branches/PRs get their own Preview URL
- **Backend**: Supabase (see `BUILD_GUIDE.md` for the full architecture)

## How can I edit this code?

Clone the repo and work locally — the only requirement is Node.js & npm
installed ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

```sh
git clone git@github.com:projhengfatt-by-proven/hengfatt_local_260814.git
cd hengfatt_local_260814
npm i
npm run dev
```

Copy `.env`'s 3 `VITE_`-prefixed variables from the Vercel project's
Environment Variables settings (or ask whoever has them) — `.env` is
gitignored and never committed.

## What technologies are used for this project?

- Vite, TypeScript, React, shadcn-ui, Tailwind CSS
- Supabase (Postgres, Auth, Storage, Edge Functions)
- Deployed on Vercel; see `vercel.json` for the SPA rewrite config this
  client-side-routed app needs

## How can I deploy this project?

Push to `main` — Vercel deploys automatically. To deploy manually or check
build settings, see the project on Vercel's dashboard under the
`hengfatt_byProven` team.

## Custom domain

Vercel Dashboard → this project → Settings → Domains → Add. Once a real
custom domain is added, remember to also update Supabase Auth's `site_url`
and the `SITE_URL` Edge Function secret to match (see `BUILD_GUIDE.md`'s
Progress Log, 2026-08-14 entries, for why those need to stay in sync).

## Known items — to revisit later

**`aria-whatsapp` edge function (deployed on Supabase, not present anywhere in this repo)** — found while auditing ARIA on 2026-08-12. It's a second, independent AI assistant, separate from the agent-facing Command Center ARIA this repo builds (no connection to `classify-intent`, `aria-chat`, `tools.ts`, or `ariaClient.ts`). It answers `{phone, name, message, conversation_history}` requests with a Singapore real-estate sales persona, pulls active listings + open viewing slots + `rag_documents` for context, and calls Claude directly (hardcoded fallback: `claude-opus-4-6` → `claude-haiku-4-5-20251001` — the first model ID is unverified/possibly invalid).

**Working theory (not yet confirmed):** this may be intended to serve the *public* — e.g. an unauthenticated visitor sign-up flow or a VIP public-facing concierge — rather than logged-in agents, which would explain why it's structured so differently from the portal's ARIA and why it isn't wired into anything in this codebase.

**Known gaps if this is kept/built out further:**
- No caller found anywhere in this repo — likely triggered externally (WhatsApp Business API/Twilio/no-code tool), so it's currently unmanaged from here.
- It doesn't take real actions — it guesses "lead" and "booking" intent from keyword matches on the visitor's message and on the AI's own reply text, rather than calling real tools (unlike the portal ARIA's tool-calling approach).
- Uses the Supabase service-role key (full DB access, bypassing RLS) — appropriate for an unauthenticated public endpoint, but means bugs here have a large blast radius.
- Its system prompt includes a sales-tactics instruction ("mention genuine interest from other buyers if applicable") worth reviewing deliberately before this becomes a real public-facing surface.

**Revisit:** once the agent-side Command Center ARIA work is done, and when the site takes on public/VIP user accounts.
