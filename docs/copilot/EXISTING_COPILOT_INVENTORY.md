# Existing Copilot ("ARIA") Inventory

Discovery pass, 2026-08-15. Read-only survey of the current AI assistant architecture.

## What It's Called / Where It Lives

Internally referred to as **ARIA** in code (`ariaClient.ts`, "ARIA" label in UI). Two front-ends share the same backend:
- **Admin Copilot**: `src/pages/admin/AdminCopilotPage.tsx` + `src/components/admin/command/AdminChatPanel.tsx` (rebuilt this session into a chat-left/scene-right split).
- **Agent Copilot**: `src/pages/AgentCommand.tsx` + `src/components/command/AIChatPanel.tsx` (the pre-existing, more mature implementation).

## How It Understands Requests

- **No universal intent classifier.** Claude's native tool-use (function calling) is the primary mechanism on both paths.
- A **separate** embedding-based intent classifier (`classify-intent` edge function, OpenAI `text-embedding-3-small`, cosine similarity against static example phrases in `src/lib/intentPacks/`) exists but is used **only by the agent-portal chat** (`AIChatPanel.tsx:551`) as a fast-path shortcut before falling through to the LLM. The admin Copilot never calls it.

## Tools / Functions

Model: `claude-sonnet-5`, streamed SSE, `max_tokens: 2048` (`supabase/functions/aria-chat/index.ts`). Tool set is selected by `assistantRole` ("admin" | "agent").

### ADMIN_TOOLS (7) — `supabase/functions/aria-chat/tools.ts:219-317`

| Tool | Purpose |
|---|---|
| `admin_navigate` | Navigate admin sections. Screen enum: `dashboard, agents, add_agent, activity, listings, insights, applications, reports, settings, copilot` (fixed this session — `insights` was previously missing). |
| `admin_set_agent_visibility` | Propose `is_published`/`is_featured` change for an agent. |
| `admin_set_agent_active` | Propose activate/suspend for an agent. |
| `admin_resend_agent_invite` | Propose resending an invite/reset email. |
| `admin_set_listing_status` | Propose `active`/`draft` status change. |
| `admin_set_listing_featured` | Propose feature/unfeature a listing. |
| `admin_review_application` | Propose an application status change + notes. |

**Gaps**: no tool for `setAgentAdminRole` (grant/revoke admin — exists in `adminOperations.ts`, unreachable via chat), none for Market Insights CRUD, none for bulk actions, search, notifications, or settings (none of those exist as features at all — see `docs/system/MISSING_CAPABILITY_REPORT.md`).

### ARIA_TOOLS (13, agent role) — `supabase/functions/aria-chat/tools.ts:6-217`

`lead_create`, `lead_update_status`, `lead_draft_message` (drafts only — the system prompt and implementation both confirm it never sends), `viewing_book`, `viewing_reschedule`, `viewing_update_status`, `viewing_lookup` (read-only), `task_create`, `task_complete`, `lead_view` (read-only nav), `lead_reassign` (creates a *pending* `lead_shares` invite, not an instant transfer), `folder_create`, `screen_navigate` (scene enum: `dashboard, leads, lead_detail, listings, listing_detail, listing_form, calendar, viewing_detail, crm, commission_calc, market, social, documents, templates, notifications, files`).

**Gap**: no tool exists to *accept* a `lead_reassign` share (only a manual "Accept" button in `LeadsScene.tsx` calls `acceptLeadShare()`), no chat-driven folder rename/delete or file notes (only create), no chat-driven listing delete.

## How Tool Calls Execute

**LLM proposes, client executes.** The edge function's system prompt (`prompt.ts`) explicitly frames every write as a proposal — "treat every write as a proposal until the UI confirms it" (admin prompt, `prompt.ts:30-31`). The edge function itself never touches application tables; it only proxies the Anthropic SSE stream back, including any `tool_use` blocks, as `toolCalls[]`.

