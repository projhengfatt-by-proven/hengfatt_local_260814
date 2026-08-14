# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Known items — to revisit later

**`aria-whatsapp` edge function (deployed on Supabase, not present anywhere in this repo)** — found while auditing ARIA on 2026-08-12. It's a second, independent AI assistant, separate from the agent-facing Command Center ARIA this repo builds (no connection to `classify-intent`, `aria-chat`, `tools.ts`, or `ariaClient.ts`). It answers `{phone, name, message, conversation_history}` requests with a Singapore real-estate sales persona, pulls active listings + open viewing slots + `rag_documents` for context, and calls Claude directly (hardcoded fallback: `claude-opus-4-6` → `claude-haiku-4-5-20251001` — the first model ID is unverified/possibly invalid).

**Working theory (not yet confirmed):** this may be intended to serve the *public* — e.g. an unauthenticated visitor sign-up flow or a VIP public-facing concierge — rather than logged-in agents, which would explain why it's structured so differently from the portal's ARIA and why it isn't wired into anything in this codebase.

**Known gaps if this is kept/built out further:**
- No caller found anywhere in this repo — likely triggered externally (WhatsApp Business API/Twilio/no-code tool), so it's currently unmanaged from here.
- It doesn't take real actions — it guesses "lead" and "booking" intent from keyword matches on the visitor's message and on the AI's own reply text, rather than calling real tools (unlike the portal ARIA's tool-calling approach).
- Uses the Supabase service-role key (full DB access, bypassing RLS) — appropriate for an unauthenticated public endpoint, but means bugs here have a large blast radius.
- Its system prompt includes a sales-tactics instruction ("mention genuine interest from other buyers if applicable") worth reviewing deliberately before this becomes a real public-facing surface.

**Revisit:** once the agent-side Command Center ARIA work is done, and when the site takes on public/VIP user accounts.
