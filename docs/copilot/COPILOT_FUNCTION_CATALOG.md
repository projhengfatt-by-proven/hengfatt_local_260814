# Copilot Function Catalog

Design pass, 2026-08-15. The Copilot-specific adapter layer that sits on top
of `docs/admin/ADMIN_ACTION_CATALOG.md`. **Nothing here duplicates business
logic** — every tool either maps 1:1 to an action-layer function, or (for
Level 4 only) reasons over data an action-layer query function already
returned. This document is a spec, not an implementation.

## Design Rule

A Copilot tool is **never** allowed to contain write logic of its own. Its
job is: (1) declare an input schema the LLM can fill in, (2) get confirmed
by the user, (3) call the matching action-layer function from
`docs/admin/ADMIN_ACTION_CATALOG.md`, (4) report the result back into the
conversation. If a proposed tool would need logic beyond "call this one
action function," the logic belongs in the action layer as a new function,
not inline in the tool executor (`AdminChatPanel.tsx`'s `executeAction()`).

## Existing Tools (7) — already correctly wired, listed for completeness

| Tool | Maps to | Confirmation | Entity resolution needed today |
|---|---|---|---|
| `admin_navigate` | `navigateTo(section)` (not an action-layer function — pure client-side nav) | No | No |
| `admin_set_agent_visibility` | `setAgentVisibility()` | Yes | **Yes, but missing** — requires `agent_id` the LLM must already have from context |
| `admin_set_agent_active` | `setAgentActive()` | Yes | Yes, missing (same as above) |
| `admin_resend_agent_invite` | `resendAgentInvite()` | Yes | No (takes `email` directly, not an ID) |
| `admin_set_listing_status` | `setListingStatus()` | Yes | Yes, missing — requires `listing_id` |
| `admin_set_listing_featured` | `setListingFeatured()` | Yes | Yes, missing |
| `admin_review_application` | `reviewApplication()` | Yes | Yes, missing — requires `application_id` |

**The "entity resolution needed today" column is the key finding**: five of
the seven existing tools require an ID the LLM can only supply correctly if
it happens to already be present in the `AdminOverview` context blob pushed
into the system prompt. There is no resolver tool today — see below.

## New Tools Required

### Entity Resolution (prerequisite for everything else — highest priority)

#### `admin_find_agent`

- **Maps to**: `resolveAgentByName(nameQuery)`.
- **Input schema**: `{ nameQuery: string }`
- **Purpose (LLM-facing description)**: "Look up an agent's ID by name or partial name, when the user refers to an agent by name rather than an exact ID. Call this before any tool that requires agent_id if you don't already have it."
- **Confirmation**: No — read-only.
- **Output surfaced to LLM**: either a single `{id, full_name}` (LLM proceeds directly to the next tool call) or a `candidates` list (LLM must ask the user to disambiguate before proceeding — the system prompt must instruct this explicitly, since nothing stops the LLM from guessing the first candidate otherwise).

#### `admin_find_listing`

- **Maps to**: `resolveListingByTitle(titleQuery)`.
- Same shape as `admin_find_agent`, for listings.

### Level 1 — tool wrappers for existing-but-unwired functions

#### `admin_set_agent_role`

- **Maps to**: `setAgentAdminRole(agentId, enabled)`.
- **Input schema**: `{ agent_id: string, enabled: boolean }`
- **Confirmation**: Yes — **elevated**. Given the High-risk classification (privilege escalation) established in the action catalog, the confirmation card for this specific tool should be visually distinct from the standard pattern (e.g. require the admin to also see the target agent's name/email rendered plainly, not just accept a generic "Confirm" click) — a UI-level recommendation, not a function-layer one.

#### `admin_update_agent_profile`

- **Maps to**: `updateAgentProfile(agentId, partialUpdate)` — **depends on the partial-update refactor** noted in the action catalog; do not wire this tool against the current full-replace signature, or a request like "change John's position" risks the LLM omitting/nulling fields it wasn't told to change.
- **Input schema**: `{ agent_id: string, fields: { full_name?, phone?, position?, agent_type?, years_experience?, specialisations?, languages?, whatsapp_no?, email_display?, linkedin_url?, bio_en?, bio_zh?, display_order? } }` — all fields optional, only supplied fields are changed.
- **Confirmation**: Yes.
- **Note**: `is_published`/`is_featured` are deliberately excluded from this tool's schema — those already have their own dedicated, better-scoped tool (`admin_set_agent_visibility`). Avoid schema overlap between tools that could both touch the same field, since that creates ambiguity in which tool the LLM should pick.

#### `admin_set_insight_published` / `admin_set_insight_featured` / `admin_reorder_insight`

- **Map to**: `setInsightPublished()`, `setInsightFeatured()`, `reorderInsight()` respectively.
- **Input schemas**: `{ insight_id: string, published: boolean }`, `{ insight_id: string, featured: boolean }`, `{ insight_id: string, display_order: number }`.
- **Confirmation**: Yes, all three (Low risk, but still a public content change).
- **Entity resolution**: needs an `admin_find_insight` resolver, same pattern as agents/listings — not designed in detail here since Market Insights wasn't in the original three-tool gap list, but the same rule applies: any tool requiring an `insight_id` needs a name-based resolver alongside it, or it inherits the same "only works if already in context" problem as the five existing tools above.

### Level 2 — query tools

#### `admin_query_agents` / `admin_query_listings` / `admin_query_applications`

- **Map to**: `queryAgents()`, `queryListings()`, `queryApplications()`.
- **Input schemas**: mirror the filter shapes defined in the action catalog for each.
- **Confirmation**: No — read-only.
- **Purpose (LLM-facing)**: these are how "show me all inactive agents" / "listings below $2M" / "pending applications" get answered with real filtered data instead of the LLM reading the static context blob and guessing. The system prompt should be updated to prefer these tools over answering from memory whenever the request implies a filter the pushed context doesn't already cover.
- **Output surfaced to LLM**: the filtered list, which the LLM then summarizes conversationally — no further tool call needed unless the user follows up with an action on a specific result (in which case the LLM already has the `id` from this response, no separate resolver call needed for that turn).

### Level 3 — workflow tools

#### `admin_bulk_publish_listings`

- **Maps to**: `bulkPublishListings(criteria, confirmed)`.
- **Two-step interaction, not a single tool call**: (1) LLM calls `admin_query_listings(criteria)` first and presents the itemized candidate list in chat, (2) only after the user explicitly approves that specific list does the LLM call `admin_bulk_publish_listings` with the same criteria. The system prompt must state this two-step requirement explicitly — a single tool call that both queries and executes in one step would violate the "itemized preview required" rule from the action catalog.
- **Confirmation**: Yes, itemized (per above).

#### `admin_bulk_resend_invites`

- **Maps to**: `bulkResendInvites(criteria, confirmed)`. Same two-step pattern as above, with extra emphasis in the system prompt that this sends real emails and is not safely retryable.

#### `admin_batch_review_applications`

- **Maps to**: `batchReviewApplications(criteria, decisions, confirmed)`.
- **Three-step interaction**: (1) LLM calls `admin_query_applications(criteria)`, (2) LLM reasons over the results and proposes a `decisions` list (this step is genuinely Level 4 — see below, it's where AI judgement enters), (3) user reviews and confirms — recommended per-item given the High risk classification — before the LLM calls `admin_batch_review_applications` with the approved decisions.
- **This is the one workflow tool where step 2 requires real reasoning**, not just deterministic filtering — worth calling out because it's easy to mis-classify the whole activity as "just a workflow" when part of it is actually Level 4.

## Level 4 — Reasoning Functions (not action-layer functions; read-only, AI-required)

These are **not** part of `docs/admin/ADMIN_ACTION_CATALOG.md` because they
inherently call the LLM to produce their output — they cannot exist without
AI and therefore don't belong in a layer meant to be usable by a plain
non-AI API consumer. They **do** reuse action-layer query functions as their
data source, so business logic (the query itself) is still not duplicated —
only the reasoning step is Copilot-specific.

### `recommendFeaturedListings()`

- **Data source**: `queryListings({ status: "active" })` (existing query function, reused).
- **Reasoning**: LLM ranks the returned listings by `view_count`/recency/other signals present in the query result and produces a short recommendation with rationale.
- **Output**: conversational text + optionally a set of suggested `admin_set_listing_featured` tool calls the user can then individually confirm — the recommendation itself never writes anything.
- **Confirmation**: N/A for the recommendation; each resulting feature action still goes through the normal `admin_set_listing_featured` confirm flow.
- **Status**: new — blocked only on `queryListings` existing, no new data infrastructure needed.

### `explainEnquiryTrend(propertyId?, dateRange)`

- **Data source**: `queryEnquiryTrend()` (new action-layer function, see action catalog — this is the one L4 case blocked on new deterministic infrastructure, not just a new reasoning wrapper).
- **Reasoning**: LLM interprets the time-bucketed counts and produces an explanation ("enquiries dropped 40% in the last two weeks, coinciding with...").
- **Output**: conversational text only, no tool calls result from this.
- **Status**: new, and the higher-effort of the two L4 functions since its data source doesn't exist yet either.

### Already-implemented conversational capabilities (zero new functions needed)

"Explain the latest activity log entry," "summarise today's dashboard," and
"which applications need attention first?" (over the existing fixed
precomputed slice) are **already working today** purely through the system
prompt + the `AdminOverview` context blob — no tool, no function, nothing to
build. Listed here only so they aren't mistakenly re-scoped as new work; the
one enhancement worth making is wiring `admin_query_applications` in so
"which applications need attention" can reason over the *full* set on
request, not just the pre-picked top-5 urgent slice — but that's the L2 tool
above doing the work, not a new L4 function.

## Summary: Tool Count

| Level | Existing tools | New tools required |
|---|---|---|
| L1 (direct function) | 6 (excl. `admin_navigate`) | 6 (`admin_set_agent_role`, `admin_update_agent_profile`, 3× insight tools, plus `admin_navigate` already covers nav) |
| Entity resolution | 0 | 2 (`admin_find_agent`, `admin_find_listing`; a 3rd for insights if pursued) |
| L2 (query) | 0 | 3 (`admin_query_agents`, `admin_query_listings`, `admin_query_applications`) |
| L3 (workflow) | 0 | 3 (`admin_bulk_publish_listings`, `admin_bulk_resend_invites`, `admin_batch_review_applications`) |
| L4 (reasoning, not tools) | 3 (conversational, no function) | 2 (`recommendFeaturedListings`, `explainEnquiryTrend`) |

Total new Copilot-facing surface: **14 new tools/functions**, all of which
(except the two L4 reasoning functions) map to a corresponding entry already
specified in `docs/admin/ADMIN_ACTION_CATALOG.md` — confirming the design
goal that Copilot adds no business logic of its own, only conversational
plumbing around the same action layer Manual UI already uses.
