# Copilot Capability Matrix

Classification pass, 2026-08-15. Every meaningful admin activity (from
`docs/admin/ADMIN_ACTIVITY_INVENTORY.md`) and every existing/relevant Copilot
activity (from `docs/copilot/EXISTING_COPILOT_INVENTORY.md` and
`docs/system/EXISTING_FUNCTION_INVENTORY.md`) classified into exactly four
levels. Natural language does not imply Level 4 — deterministic code is used
wherever the activity is actually deterministic; Level 4 is reserved for
genuine recommendation/comparison/summarization/explanation/analysis.

## Level Definitions

- **L1 — Direct Function**: one deterministic function executes the activity. No AI reasoning required (AI may still *parse* the request into a function call, but performs no judgement).
- **L2 — Query / Structured Interpretation**: natural language → intent + entity + filters/parameters → deterministic code performs the operation (a read, not a judgement).
- **L3 — Workflow**: multiple deterministic functions coordinated in sequence/condition, still no subjective judgement.
- **L4 — AI Reasoning**: genuinely requires recommendation, interpretation, comparison, summarization, explanation, or analysis that deterministic code cannot produce.

## Column Legend

`AI` = None (no LLM involvement needed at all) / Parse-only (LLM just extracts a function call or filter, no judgement) / Required (LLM must reason/generate). `Intent`/`Entity`/`Workflow` = Yes/No, whether that stage is needed. `Status` = Implemented / Partial / Missing.

---

## SECTION A — Admin Copilot Activities

### Level 1 — Direct Function

| Activity | Current Implementation | Required Function | AI | Intent | Entity | Permission | Risk | Confirm | Audit | Status | Missing Implementation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Publish listing | `admin_set_listing_status` tool → `setListingStatus()` | `setListingStatus(id, "active")` | Parse-only | Yes | Yes (listing) | admin | Medium (public-facing) | Required | Logged | Implemented | — |
| Unpublish listing | same tool, `status: "draft"` | `setListingStatus(id, "draft")` | Parse-only | Yes | Yes | admin | Medium | Required | Logged | Implemented | — |
| Feature listing | `admin_set_listing_featured` → `setListingFeatured()` | `setListingFeatured(id, true)` | Parse-only | Yes | Yes | admin | Low | Required | Logged | Implemented | — |
| Unfeature listing | same tool, `false` | `setListingFeatured(id, false)` | Parse-only | Yes | Yes | admin | Low | Required | Logged | Implemented | — |
| Publish agent (Team page) | `admin_set_agent_visibility` → `setAgentVisibility()` | `setAgentVisibility(id, {is_published})` | Parse-only | Yes | Yes (agent) | admin | Medium | Required | Logged | Implemented | — |
| Feature agent (homepage) | same tool, `is_featured` (internal-only, server-enforced) | `setAgentVisibility(id, {is_featured})` | Parse-only | Yes | Yes | admin | Low | Required | Logged | Implemented | — |
| Activate agent | `admin_set_agent_active` → `setAgentActive()` | `setAgentActive(id, true)` | Parse-only | Yes | Yes | admin | Medium (restores access) | Required | Logged | Implemented | — |
| Suspend agent | same tool, `false` | `setAgentActive(id, false)` | Parse-only | Yes | Yes | admin | High (removes access) | Required | Logged | Implemented | — |
| Resend agent invite | `admin_resend_agent_invite` → `resendAgentInvite()` | `resendAgentInvite(email)` | Parse-only | Yes | Yes | admin | Low | Required | Logged | Implemented | — |
| Approve/decline/interview application | `admin_review_application` → `reviewApplication()` | `reviewApplication(id, status, notes)` | Parse-only | Yes | Yes (application) | admin | Medium (onboarding decision) | Required | Logged | Implemented | — |
| Navigate to admin section | `admin_navigate` → `navigateTo(section)` | `navigateTo(section)` | Parse-only | Yes | No | admin | None | Not required | N/A | Implemented | — |
| Grant/revoke admin role | `setAgentAdminRole()` exists, no tool | `setAgentAdminRole(id, enabled)` | Parse-only | Yes | Yes | admin | **High** (privilege escalation) | Required | Logged | **Missing tool** | Add `admin_set_agent_role` tool + confirm UI |
| Update agent profile fields | `updateAgentProfile()` exists (added this session), no tool | `updateAgentProfile(id, profileUpdate, agentUpdate)` | Parse-only | Yes | Yes | admin | Low–Medium | Required | Logged | **Missing tool** | Add `admin_update_agent_profile` tool (field-level, likely needs per-field sub-schema) |
| Publish/unpublish market insight | `saveMarketInsight()` exists, no tool | `saveMarketInsight(id, {published})` | Parse-only | Yes | Yes (insight) | admin | Low | Required | Logged (as of this session) | **Missing tool** | Add `admin_set_insight_published` tool |
| Feature market insight | same module, no tool | `saveMarketInsight(id, {is_featured})` | Parse-only | Yes | Yes | admin | Low | Required | Logged | **Missing tool** | Add `admin_set_insight_featured` tool |
| Reorder market insight | same module, no tool | `saveMarketInsight(id, {display_order})` | Parse-only | Yes | Yes | admin | Low | Required | Logged | **Missing tool** | Add `admin_reorder_insight` tool |

