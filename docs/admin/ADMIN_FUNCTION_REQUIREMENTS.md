# Admin Function Requirements

Derived from `docs/copilot/COPILOT_CAPABILITY_MATRIX.md` §A, 2026-08-15. This is a
requirements/spec document — it names and describes required deterministic
functions so future work can be scoped and estimated. **No code is implemented
here.**

## Scope

Admin-domain functions only (Section A of the capability matrix). Existing
functions are listed for completeness/reference (see
`docs/system/EXISTING_FUNCTION_INVENTORY.md` for the authoritative inventory);
the emphasis here is on what's **required but missing**.

## Existing Functions (reference — already built, in `adminOperations.ts` / `marketInsights.ts`)

`setListingStatus`, `setListingFeatured`, `setAgentVisibility`, `setAgentActive`,
`resendAgentInvite`, `reviewApplication`, `setAgentAdminRole`, `updateAgentProfile`,
`saveMarketInsight`, `logAdminActivity`. All already enforce permission via RLS
(`has_role(auth.uid(),'admin')`), and all except `setAgentAdminRole`,
`updateAgentProfile`, and `saveMarketInsight` already have a matching Copilot tool.

## Required Functions — Level 1 (tool-wiring only, function already exists)

These three functions already exist and are already used by manual UI — they
just have no Copilot tool definition pointing at them yet. This is the
lowest-effort, lowest-risk category: no new deterministic logic needed, only
a tool schema + confirmation-card wiring in `AdminChatPanel.tsx`, mirroring
the pattern already used for the other 6 admin tools.

