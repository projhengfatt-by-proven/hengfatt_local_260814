# Page Groups Reference

This file is a quick overview of the app by page group so we can see the
purpose of each area, what belongs there, and what is still incomplete.
Use this as a working reference alongside `BUILD_GUIDE.md`, `README.md`,
and `src/App.tsx`.

## 1. Public Pages

Purpose:
- Present the company to anonymous visitors.
- Let visitors browse properties and read basic agency content.
- Provide a public entry point into the agent application flow.

Pages:

| Page | Purpose | Remarks |
|---|---|---|
| Home | Main marketing landing page. | Public-facing, complete enough to act as the front door. |
| About | Company introduction. | Placeholder-style content may still exist. |
| Team | Show the team / agents. | Public team visibility depends on agent records. |
| Properties | Public property listing index. | Main public listing browse page. |
| Property Detail | Full property page for one listing. | Public listing detail view. |
| Insights | Blog / market insight index. | Live content list driven by `market_reports`. |
| Insight Detail | Single insight/article page. | Public detail page for one market insight. |
| Services | Agency services page. | Public marketing page. |
| Contact | Contact / enquiry page. | Public lead capture entry point. |
| Agent Application | Invite or application entry point for agents. | Starts the agent onboarding flow. |
| Member Portal | Logged-in member landing page. | Present as a route, but currently a placeholder. |
| 404 / Not Found | Catch-all for invalid routes. | Shared by the whole app. |

## 2. Agent Portal

Purpose:
- Let agents manage their own work after sign-in.
- Support both the manual UI and the ARIA command-center flow.
- Keep agent operations scoped to the signed-in agent.

Pages:

| Page | Purpose | Remarks |
|---|---|---|
| Agent Login | Sign in for agents. | Also allows admin login behavior today, but has its own entry point. |
| Auth Callback | Handles invite login, password setup, and recovery flows. | Critical auth handoff page. |
| Reset Password | Set a new password after recovery. | Shared recovery destination. |
| Agent Portal / Command Center | Main agent workspace. | Core agent area. |
| Listings | Agent-managed listing list. | Exists in the command-center area and in a standalone route. |
| New Listing | Create a new listing. | Manual create flow. |
| Edit Listing | Edit an existing listing. | Manual update flow. |
| Dashboard | Agent overview / summary. | In the command-center scenes. |
| Leads | Lead management. | In the command-center scenes. |
| Listing Detail | Detailed view for one listing. | In the command-center scenes. |
| Listing Form | Listing create/edit form. | In the command-center scenes. |
| Commission | Commission tracking / calculations. | In the command-center scenes. |
| Files | File management for agent assets. | In the command-center scenes. |
| Social | Social-related activity. | Placeholder. |
| Notifications | Notification center. | Placeholder. |
| Market | Market / insights workspace. | Still a placeholder in the agent command center. |

Remarks:
- This area follows the project’s dual-execution rule: manual UI plus ARIA tool path.
- The standalone listings pages and the command-center scenes both exist, so we should keep watching for duplication.
- `/portal/agent/setup` is referenced in code but is not a real route yet.

## 3. Admin Portal

Purpose:
- Let staff manage agents, listings, and platform operations.
- Control public team visibility and listing feature status.
- Review logs and future admin reporting.

Pages and activities:

| Admin Area | Purpose | Remarks |
|---|---|---|
| Dashboard | Admin landing page. | Overview / landing panel. |
| Copilot | Admin AI helper. | Read-first assistant with confirmation-gated writes. |
| Agents | Manage all agents. | Main admin area for people management. |
| Add Agent Form | Inline create form on the Agents page. | Creates the account and sends the invite from the same screen. |
| Agent List | View all agents. | Used to decide who appears on the Team page and Home page, edit agent information, resend invites, and open the create form. |
| Activity Log | Show admin actions and notable events. | Already present as a dedicated page. |
| Listings | Admin view of all listings. | Used to review and manage public listings. |
| Listing List | Browse listings as an admin. | Should support filtering by `All`, `Active`, and `Draft`. |
| Featured Selection | Decide which listings are featured publicly. | Controls public-page promotion. |
| Market Insights | Manage public insight cards and links. | Admin can create, edit, publish, and unpublish insight entries. |
| Applications | Review agent applications. | Queue view with status changes, admin notes, and review decisions. |
| Reports | Admin reports and summaries. | Operational report with visibility ratios and backlog counts. |
| Settings | Admin configuration. | Reference page for visibility rules, onboarding rules, and source-of-truth notes. |

Admin remarks:
- `Dashboard`, `Copilot`, `Agents`, `Agent List`, `Activity Log`, `Listings`, `Market Insights`, `Applications`, `Reports`, and `Settings` are now the main admin sections.
- The agent list is not just informational; it also affects public visibility on the Team page and Home page.
- The add-agent flow should stay aligned with the invite pipeline so account creation and invitation remain one operation.
- The Admin Copilot is intentionally read-first: write actions should always require explicit confirmation before they run.

## 4. Quick Incomplete Checklist

This is the short version of what still needs attention:

- Member/client portal is still only a placeholder route.
- Agent command-center placeholders remain for Social, Notifications, and Market.
- `/portal/agent/setup` is referenced but not built.
- Admin Applications, Reports, Settings, and Market Insights should keep growing as the content model matures.
- We should keep documenting which pages are source-of-truth versus placeholder as the build grows.
