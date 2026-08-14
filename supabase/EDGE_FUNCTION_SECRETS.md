# Supabase Edge Function Secrets

Use this as the source-of-truth checklist for the Supabase side of the app.
Do not commit secret values into the repo.

## Already available by default in Edge Functions

Supabase Edge Functions already expose `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, and related built-in keys/secrets by default. Use
those in functions instead of inventing new copies. If you need custom values,
set them as project secrets. See the Supabase secrets docs. citeturn1search0turn1search1

## Custom secrets this project still needs

- `SITE_URL`
  - Used by invite and password-reset emails.
  - Must match the production site URL that Supabase Auth should use for redirects. citeturn0search0turn0search4
- `N8N_INVITE_WEBHOOK_URL`
  - Used by `send-agent-invite` to forward admin invites to n8n.
- `N8N_INVITE_WEBHOOK_SECRET`
  - Shared secret that protects the n8n invite webhook.
- `ANTHROPIC_API_KEY`
  - Used by `aria-chat` for the admin/agent AI assistant.

## Auth URL settings to verify

- Set the Supabase Auth `Site URL` to the production domain.
- Add the production domain and any allowed preview URLs to the redirect allow
  list.
- `redirectTo` only works when the URL is on the allow list; otherwise Supabase
  falls back to the Site URL. citeturn0search0turn0search3turn0search5

## Recommended production setup

1. Add the secrets in Supabase Dashboard:
   - Project Settings -> Edge Functions -> Secrets
2. Or push them from a local env file with:
   - `supabase secrets set --env-file <file>`
3. Keep browser-safe values in `.env` / Vite env vars only.
4. Keep secret values out of Git.

## Functions that depend on these secrets

- `send-agent-invite`
- `resend-agent-invite`
- `admin-set-user-role`
- `aria-chat`