| Function (exists) | New tool needed | Permission | Risk | Confirmation | Audit |
|---|---|---|---|---|---|
| `setAgentAdminRole(agentId, enabled)` | `admin_set_agent_role` | admin | **High** — privilege escalation, should arguably require a stricter confirm (e.g. re-typing the agent's name) than the standard Confirm/Dismiss card | Required, elevated | Logged (already does) |
| `updateAgentProfile(agentId, profileUpdate, agentUpdate)` | `admin_update_agent_profile` | admin | Low–Medium | Required | Logged (already does) |
| `saveMarketInsight(id, form)` (3 distinct intents: publish toggle, feature toggle, reorder) | `admin_set_insight_published`, `admin_set_insight_featured`, `admin_reorder_insight` (3 separate tools, narrower than exposing the full form) | admin | Low | Required | Logged (already does, as of this session) |

**Design note**: `updateAgentProfile`'s tool schema needs care — it takes ~14
fields across two tables. Recommend the tool only accept the specific
field(s) the user mentioned (e.g. "change John's position to Senior
Associate") rather than requiring the LLM to supply the full form every
time, to avoid accidental overwrites of fields the user didn't mention.

## Required Functions — Level 2 (new deterministic query functions)

None of these exist today, even as manual-UI-only code — the admin pages'
"search" is `Array.filter` over data already fetched for a different purpose
(the full listings/agents dashboard payload), not a purpose-built query.
These are genuinely new functions, not just new tool wiring.

### `queryAgents(filters)`

- **Purpose**: server-side filtered agent lookup — `is_active`, `is_published`, `is_featured`, `agent_type`, `pendingInvite` (derived from `password_set_at IS NULL`), free-text name/email match.
- **Returns**: list of `{id, full_name, email, is_active, is_published, is_featured, ...}` — enough for the LLM to reference by name and for a follow-up L1 action to target by `id`.
- **Permission**: admin (RLS already allows this — `agent_profiles`/`profiles` admin-read policies exist).
- **Risk**: none (read-only).
- **Confirmation**: not required.
- **Audit**: not required (reads aren't logged today, consistent with existing pattern).
- **Enables**: "show inactive/suspended agents", "show unpublished agents", "which agents are not published on the Team page" (replacing today's unreliable prose-reading), and doubles as the entity-resolution step (`resolveAgentByName`, below) if given a `nameContains` filter.

### `queryListings(filters)`

- **Purpose**: server-side filtered listing lookup — `status`, `priceMax`/`priceMin`, `district`/`type`/`transactionType`, `is_featured`, free-text title match.
- **Returns**: list of `{id, title, status, price, is_featured, ...}`.
- **Permission**: admin.
- **Risk**: none (read-only).
- **Confirmation**: not required.
- **Audit**: not required.
- **Enables**: "show draft listings", "listings below $2M", and is a prerequisite building block for the Level 3 bulk-publish workflow and the Level 4 "which properties should we feature" recommendation.

### `queryApplications(filters)`

- **Purpose**: server-side filtered application lookup — `status` (pending/reviewing/interview/approved/declined), date range.
- **Returns**: list of `{id, full_name, email, status, current_agency, created_at, ...}`.
- **Permission**: admin.
- **Risk**: none (read-only).
- **Confirmation**: not required.
- **Audit**: not required.
- **Enables**: "show pending applications" as an ad hoc pull (today this data only exists pre-sliced to "top 5 urgent" inside `AdminOverview` — this function generalizes it), and gives the existing "which applications need attention first?" (currently Level 4-implemented-over-a-fixed-slice) something broader to reason over.

### `resolveAgentByName(name)` / `resolveListingByTitle(title)`

- **Purpose**: thin wrappers over `queryAgents`/`queryListings` with a name/title filter, returning a single best match (or a short disambiguation list if multiple match).
- **Why separate from the general query functions**: every existing L1 admin tool (`admin_set_agent_visibility`, `admin_set_listing_status`, etc.) requires an `agent_id`/`listing_id` today — the LLM currently has to already know the ID from context, which only works if the entity happens to already be in the pushed `AdminOverview` blob. Without a resolver, "suspend John Tan's account" only works by luck. This is arguably the single highest-leverage function in this whole document — it unblocks every existing L1 tool for name-based requests, not just new L2 features.
- **Permission/Risk/Confirmation/Audit**: same as the query functions (read-only, admin, no confirm, no audit).

## Required Functions — Level 3 (workflow orchestration)

All three Level 3 activities identified in the capability matrix depend on
the Level 2 query functions above as their first step, plus a genuinely new
piece of UI/interaction infrastructure: **bulk confirmation**. Today's
`AdminChatPanel.tsx` confirmation pattern (`pendingActions` cards) is built
for one action at a time — extending it to "here are the 6 listings that
match, confirm which to publish" is new work, not just new tool schemas.

| Workflow | Deterministic steps | New infra needed | Risk | Confirmation |
|---|---|---|---|---|
| Bulk publish listings matching criteria | `queryListings(criteria)` → loop `setListingStatus(id, "active")` | Bulk confirmation UI (itemized list, select/deselect before apply) | **High** | Required, itemized — do not auto-apply to every match without review |
| Bulk resend invites to pending agents | `queryAgents({pendingInvite: true})` → loop `resendAgentInvite(email)` | same bulk confirmation UI | Medium | Required, itemized |
| Batch application review | `queryApplications(criteria)` → loop `reviewApplication()` | same bulk confirmation UI | **High** (irreversible per-applicant decisions) | Required — recommend one-by-one confirm rather than true bulk-apply, given the stakes; the "workflow" value here is in *proposing* a batch, not in one-click executing it |

**Recommendation**: build the bulk-confirmation UI pattern once, generically,
rather than per-workflow — it's the shared piece of infrastructure all three
rows need, and it's reusable indefinitely as more bulk workflows are added
later.

## Required Functions — Level 4 (reasoning, blocked on data infrastructure)

- "Which properties should we feature this weekend?" is blocked only on `queryListings()` existing (above) plus a prompt that asks the LLM to reason over the returned engagement data (`view_count` already exists on `properties`) — no new *data* infrastructure needed, just the L2 function plus a reasoning prompt.
- "Why did enquiries drop?" is blocked on something that doesn't exist yet at all: a **time-series query function** over `property_enquiries`/`property_view_logs` (e.g. `queryEnquiryTrend({propertyId?, dateRange})` returning counts bucketed by day/week). This is new deterministic infrastructure, not just a new tool — today the schema only supports point-in-time counts, not trend queries. Scope this as its own function before attempting the L4 reasoning layer on top of it.

## Priority Ordering (suggested, not decided)

1. `resolveAgentByName` / `resolveListingByTitle` — unblocks every existing tool for natural name references, highest leverage for lowest effort.
2. Tool-wiring for the 3 already-existing functions (`admin_set_agent_role`, `admin_update_agent_profile`, insight tools) — no new logic, just schema + confirm-card wiring.
3. `queryAgents` / `queryListings` / `queryApplications` — unlocks most of Level 2 and is a prerequisite for every Level 3/4 row.
4. Bulk confirmation UI + the 3 Level 3 workflows — larger, riskier, do last and with extra care given the "High risk" rows involve irreversible batch actions.
5. Time-series query infrastructure for the enquiry-trend Level 4 case — standalone, can happen independently of the above at any point.