Execution happens **entirely in the browser**:
- Admin: `AdminChatPanel.tsx`'s `executeAction()` switches on tool name and calls the matching `adminOperations.ts` function, after the user clicks **Confirm** on a pending-action card. `admin_navigate` is the one exception — applied immediately, no confirmation step.
- Agent: `AIChatPanel.tsx` has an equivalent switch covering all 13 tools, calling the matching shared operation module (`leadOperations.ts`, `viewingOperations.ts`, `taskOperations.ts`, `leadShareOperations.ts`) — except `folder_create`, which inserts into `agent_files` inline rather than through a shared function (see `docs/system/DUPLICATE_LOGIC_REPORT.md`).

## Permission Enforcement

- **Server-side, admin path only**: `aria-chat/index.ts:86-98` resolves the caller via the `Authorization` header, queries `user_roles` for `role = 'admin'`, and returns 403 *before* even sending the admin tool list or system prompt to Anthropic if the check fails.
- **Server-side, agent path**: **no equivalent check exists.** Any caller (authenticated as any role, or per the audit possibly unauthenticated) can retrieve the full `ARIA_TOOLS` list and a streamed completion. This is a real asymmetry — flagged here, not fixed (out of scope for the admin-focused work done this session).
- **The real backstop either way is Postgres RLS** — every table a tool could write to has `has_role(auth.uid(), 'admin')` (admin) or `auth.uid() = agent_id`/`user_id` (agent) policies, so a forged/bypassed client call would still be rejected by the database regardless of what the edge function did or didn't check.

## Confirmation

- Admin: explicit Confirm/Dismiss cards for every write-capable tool call except `admin_navigate`.
- Agent: equivalent confirm pattern in `AIChatPanel.tsx` for write tools; read/navigate tools (`viewing_lookup`, `lead_view`, `screen_navigate`) apply immediately.

## Audit

- Admin-side writes made via Copilot flow through the same `adminOperations.ts` functions as the manual UI, so they land in `admin_activity_log` identically either way (confirmed: single writer, `logAdminActivity()`).
- Agent-side writes made via Copilot flow through the shared operation modules (`leadOperations.ts` etc.), which do **not** write to any audit-log table — there is no cross-role unified audit trail. (`file_activity_log` covers file operations specifically, written by `useFileOperations.ts`, but `folder_create` via chat bypasses even that.)

## Errors

- `ariaClient.ts` distinguishes 401/403 ("couldn't authenticate"), 429 ("rate limit"), 529 ("AI temporarily overloaded"), and a generic connection-failure/mid-stream-error case (`streamARIA`, `supabase/functions/aria-chat` proxy) — all surfaced via `toast()` in both chat panels.

## Context Passed to the Model

- **Admin**: rich structured context (`AdminOverview` — counts, pending invites, urgent applications, draft listings, recent activity), built by `fetchAdminOverview()`/`formatAdminContext()`.
- **Agent**: 4 flat counters (`listingsCount`, `leadsCount`, `viewingsTodayCount`, `pipelineValue`) plus up to 50 `agent_memory` key/value rows — materially less rich than the admin context; the agent tools instead do live lookups (`viewing_lookup`, `lead_view`) rather than relying on proactively-pushed context.
- Both: a per-request dynamic block adds current Singapore date/time (`index.ts:131-137`).

## AI Model Usage

Single model (`claude-sonnet-5`) for both roles' conversational/tool-use path. `classify-intent` uses a separate OpenAI embedding model (`text-embedding-3-small`) for the agent-only fast-path intent shortcut. No other AI/LLM usage found elsewhere in the codebase (e.g. `analyse-agent-files` edge function likely does its own AI classification of uploaded documents — not deeply audited here, out of Copilot scope proper).

## Known Issues (status as of 2026-08-15)

- ~~`admin_navigate` screen enum missing `insights`, `copilot` case silently no-op~~ — **fixed this session**, requires `supabase functions deploy aria-chat` to go live (not yet deployed).
- Agent-role edge function has no server-side permission check — **not fixed**, flagged for a separate ticket.
- `folder_create` duplicated between `AIChatPanel.tsx`'s inline insert and `FilesScene.tsx`'s `confirmCreateFolder()`, with two different slug functions and different insert payloads — **not fixed**, see `docs/system/DUPLICATE_LOGIC_REPORT.md`.