### Level 2 — Query / Structured Interpretation

None of these are currently exposed as Copilot tools — the LLM can only "answer" them today by reading the static context blob it was given (`AdminOverview`), which is unreliable for anything not already pre-aggregated into that blob, and impossible for anything requiring a fresh filtered query.

| Activity | Current Implementation | Required Function | AI | Intent | Entity | Permission | Risk | Confirm | Audit | Status | Missing Implementation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| "Show inactive/suspended agents" | manual client-side `Array.filter` only (`AgentsListPage.tsx`), not Copilot-reachable | `queryAgents({is_active: false})` | Parse-only | Yes | No | admin | None (read) | Not required | N/A | **Missing** | New query function + tool; needs to hit Supabase directly, not the client-filtered list already in memory |
| "Show unpublished agents" | same | `queryAgents({is_published: false})` | Parse-only | Yes | No | admin | None | Not required | N/A | **Missing** | Same as above |
| "Show draft listings" / "listings below $X" / "listings in district Y" | manual client-side filter only (`AdminListingsPage.tsx`) | `queryListings({status?, priceMax?, district?})` | Parse-only | Yes | No | admin | None | Not required | N/A | **Missing** | New server-side filtered query function + tool |
| "Show pending applications" | precomputed server-side into context (`urgentApplications` in `adminOverview.ts`), not an ad hoc query | `queryApplications({status})` | Parse-only | Yes | No | admin | None | Not required | N/A | **Partial** — push-only today | Convert to a pull-capable tool so any status/date filter works, not just the pre-picked "urgent" slice |
| "Find/open the agent record for [name]" | LLM must already know the ID from the context dump; no resolver | `resolveAgentByName(name)` | Parse-only | Yes | **Yes** | admin | None | Not required | N/A | **Missing** | Needed as a building block for every other agent-targeted tool call when the user refers to an agent by name rather than ID |
| "Find/open the listing for [address/title]" | same gap | `resolveListingByTitle(title)` | Parse-only | Yes | **Yes** | admin | None | Not required | N/A | **Missing** | Same rationale, for listings |
| "Which agents are not published on the Team page?" | currently answered by the LLM reading the raw context text (unreliable — not a real filter) | `queryAgents({is_published: false})` | Parse-only | Yes | No | admin | None | Not required | N/A | **Should be L2, currently answered as unverified prose** | Same as "show unpublished agents" above — replacing the prose-reading pattern with a real query removes a correctness risk |

### Level 3 — Workflow

