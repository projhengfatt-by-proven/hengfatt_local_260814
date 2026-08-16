# Library-to-Project Mapping

Matching pass, 2026-08-16. Every function, action, query, workflow, security
pattern, and Copilot capability in `docs/admin/ADMIN_ACTION_CATALOG.md` and
`docs/copilot/COPILOT_FUNCTION_CATALOG.md`, matched against
`C:\Users\eddy\Documents\AI_copilot_functions_Skills_Knowledge\base-library\`.
**Nothing is implemented here** — this is a matching/classification exercise.

## Methodology

Read the library's governance layer in full (`00-governance/*`), its
machine-readable catalog (`11-copilot/function-catalog/functions.json`,
`MASTER_FUNCTION_INVENTORY.md`), and every individual function record that
exists (`01-core/`, `02-admin/`, `03-property/`, `06-workflows/`,
`11-copilot/`). The library's own audit (`FINAL_REPORT.md`,
`CANONICAL_IMPLEMENTATIONS.md`) already establishes ground truth on what's
actually verified vs. merely named — this mapping trusts that audit rather
than re-deriving it.

**Critical scoping fact**: the library currently has only **6 verified
function/pattern records** (`status: FOUND` in `functions.json`) against a
target universe of ~116 named functions in `MASTER_FUNCTION_INVENTORY.md`.
None of the 6 FOUND records are real-estate-domain CRUD functions with a
reusable license — the one property-domain record (`publish_property`) is
explicitly `REFERENCE ONLY` because its source project's license is
unconfirmed. Expect most domain-specific project requirements below to
classify as **D — NOT FOUND**; the real value of this pass is in the
**cross-cutting architecture/security patterns**, where matches are strong.

## Classification Legend

**A** = Directly Reusable · **B** = Reusable With Adaptation · **C** =
Reference Pattern Only (do not copy code/text, concept only) · **D** = Not
Found (no library entry exists, verified absent, not merely unsearched).

---

## SECTION 1 — Cross-Cutting Architecture & Security Patterns

These apply to `docs/admin/ADMIN_ACTION_ARCHITECTURE.md` and
`docs/copilot/COPILOT_FUNCTION_CATALOG.md` as a whole, not to one function.

### 1.1 Copilot tool execution model (propose → confirm → execute → audit)

- **Project requirement**: our design rule that a Copilot tool "never contains write logic of its own" — it declares a schema, gets confirmed, calls the action layer, reports back (`COPILOT_FUNCTION_CATALOG.md` "Design Rule").
- **Matching library item**: `action_pipeline_execute` (`11-copilot/execution-patterns/action-pipeline.md`) — the `before → isAccessible → handler → after` pipeline, source AdminJS, MIT confirmed, classified **CANONICAL** by the library's own audit.
- **Compatibility**: Strong conceptual match. Our current implementation (`AdminChatPanel.tsx`'s `executeAction()` switch statement) already does steps 1/3/4 implicitly but has **no explicit `isAccessible` re-check at execution time** — it relies entirely on RLS as the backstop, with no application-layer permission gate at the point of tool execution.
- **Required adaptation**: Formalize a second permission check inside `executeAction()` immediately before calling each action-layer function — not to replace RLS, but to fail fast with a clear message instead of a raw Postgres error, and to close the exact gap the library's own security audit found in its source (see Risks).
- **Missing dependencies**: none — this is a code-organization change, not a new dependency.
- **Risks**: The library's audit found AdminJS's own reference implementation is **fail-open** — `isAccessible` defaults to `true` (allowed) when a resource's action config omits it entirely (`action-decorator.ts:232-233`, confirmed by the library's security audit). **If this pattern is adopted, the `isAccessible` equivalent must be a required field with no implicit default, or default to deny** — copying the pipeline *shape* without this correction would reintroduce the exact vulnerability the library found in its own source.
- **Recommendation**: **B — Reusable With Adaptation.** Adopt the pipeline shape (it validates our own design independently), but implement the corrected fail-closed version documented in the library, not AdminJS's literal default behavior.

### 1.2 Confirmation policy (destructive/reversible/blast-radius-keyed)

- **Project requirement**: per-function `Confirmation: Required/Not required` fields scattered across `ADMIN_ACTION_CATALOG.md`, decided ad hoc per function.
- **Matching library item**: `11-copilot/confirmation-rules/confirmation-rules.md` — a general policy function: always confirm if `destructive`, `!reversible`, security-sensitive class (delete/publish/suspend/role-change/bulk/system-op), or `type: SYSTEM_OPERATION`; may skip confirmation only for pure reads/reports.
- **Compatibility**: Very strong. This is effectively the same decision table we applied by hand, expressed as a reusable policy function keyed off flags (`destructive`, `reversible`, `type`) rather than requiring a human to re-derive the confirmation requirement per function every time a new one is added.
- **Required adaptation**: Adopt the flag-driven policy directly — tag each of our catalog's functions with `destructive`/`reversible`/`type` (we already have the equivalent information in prose, this just needs restructuring into the same compact fields) and derive `Confirmation: Required` from the policy instead of stating it manually per function. Also worth adopting verbatim: *"Do not proceed on an ambiguous or implied 'yes' — require an explicit affirmative tied to the specific action about to run"* — this is a textual policy directly applicable to our `AdminChatPanel.tsx` confirm-card UX with no code changes needed to reuse the wording.
- **Missing dependencies**: none.
- **Risks**: Low. The main risk of *not* adopting this is confirmation-requirement drift as new functions are added by different people over time without a shared rule to check against.
- **Recommendation**: **A — Directly Reusable** (as written policy text/rule, no code involved) for the confirmation-format guidance; **B — Reusable With Adaptation** for restructuring our catalog to carry the flag fields the policy is keyed on.

### 1.3 Permission rules for Copilot execution (acting-as-user, never own identity)

- **Project requirement**: implicit in our design (Copilot executes admin actions using the admin's own session/RLS), but never stated as an explicit rule anywhere in our docs.
- **Matching library item**: `11-copilot/permission-rules/permission-rules.md` — five numbered rules, most directly: *"The AI copilot never has its own identity/permission set distinct from the human it acts on behalf of... the copilot cannot escalate beyond what that user's role already permits."*
- **Compatibility**: Exact match to our actual implementation (Copilot calls run under the browser session's RLS-scoped Supabase client) — we do this correctly today, we just never wrote it down as a stated rule.
- **Required adaptation**: None for behavior — this rule already describes what our system does. Only adaptation needed is documentation: add this as an explicit stated principle in `ADMIN_ACTION_ARCHITECTURE.md` so it's a deliberate design decision on record, not an accidental byproduct of "the browser client happens to carry the session."
- **Missing dependencies**: none.
- **Risks**: None from adopting it — the risk is entirely on the *agent-role* Copilot path, which (per `docs/copilot/EXISTING_COPILOT_INVENTORY.md`) has no server-side permission check at all, unlike the admin path. This rule underscores why that asymmetry matters: without a server-side check, "the copilot acts as the user" is enforced only by RLS, with no earlier fail-fast layer — consistent with what was already flagged as a gap, not a new finding.
- **Recommendation**: **A — Directly Reusable** (as a documentation addition, verbatim principle, zero code).

### 1.4 Bulk-operation per-record scope re-verification

- **Project requirement**: `bulkPublishListings`, `bulkResendInvites`, `batchReviewApplications` (`ADMIN_ACTION_CATALOG.md`) — currently specified with itemized-preview confirmation but no explicit re-verification step per record at execution time.
- **Matching library item**: `02-admin/custom-actions/operation_plugin_pattern.md`'s security correction — Backpack's `ReorderOperation::saveReorder()` checks access once, globally, then trusts the entire client-supplied batch payload without re-verifying each record is within the acting user's intended scope (confirmed finding against real Backpack source, `ReorderOperation.php:88-93`).
- **Compatibility**: Directly applicable warning, not code. Our bulk workflow functions accept a `criteria` object and re-derive the candidate set server-side from `queryListings(criteria)`/`queryAgents(criteria)`/`queryApplications(criteria)` at execution time (not a client-supplied ID list) — this already avoids the exact failure mode described (a forged/stale client payload naming records outside the admin's actual scope), **provided** the implementation actually re-runs the query at execution time rather than trusting an ID list the confirmation UI displayed earlier.
- **Required adaptation**: Add this as an explicit implementation requirement/test case in `ADMIN_ACTION_CATALOG.md`'s bulk functions: *"the execution step must re-derive the record set from `criteria` at call time, never accept a pre-resolved ID list from the confirmation UI as ground truth"* — currently implied by our design (criteria-based, not ID-list-based) but not stated as a hardening rule the way the library states it.
- **Missing dependencies**: none.
- **Risks**: If a future implementation "optimizes" by passing the itemized-preview's ID list straight through to execution instead of re-querying, it reintroduces exactly the Backpack finding. Worth a code-review checklist item, not just a doc note.
- **Recommendation**: **B — Reusable With Adaptation** (the warning transfers directly; our design already avoids the root cause by construction, but should say so explicitly).

### 1.5 Status/lifecycle transition validation (state machine)

- **Project requirement**: `reviewApplication()`/`setListingStatus()` currently accept any target status with no check that the transition from the current status is legal (e.g. nothing stops a "declined" application from being set back to "pending" via a Copilot call, or a listing jumping between arbitrary statuses).
- **Matching library item**: `06-workflows/state-machine/enum_validator_state_machine.md` (`enum_validator_state_transition`) — stateless `(from, to) → bool` validator pattern, source OpenKOS, Apache-2.0 confirmed, classified **CANONICAL**.
- **Compatibility**: Strong conceptual match, directly addresses a real gap identified during this project's own audits (neither `setListingStatus` nor `reviewApplication` currently validates transition legality — confirmed by reading both functions during the earlier action-catalog design pass).
- **Required adaptation**: Define the legal transition table per entity (e.g. applications: `pending → {reviewing, declined}`, `reviewing → {interview, declined}`, `interview → {approved, declined}`, no transition out of `approved`/`declined`) and wrap `reviewApplication`/`setListingStatus` with a pure validator function called before the update, rejecting illegal jumps with a clear error — mirroring the pattern's own test requirement ("every illegal transition is rejected with a clear error, not a silent no-op").
- **Missing dependencies**: none — TypeScript enums/unions + a `switch` are explicitly named in the library's own framework-compatibility matrix as the direct TS equivalent of OpenKOS's PHP `match()` approach.
- **Risks**: Retrofitting this onto functions already in production use (via Copilot and manual UI) needs the legal-transition table defined carefully so it doesn't reject currently-valid admin workflows that happen to look like "illegal" jumps (e.g. re-opening a declined application for reconsideration might be an intentional, currently-used path — needs a product decision, not just an engineering one, before tightening).
- **Recommendation**: **B — Reusable With Adaptation.** High value, addresses a real and previously undocumented gap in our own action catalog.

### 1.6 Machine-readable function catalog schema

- **Project requirement**: `docs/admin/ADMIN_ACTION_CATALOG.md`'s prose-only 14-field contract template.
- **Matching library item**: `11-copilot/function-catalog/functions.json` + `SCHEMA.md` — a compact JSON schema (`type`, `ai_required`, `ai_optional`, `destructive`, `reversible`, `permission`, `audit_required`, `confirmation_required`, `source_project`, `reuse_status`, `record_path`, `status`) alongside the full prose record.
- **Compatibility**: Good structural overlap — roughly 6 of our 14 fields map directly (`permission`, `risk`≈`destructive`/`reversible`, `confirmation`≈`confirmation_required`, `audit`≈`audit_required`). Our template additionally carries input/output schema, validation, side effects, idempotency, errors, dependencies, which the library keeps in prose only, not in the JSON.
- **Required adaptation**: Optionally add a parallel `functions.json`-style machine-readable index alongside our markdown catalog, so tooling (e.g. a future admin-tool-schema generator) can query flags without parsing prose. Not required for correctness — purely a tooling/queryability upgrade.
- **Missing dependencies**: none.
- **Risks**: Two sources of truth (prose + JSON) drifting if not kept in sync — the library's own rule (`"Do not set status: FOUND without a corresponding record file"`) is the relevant safeguard to copy alongside the schema itself.
- **Recommendation**: **B — Reusable With Adaptation**, lower priority than 1.1–1.5 (a tooling nicety, not a gap in current functionality).

---

## SECTION 2 — Domain Functions: Listings

| Project requirement | Matching library item | Classification | Notes |
|---|---|---|---|
| `setListingStatus` (publish/unpublish) | `publish_property` (`03-property/publication/publish_property.md`, liberu-real-estate) | **C — Reference Pattern Only** | Cannot reuse code — source license unconfirmed (`REFERENCE ONLY` per the library's own audit, "no LICENSE file exists in the repository"). Two corrections in the pattern doc are worth applying regardless: (1) **publish-twice must be idempotent success, not an error or duplicate audit entry** — worth explicitly verifying our `setListingStatus` behaves this way (it should, since it's a plain column update, but this wasn't stated as a requirement in our own catalog); (2) **the audit-log write must be inside the same transaction as the status change**, not fire-and-forget after — our `setListingStatus` currently does the Supabase update, then a separate `logAdminActivity()` call; if the second call fails, the status change still succeeds with no audit record. Not currently wrapped in an explicit transaction. |
| `setListingFeatured` | same (`publish_property.md` covers publish/unpublish only, not "featured" as a separate concept) | **C — Reference Pattern Only** (weak match) | The idempotency/transaction corrections above apply equally, but the source pattern doesn't model "featured" as its own lifecycle state — treat as a looser analogy, not a close match. |
| `queryListings` | `search_properties` (functions.json, `status: PLANNED`, category `03-property/property-search`) | **D — Not Found** | Explicitly named as a gap in the library itself — no source project was inspected for this. |
| `resolveListingByTitle` | none | **D — Not Found** | Not named anywhere in `MASTER_FUNCTION_INVENTORY.md`; entity-resolution-by-name isn't part of the library's current scope at all. |
| `bulkPublishListings` | `PROPERTY.bulk_operations` (named in `MASTER_FUNCTION_INVENTORY.md`, not `FOUND`) | **D — Not Found** (function) / **B** (safety pattern, see §1.4) | No implementation exists; the *safety corrections* from §1.4/§1.5 are the only reusable part. |

## SECTION 3 — Domain Functions: Agents

| Project requirement | Matching library item | Classification | Notes |
|---|---|---|---|
| `setAgentActive` (activate/suspend) | `AGENTS.activate`/`deactivate`/`suspend`/`unsuspend` (named, not `FOUND`) | **D — Not Found** | Zero of the 17 named AGENTS functions have a verified source record. `security-rules.md` does independently list "suspend/unsuspend/deactivate" in its sensitive-operation class requiring mandatory audit+permission — our function already satisfies this by construction (confirmed match on the *requirement*, not an implementation). |
| `setAgentVisibility` | no direct AGENTS equivalent named (closest is generic publish/unpublish, listed under WEBSITE/PROPERTY categories, not AGENTS) | **D — Not Found** | |
| `resendAgentInvite` | `AGENTS.invite` (named, not `FOUND`) | **D — Not Found** | |
| `setAgentAdminRole` | `AGENTS.assign_role`/`remove_role` (named, not `FOUND`); conceptually adjacent to `sync_permissions_for_role` (`FOUND`, CANONICAL, lara-dashboard, MIT) | **C — Reference Pattern Only** | `sync_permissions_for_role` is about granular permission-string sync, not a binary admin-role grant/revoke — different mechanism, but its stated security rule transfers directly: *"must never be exposed as a generic 'set role permissions to whatever list is passed' endpoint without allow-listing... validate every permission name against the known-generated set"* — the closest analog for our binary case is validating `enabled` is boolean and the target `agentId` resolves to a real user, which we already do implicitly via the edge function; the more valuable transfer is the **self-lockout guard recommendation** already independently flagged in `ADMIN_ACTION_CATALOG.md` (an admin should not be able to revoke their own admin role via this function) — the library doesn't name this specific case but its general "validate against a known-safe set" principle supports it. |
| `updateAgentProfile` | no AGENTS.update named explicitly | **D — Not Found** | |
| `queryAgents` / `resolveAgentByName` | `USERS.search` (named, not `FOUND`) | **D — Not Found** | Same gap pattern as listings — no query/search implementation exists anywhere in the library yet. |
| `bulkResendInvites` | not named | **D — Not Found** | Safety-pattern transfer from §1.4 still applies. |

## SECTION 4 — Domain Functions: Applications

| Project requirement | Matching library item | Classification | Notes |
|---|---|---|---|
| `reviewApplication` (approve/decline/interview/reviewing) | `APPROVAL.approve`/`reject`/`request_changes` (named, not `FOUND`) | **D — Not Found** (function) / **B** (state-machine hardening, see §1.5) | The APPROVAL category is entirely un-sourced in the library; the one genuinely useful transfer is the state-machine pattern from §1.5, since application review is structurally the clearest state-machine candidate in our whole catalog (5-value status enum, clear legal-transition set). |
| `queryApplications` | `APPROVAL.pending_queue` (named, not `FOUND`) | **D — Not Found** | |
| `batchReviewApplications` | `APPROVAL.*` bulk equivalent (not named at all — bulk isn't mentioned in the APPROVAL category list) | **D — Not Found** | Neither the specific function nor a bulk variant is named anywhere in the library; §1.4's general bulk-safety pattern is the only applicable transfer. |

## SECTION 5 — Domain Functions: Market Insights

| Project requirement | Matching library item | Classification | Notes |
|---|---|---|---|
| `createInsight` | `WEBSITE.blog`/`announcements` (named, not `FOUND`) | **D — Not Found** | Market Insights is closest conceptually to the library's WEBSITE/blog category, which itself has zero source implementations. |
| `setInsightPublished` | `WEBSITE.publish`/`unpublish` (named, not `FOUND`); loosely, the idempotency/transaction corrections from `publish_property.md` (§ Section 2 row 1) | **C — Reference Pattern Only** | Same idempotent-publish and audit-in-transaction guidance applies generically to any "publish this content" function, not just properties — worth applying here too even though the source pattern is property-specific. |
| `setInsightFeatured` / `reorderInsight` | `WEBSITE.reorder` (named, not `FOUND`) | **D — Not Found** | |

## SECTION 6 — Cross-Domain / Reporting / AI Reasoning

| Project requirement | Matching library item | Classification | Notes |
|---|---|---|---|
| `queryEnquiryTrend` | `summarize_property_performance` (functions.json, `status: PLANNED`, category `10-reporting/property-reports`) | **D — Not Found** | Named as a planned gap, no source; also only a loose conceptual overlap (property performance summary vs. enquiry time-series specifically). |
| `recommendFeaturedListings()` | `recommend_featured_properties` (functions.json, `status: PLANNED`, `type: AI_REQUIRED`, category `03-property/featured`, `permission: property.feature`, `audit_required: true`, `confirmation_required: true`) | **D — Not Found** (no implementation) — **but worth flagging separately** | This is a near-exact name/category match to a function the library has already *specified* (flags only, no code) but not built. **Discrepancy worth resolving**: the library's placeholder marks `confirmation_required: true` for the recommendation itself; our own design (`COPILOT_FUNCTION_CATALOG.md`) states the recommendation needs no confirmation and only the resulting `admin_set_listing_featured` action does. Recommend adopting the library's stricter interpretation — treat the *act of generating and displaying* an AI recommendation about which properties to feature as itself audit-worthy (even before any action is taken on it), since it's an `AI_REQUIRED` judgement about business-sensitive content, not a neutral read. |
| `explainEnquiryTrend` | none named | **D — Not Found** | |
| "Explain activity log entry" / "summarise dashboard" / "which applications need attention" (already implemented, conversational-only) | n/a | **N/A — no matching needed** | These require no new function per `docs/copilot/COPILOT_FUNCTION_CATALOG.md` (already working via system prompt + context); nothing to search the library for. |

## SECTION 7 — Audit Logging (validates our existing pattern)

- **Project requirement**: `logAdminActivity()` / `admin_activity_log` — already implemented, single-writer, used across all admin mutating functions (`docs/system/EXISTING_FUNCTION_INVENTORY.md`).
- **Matching library item**: none — and this is **independently confirmed by the library's own audit**, not merely unsearched: `CANONICAL_IMPLEMENTATIONS.md` explicitly classifies "Audit/activity logging (dedicated, vetted implementation)" as **MISSING** across all 6 source projects investigated — lara-dashboard and OpenKOS both hand-roll their own audit log (same category of implementation as ours), Backpack delegates to an unaudited add-on. The library recommends researching `spatie/laravel-activitylog` directly as future work, not yet done.
- **Compatibility**: N/A — nothing to compare against.
- **Required adaptation**: None applicable.
- **Missing dependencies**: N/A.
- **Risks**: None from this finding — if anything, this validates that our own hand-rolled `admin_activity_log` pattern (single writer, append-only, consistent field shape) is already at parity with the *best currently-documented* approach the library has seen elsewhere (hand-rolled, same as lara-dashboard/OpenKOS), not behind it.
- **Recommendation**: **D — Not Found**, with the explicit note that this is a confirmed library-wide gap, not a search failure — no action needed on our side as a result of this mapping pass.

---

## Summary

| Classification | Count | Where |
|---|---|---|
| A — Directly Reusable | 2 | §1.2 (confirmation wording), §1.3 (permission-rules principle) |
| B — Reusable With Adaptation | 6 | §1.1 (execution pipeline), §1.2 (policy structure), §1.4 (bulk safety), §1.5 (state machine), §1.6 (schema), §3 (`setAgentAdminRole` validation principle) |
| C — Reference Pattern Only | 5 | §2 (`setListingStatus`, `setListingFeatured`), §5 (`setInsightPublished`), §3 (`setAgentAdminRole` loose analog) |
| D — Not Found | ~24 | nearly every domain-specific function across Listings/Agents/Applications/Insights/Reporting |
| N/A | 3 | already-implemented conversational L4 items |

## Top Recommendations

1. **Adopt the five cross-cutting patterns from Section 1 regardless of domain-function availability** — they're the highest-value matches in this whole exercise, all either directly reusable as written policy (§1.2, §1.3) or clearly-scoped adaptations (§1.1, §1.4, §1.5) that close real, previously-identified gaps in our own action catalog (no execution-time permission re-check, no transition validation, no explicit idempotent-publish/transaction requirement).
2. **Do not wait on the library for domain functions.** With ~24 of our ~30 requirements landing at D, the library is not currently a source of implementable real-estate/admin domain code — our own `ADMIN_ACTION_CATALOG.md` design work remains the primary source of truth for what to build; treat the library going forward as a source of *safety patterns and policy language*, not domain logic.
3. **The `recommend_featured_properties` confirmation-flag discrepancy (§6) is worth a deliberate decision**, not a silent pick — it's a genuine disagreement between our design and the library's specification for the same named function, not a gap.
4. **liberu-real-estate's license question remains the single highest-leverage unresolved item in the library itself** (per its own `FINAL_RECOMMENDATIONS.md`) — if resolved favorably, `publish_property` and its domain-adjacent patterns would move from C to potentially B/A and materially change this mapping's Section 2/5 results. Worth periodically re-checking, not re-litigating now.