None implemented. All require bulk operations (confirmed absent, `docs/system/MISSING_CAPABILITY_REPORT.md`) as a prerequisite.

| Activity | Current Implementation | Required Function | AI | Intent | Entity | Workflow | Permission | Risk | Confirm | Audit | Status | Missing Implementation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| "Publish all draft listings that meet [criteria]" | none | `queryListings(criteria)` → loop `setListingStatus(id, "active")` | Parse-only | Yes | Yes (set) | Yes | admin | **High** (bulk public-facing change) | Required, itemized preview before bulk apply | Logged per item | **Missing** | Needs L2 query function first, plus a bulk-confirmation UI pattern (not just single-item confirm cards) |
| "Resend invites to all pending agents" | none (manual: one-by-one via `resendAgentInvite`) | `queryAgents({pendingInvite: true})` → loop `resendAgentInvite(email)` | Parse-only | Yes | Yes (set) | Yes | admin | Medium | Required, itemized preview | Logged per item | **Missing** | Same prerequisites as above |
| "Process pending applications: approve X, decline Y" (multi-criteria batch review) | none | `queryApplications(criteria)` → loop `reviewApplication()` | Parse-only | Yes | Yes (set) | Yes | admin | **High** (irreversible onboarding decisions at scale) | Required, itemized preview, likely one-by-one confirm given the stakes | Logged per item | **Missing** | Same prerequisites; given the risk level, may be better scoped as "propose a batch, admin reviews and confirms each" rather than true one-shot bulk execution |
| Generate → save → publish → feature a market insight in one command | AI-draft generation exists (`marketInsightCopilot.ts`, separate non-tool-calling assistant used by the tested admin page) but is not chained to save/publish/feature | draft-generation (existing) → `saveMarketInsight()` → publish → feature | **Required** (drafting is genuine generation) + Parse-only (the chained deterministic steps) | Yes | Yes | Yes | admin | Medium | Required before publish step | Logged | **Partial** | Draft-generation exists; the deterministic chaining into a single Copilot-driven workflow does not |

### Level 4 — AI Reasoning

| Activity | Current Implementation | Required Function | AI | Intent | Entity | Permission | Risk | Confirm | Audit | Status | Missing Implementation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| "Explain the latest activity log entry in plain English" | conversational — LLM reads the recent-activity context already supplied, no tool call | none (data already in context) | **Required** | No | No | admin | None (read/explain only) | Not required | N/A | **Implemented** | — |
| "Summarise today's dashboard" | conversational, same pattern | none | **Required** | No | No | admin | None | Not required | N/A | **Implemented** | — |
| "Which applications need attention first?" | conversational; underlying data (`urgentApplications`) is deterministically precomputed, but the prioritization/framing is genuine LLM reasoning on top | `queryApplications()` (L2, for a fresher/broader set than the fixed "urgent" precompute) + LLM reasoning | **Required** (for the judgement) + Parse-only (for the underlying data pull) | Yes | No | admin | None | Not required | N/A | **Implemented for the fixed precomputed set; would need the L2 query above to reason over anything outside it** | Wire the L2 query tool so this can reason over the full application set, not just the top-5 precompute |
| "Which properties should we feature this weekend?" | none | `queryListings()` (L2) + view-count/engagement analysis + LLM recommendation | **Required** | Yes | No | admin | Low (recommendation only, still requires human `admin_set_listing_featured` confirm to act) | Recommendation itself needs no confirm; the resulting feature action does | N/A for the recommendation; Logged for any resulting action | **Missing** | Needs the L2 listings-query tool as a data source, plus a prompt that asks the LLM to reason over engagement metrics — genuinely Level 4, not a relabeled filter |
| "Why did enquiries drop?" | none | historical query over `property_enquiries`/`property_view_logs` (L2, needs a **time-series** capability that doesn't exist yet) + LLM trend analysis | **Required** | Yes | No | admin | None (read/explain) | Not required | N/A | **Missing** | No trend/time-series query capability exists at all today (only point-in-time counts) — this is blocked on new deterministic infrastructure before the L4 reasoning layer can even run |

---

## SECTION B — Agent Copilot Activities (for reference — agent-facing, not admin)

Included because the source docs (`EXISTING_FUNCTION_INVENTORY.md`, `EXISTING_COPILOT_INVENTORY.md`) cover the agent-role Copilot as well, and the pattern comparison is informative for admin design decisions.

### Level 1 — Direct Function (12 of 13 agent tools)

| Activity | Required Function | Permission | Risk | Confirm | Audit | Status |
|---|---|---|---|---|---|---|
| Create lead | `createLead()` | agent | Low | Required | **Not logged** (no cross-role audit trail — see gap below) | Implemented |
| Update lead status | `updateLeadStatus()` | agent | Low | Required | Not logged | Implemented |
| Book viewing | `bookViewing()` | agent | Low | Required | Not logged | Implemented |
| Reschedule viewing | `rescheduleViewing()` | agent | Low | Required | Not logged | Implemented |
| Update viewing status | `updateViewingStatus()` | agent | Low | Required | Not logged | Implemented |
| Create task | `createTask()` | agent | Low | Required | Not logged | Implemented |
| Complete task | `setTaskCompletion()` | agent | Low | Required | Not logged | Implemented |
| Reassign lead (share) | `shareLead()` | agent | Medium (changes ownership pending acceptance) | Required | Not logged | Implemented |
| Create folder | inline insert (`AIChatPanel.tsx`) — **duplicated**, see `docs/system/DUPLICATE_LOGIC_REPORT.md` | agent | Low | Required | `file_activity_log` bypassed by this path | Implemented, but duplicated/inconsistent with manual path |
| Navigate scene | `navigateTo()`/`dispatch` | agent | None | Not required | N/A | Implemented |

**Audit gap** (also noted in `docs/system/DUPLICATE_LOGIC_REPORT.md`): none of the agent-side L1 write tools log to any audit table — there is no cross-role equivalent of `admin_activity_log` for agent actions.

### Level 2 — Query / Structured Interpretation

| Activity | Required Function | Permission | Risk | Confirm | Audit | Status |
|---|---|---|---|---|---|---|
| Look up viewings (`viewing_lookup`) | inline query, `AIChatPanel.tsx` | agent | None | Not required | N/A | Implemented |
| View/open a lead by name (`lead_view`) | inline query + nav | agent | None | Not required | N/A | Implemented |

### Level 3 — Workflow

None found on the agent side either — no bulk/multi-step agent tool exists.

### Level 4 — AI Reasoning

| Activity | Required Function | Permission | Risk | Confirm | Audit | Status |
|---|---|---|---|---|---|---|
| Draft a follow-up message to a lead (`lead_draft_message`) | LLM generation, confirmed never auto-sends | agent | Low (draft only, human must send) | Draft shown for review, not auto-sent | N/A (nothing persisted) | Implemented |

---

## Summary Counts

| Level | Admin: Implemented | Admin: Missing/Partial | Agent: Implemented | Agent: Missing |
|---|---|---|---|---|
| L1 | 11 | 5 | 10 | 0 |
| L2 | 0 | 7 | 2 | 0 |
| L3 | 0 (1 partial) | 3 | 0 | 0 |
| L4 | 3 (1 partial) | 2 | 1 | 0 |

The admin Copilot today is almost entirely Level 1. Every Level 2 admin capability is either unimplemented or answered unreliably by having the LLM read prose context instead of running a real filtered query — this is the highest-leverage gap: a handful of read-only query functions (`queryAgents`, `queryListings`, `queryApplications`, name-resolvers) would unlock most of the missing Level 2 rows and make the existing "implemented" Level 4 rows (which currently reason only over a fixed precomputed slice) reason over the full dataset instead.
