# Admin Action Catalog

Design pass, 2026-08-15. Full function contract for every deterministic
admin action-layer function — existing (reused as-is), existing (needs
refactor), and new (required). Architecture/principles are in
`docs/admin/ADMIN_ACTION_ARCHITECTURE.md`; Copilot-specific tool wrapping is
in `docs/copilot/COPILOT_FUNCTION_CATALOG.md`. **Nothing in this document is
implemented** — it is the spec to implement against.

## Contract Template

Every entry defines: name, purpose, domain, input schema, output schema,
validation, permission, risk, confirmation, audit, side effects,
idempotency, errors, dependencies — plus the activity-level questions:
reuse/refactor/new status, supporting functions required, query required,
entity resolution required, workflow required, AI reasoning required.

---

## DOMAIN: Listings

### `setListingStatus(id, status, client?)` — Existing, reuse as-is

- **Purpose**: publish or unpublish a listing.
- **Domain**: Listings.
- **Input**: `{ id: string (uuid), status: "active" | "draft" }`
- **Output**: `{ error: string | null }`
- **Validation**: `id` must reference an existing `properties` row (implicit via update-by-id; a 0-row update should be surfaced as an error, not silently succeed — currently not distinguished, worth tightening).
- **Permission**: admin (RLS `has_role`).
- **Risk**: Medium (public-facing visibility change).
- **Confirmation**: Required by caller before invoking.
- **Audit**: Logs `"Listing published"`/`"Listing taken down"` to `admin_activity_log` internally.
- **Side effects**: none beyond the `properties` row + audit log row.
- **Idempotency**: Yes — setting the same status twice is a no-op state-wise.
- **Errors**: Supabase update error message passed through.
- **Dependencies**: `logAdminActivity`.
- **Status**: existing, `src/components/admin/adminOperations.ts:110-130`, no changes needed.
- Supporting functions: none. Query required: no. Entity resolution: no (caller supplies `id`). Workflow: no. AI reasoning: no.

### `setListingFeatured(id, value, client?)` — Existing, reuse as-is

- **Purpose**: feature or unfeature a listing.
- **Domain**: Listings.
- **Input**: `{ id: string (uuid), value: boolean }`
- **Output**: `{ error: string | null }`
- **Validation**: same 0-row-update caveat as above.
- **Permission**: admin.
- **Risk**: Low.
- **Confirmation**: Required.
- **Audit**: Logs `"Listing featured"`/`"Listing unfeatured"`.
- **Side effects**: none beyond the row + audit log.
- **Idempotency**: Yes.
- **Errors**: pass-through.
- **Dependencies**: `logAdminActivity`.
- **Status**: existing, `adminOperations.ts:132-152`, no changes needed.
- Supporting: none. Query: no. Entity resolution: no. Workflow: no. AI reasoning: no.

### `queryListings(filters, client?)` — New

- **Purpose**: server-side filtered listing lookup, replacing today's client-side `Array.filter` over an already-fetched full list.
- **Domain**: Listings.
- **Input**: `{ status?: "active"|"draft", priceMin?: number, priceMax?: number, isFeatured?: boolean, titleContains?: string, limit?: number (default 20) }`
- **Output**: `{ data: Array<{ id, title, status, price, is_featured, view_count, created_at }> | null, error: string | null }`
- **Validation**: `priceMin <= priceMax` if both given; `limit` capped (e.g. 100) to avoid unbounded reads.
- **Permission**: admin (read — RLS admin-full-access on `properties` already covers this).
- **Risk**: None (read-only).
- **Confirmation**: Not required.
- **Audit**: Not required (reads aren't audited, matching existing convention).
- **Side effects**: none.
- **Idempotency**: N/A (pure read).
- **Errors**: Supabase query error pass-through.
- **Dependencies**: none beyond the Supabase client.
- **Status**: new — required for L2 admin activities per the capability matrix.
- Supporting: none. Query: this *is* the query function. Entity resolution: no. Workflow: no (but is a prerequisite input to workflow functions below). AI reasoning: no (but is a prerequisite input to the L4 "which listings to feature" reasoning function in the Copilot catalog).

### `resolveListingByTitle(titleQuery, client?)` — New

- **Purpose**: resolve a natural-language listing reference ("The Brick House") to a concrete `id`, for use as input to `setListingStatus`/`setListingFeatured`/etc.
- **Domain**: Listings.
- **Input**: `{ titleQuery: string }`
- **Output**: `{ data: { id, title } | { candidates: Array<{id, title}> } | null, error: string | null }` — a single unambiguous match returns `data`, multiple partial matches return `candidates` for the caller (Copilot) to ask the user to disambiguate.
- **Validation**: non-empty `titleQuery`.
- **Permission**: admin.
- **Risk**: None (read-only).
- **Confirmation**: Not required.
- **Audit**: Not required.
- **Side effects**: none.
- **Idempotency**: N/A.
- **Errors**: pass-through.
- **Dependencies**: `queryListings` (implemented as a thin wrapper: `queryListings({ titleContains: titleQuery, limit: 5 })`, then applies single/multiple-match logic).
- **Status**: new.
- Supporting: `queryListings`. Query: yes (built on one). Entity resolution: this *is* the entity-resolution function. Workflow: no. AI reasoning: no.

### `bulkPublishListings(criteria, client?)` — New (Workflow)

- **Purpose**: publish every listing matching a filter, as a single orchestrated action.
- **Domain**: Listings.
- **Input**: `{ criteria: ListingFilters (same shape as queryListings), confirmed: true }` — `confirmed` is mandatory per the High-risk contract rule in the architecture doc; the function rejects the call outright if `confirmed !== true`.
- **Output**: `{ data: { succeeded: string[], failed: Array<{id, error}> } | null, error: string | null }`
- **Validation**: `criteria` must not be empty/unbounded (require at least one filter — refuse a criteria-less "publish everything" call outright, even with `confirmed: true`, as a hard safety rail rather than a soft warning).
- **Permission**: admin.
- **Risk**: **High** — bulk public-facing change.
- **Confirmation**: Caller (Copilot/Workflow UI) must present an itemized preview (the `queryListings(criteria)` result) and only call this function after the admin approves the specific set — `confirmed: true` alone does not imply the admin reviewed the itemized list; that's a UX obligation on the caller, not something this function can verify.
- **Audit**: Logs one `admin_activity_log` entry **per listing** (via `setListingStatus` internally), plus one summary entry for the batch itself (`"Bulk publish: N listings"`, `changes: { criteria, succeeded, failed }`).
- **Side effects**: N `properties` row updates + N+1 audit log rows.
- **Idempotency**: Per-item idempotent (re-running publishes the same already-active rows harmlessly); the batch as a whole is safe to retry on partial failure since it re-derives the candidate set from `criteria` fresh each call — note this means a retry could pick up *new* matching rows created since the first attempt, which is intended behavior, not a bug, but should be stated explicitly to callers.
- **Errors**: partial-failure tolerant — one listing failing does not abort the batch; failures are collected and returned, not thrown.
- **Dependencies**: `queryListings`, `setListingStatus`, `logAdminActivity`.
- **Status**: new — depends on `queryListings` existing first.
- Supporting: `queryListings`, `setListingStatus`. Query: yes. Entity resolution: no (criteria-based, not name-based). Workflow: this *is* the workflow function. AI reasoning: no.

---

## DOMAIN: Agents

### `setAgentVisibility(agentId, updates, client?)` — Existing, reuse as-is

- **Purpose**: change `is_published`/`is_featured` for an agent's public profile.
- **Domain**: Agents.
- **Input**: `{ agentId: string, updates: { is_published?: boolean, is_featured?: boolean } }`
- **Output**: `{ error: string | null }`
- **Validation**: server-enforced business rule — featuring is rejected unless `agent_type === "internal"` (already implemented, `adminOperations.ts:36-46`).
- **Permission**: admin.
- **Risk**: Medium (`is_published`), Low (`is_featured`).
- **Confirmation**: Required.
- **Audit**: Logs `"Agent visibility updated"`.
- **Side effects**: none beyond the row + audit log.
- **Idempotency**: Yes.
- **Errors**: includes the specific business-rule rejection message (`"Only internal agents can be featured..."`), not just a generic DB error — this is a good existing pattern worth reusing for other business-rule validations added later.
- **Dependencies**: `logAdminActivity`.
- **Status**: existing, no changes needed.
- Supporting: none. Query: no. Entity resolution: no. Workflow: no. AI reasoning: no.

### `setAgentActive(agentId, isActive, client?)` — Existing, reuse as-is

- **Purpose**: activate or suspend an agent's account.
- **Domain**: Agents.
- **Input**: `{ agentId: string, isActive: boolean }`
- **Output**: `{ error: string | null }`
- **Validation**: none beyond existence.
- **Permission**: admin.
- **Risk**: Medium (activate) / **High** (suspend — removes access).
- **Confirmation**: Required.
- **Audit**: Logs `"Agent reactivated"`/`"Agent deactivated"`.
- **Side effects**: affects the agent's ability to authenticate/use the portal going forward — not merely a display flag.
- **Idempotency**: Yes.
- **Errors**: pass-through.
- **Dependencies**: `logAdminActivity`.
- **Status**: existing, no changes needed.
- Supporting: none. Query: no. Entity resolution: no. Workflow: no. AI reasoning: no.

### `resendAgentInvite(email, client?)` — Existing, reuse as-is

- **Purpose**: resend an invite or password-reset email.
- **Domain**: Agents.
- **Input**: `{ email: string }`
- **Output**: `{ error: string | null, data?: unknown }`
- **Validation**: valid email format (should be enforced at the caller/UI level today; not verified whether the function itself validates — worth confirming during implementation review, not assumed here).
- **Permission**: admin.
- **Risk**: Low.
- **Confirmation**: Required.
- **Audit**: Logs `"Agent invite resent"`.
- **Side effects**: **sends an email** — not a pure data mutation.
- **Idempotency**: **No** — every call sends another email. Retries must not be silent/automatic.
- **Errors**: edge-function error or embedded `data.error` both surfaced.
- **Dependencies**: edge function `resend-agent-invite`, `logAdminActivity`.
- **Status**: existing, no changes needed.
- Supporting: none. Query: no. Entity resolution: no. Workflow: no. AI reasoning: no.

### `setAgentAdminRole(agentId, enabled, client?)` — Existing function, needs a Copilot tool (not a code refactor)

- **Purpose**: grant or revoke the admin role for a user.
- **Domain**: Agents / Access Control.
- **Input**: `{ agentId: string, enabled: boolean }`
- **Output**: `{ error: string | null, data?: unknown }`
- **Validation**: none beyond existence — **recommend adding** a check that an admin cannot revoke their own admin role via this function (self-lockout prevention), since none was found during the audit.
- **Permission**: admin.
- **Risk**: **High** — privilege escalation.
- **Confirmation**: Required, and per the architecture doc's contract-level guard for High-risk actions, this function should require `{ confirmed: true }` explicitly rather than relying solely on caller-side UI.
- **Audit**: Logs `"Admin role granted"`/`"Admin role revoked"`.
- **Side effects**: calls edge function `admin-set-user-role` (service-role privileged operation).
- **Idempotency**: Yes (granting an already-admin user is a no-op state-wise, though it still calls the edge function and logs again — consider short-circuiting if already in the target state, to avoid redundant audit noise).
- **Errors**: edge-function error or embedded `data.error`.
- **Dependencies**: edge function `admin-set-user-role`, `logAdminActivity`.
- **Status**: existing code, unchanged; **missing piece is the Copilot tool wrapper**, not the function itself — see `docs/copilot/COPILOT_FUNCTION_CATALOG.md`. Recommend adding the self-lockout guard as a small refactor before exposing it to Copilot.
- Supporting: none. Query: no. Entity resolution: yes (needs `resolveAgentByName` if invoked by name rather than ID). Workflow: no. AI reasoning: no.

### `updateAgentProfile(agentId, profileUpdate, agentUpdate, client?)` — Existing, needs refactor before Copilot exposure

- **Purpose**: update an agent's profile fields (name, phone, avatar, CEA number, position, type, experience, specialisations, languages, contact fields, bios, publish/feature flags, display order).
- **Domain**: Agents.
- **Input** (current, full-form shape): `{ agentId, profileUpdate: {full_name, avatar_url, phone}, agentUpdate: {cea_no, position, agent_type, years_experience, specialisations, languages, whatsapp_no, email_display, linkedin_url, bio_en, bio_zh, is_published, is_featured, display_order} }`
- **Output**: `{ error: string | null }`
- **Validation**: CEA format validation currently lives in `EditAgentPage.tsx` (client-side regex `R\d{6}[A-Z]`), **not** inside the function itself — this is a gap: any other caller (Copilot, future API) could write an invalid CEA number. **Refactor required**: move CEA validation into `updateAgentProfile` itself so every caller gets it, not just the one form that happens to check it today.
- **Permission**: admin.
- **Risk**: Low–Medium.
- **Confirmation**: Required.
- **Audit**: Logs `"Agent profile updated"` with the full diff.
- **Side effects**: none beyond the two rows + audit log (avatar upload itself is a separate Storage operation, not part of this function).
- **Idempotency**: Yes.
- **Errors**: pass-through per sub-update (`profiles` vs `agent_profiles`).
- **Dependencies**: `logAdminActivity`.
- **Status**: existing (`adminOperations.ts`, added this session), **refactor needed**: (1) move CEA validation server-side into the function, (2) redesign the input contract for Copilot use — a natural-language request like "change John's position to Senior Associate" should not require the caller to supply all 14 fields; recommend a **partial-update variant** (`updateAgentProfile(agentId, { position: "Senior Associate" })`, merging with existing values) rather than the current full-replace-both-objects shape, specifically to make this safe for Copilot to call without accidentally nulling out fields the user didn't mention.
- Supporting: `resolveAgentByName` (if invoked by name). Query: no. Entity resolution: yes. Workflow: no. AI reasoning: no.

### `queryAgents(filters, client?)` — New

- **Purpose**: server-side filtered agent lookup.
- **Domain**: Agents.
- **Input**: `{ isActive?: boolean, isPublished?: boolean, isFeatured?: boolean, agentType?: "internal"|"external", pendingInvite?: boolean, nameContains?: string, limit?: number (default 20) }`
- **Output**: `{ data: Array<{ id, full_name, email, is_active, is_published, is_featured, agent_type }> | null, error: string | null }`
- **Validation**: `limit` capped.
- **Permission**: admin (read).
- **Risk**: None.
- **Confirmation**: Not required.
- **Audit**: Not required.
- **Side effects**: none.
- **Idempotency**: N/A.
- **Errors**: pass-through.
- **Dependencies**: none.
- **Status**: new.
- Supporting: none. Query: this *is* the query function. Entity resolution: no (but `resolveAgentByName` is built on it). Workflow: no. AI reasoning: no.

### `resolveAgentByName(nameQuery, client?)` — New

- **Purpose**: resolve "John Tan" → a concrete `agentId`, mirroring `resolveListingByTitle`.
- **Domain**: Agents.
- **Input**: `{ nameQuery: string }`
- **Output**: `{ data: { id, full_name } | { candidates: Array<{id, full_name}> } | null, error: string | null }`
- **Validation**: non-empty query.
- **Permission**: admin.
- **Risk**: None.
- **Confirmation**: Not required.
- **Audit**: Not required.
- **Side effects**: none.
- **Idempotency**: N/A.
- **Errors**: pass-through.
- **Dependencies**: `queryAgents`.
- **Status**: new — highest-priority item per `docs/admin/ADMIN_FUNCTION_REQUIREMENTS.md`, since it unblocks every existing agent-targeted L1 function for natural name references.
- Supporting: `queryAgents`. Query: yes. Entity resolution: this *is* it. Workflow: no. AI reasoning: no.

### `bulkResendInvites(criteria, client?)` — New (Workflow)

- **Purpose**: resend invites to every agent matching a filter.
- **Domain**: Agents.
- **Input**: `{ criteria: AgentFilters, confirmed: true }`
- **Output**: `{ data: { succeeded: string[], failed: Array<{email, error}> } | null, error: string | null }`
- **Validation**: non-empty criteria required, same hard rail as `bulkPublishListings`.
- **Permission**: admin.
- **Risk**: Medium.
- **Confirmation**: Itemized preview required before invocation (email-sending side effect, not silently repeatable).
- **Audit**: Per-agent entries via `resendAgentInvite`, plus one batch summary entry.
- **Side effects**: **sends N emails** — not idempotent, must not be retried automatically on partial failure without re-confirming which agents still need it.
- **Idempotency**: **No**, explicitly — same caveat as the underlying function, amplified at batch scale.
- **Errors**: partial-failure tolerant.
- **Dependencies**: `queryAgents`, `resendAgentInvite`, `logAdminActivity`.
- **Status**: new.
- Supporting: `queryAgents`, `resendAgentInvite`. Query: yes. Entity resolution: no. Workflow: this *is* it. AI reasoning: no.

---

## DOMAIN: Applications

### `reviewApplication(applicationId, status, adminNotes?, client?)` — Existing, reuse as-is

- **Purpose**: approve/decline/mark-interview/mark-reviewing an agent application.
- **Domain**: Applications.
- **Input**: `{ applicationId: string, status: "pending"|"reviewing"|"interview"|"approved"|"declined", adminNotes?: string }`
- **Output**: `{ error: string | null }`
- **Validation**: `status` must be one of the enum values (DB-enforced via Postgres enum type as a backstop).
- **Permission**: admin.
- **Risk**: Medium (onboarding decision, reversible by re-review).
- **Confirmation**: Required.
- **Audit**: Logs `"Application marked {status}"` with notes.
- **Side effects**: sets `reviewed_at`/`reviewed_by` — none beyond the row + audit log.
- **Idempotency**: Yes.
- **Errors**: pass-through.
- **Dependencies**: `logAdminActivity`.
- **Status**: existing, no changes needed.
- Supporting: none. Query: no. Entity resolution: no. Workflow: no. AI reasoning: no.

### `queryApplications(filters, client?)` — New

- **Purpose**: server-side filtered application lookup, generalizing today's fixed "top 5 urgent" precompute in `AdminOverview`.
- **Domain**: Applications.
- **Input**: `{ status?: ApplicationStatus, dateFrom?: string, dateTo?: string, limit?: number (default 20) }`
- **Output**: `{ data: Array<{ id, full_name, email, status, current_agency, created_at }> | null, error: string | null }`
- **Validation**: `dateFrom <= dateTo` if both given; `limit` capped.
- **Permission**: admin (read).
- **Risk**: None.
- **Confirmation**: Not required.
- **Audit**: Not required.
- **Side effects**: none.
- **Idempotency**: N/A.
- **Errors**: pass-through.
- **Dependencies**: none.
- **Status**: new.
- Supporting: none. Query: this *is* it. Entity resolution: no. Workflow: no. AI reasoning: no (but is the data source for the existing "which applications need attention first?" reasoning function — see Copilot catalog).

### `batchReviewApplications(criteria, decisions, client?)` — New (Workflow)

- **Purpose**: propose a status change for every application matching a filter, based on caller-supplied decision logic.
- **Domain**: Applications.
- **Input**: `{ criteria: ApplicationFilters, decisions: Array<{ applicationId, status, adminNotes? }>, confirmed: true }` — note `decisions` is explicit per-item, not a single rule applied blindly; the caller (Copilot reasoning over `queryApplications(criteria)` results) must produce the per-applicant decision list, this function only executes an already-decided batch.
- **Output**: `{ data: { succeeded: string[], failed: Array<{id, error}> } | null, error: string | null }`
- **Validation**: every `applicationId` in `decisions` must appear in the `criteria` result set at call time (defense against a stale/tampered decision list).
- **Permission**: admin.
- **Risk**: **High** — irreversible-in-spirit onboarding decisions at scale.
- **Confirmation**: Given the risk, recommend the caller (Copilot/Workflow UI) require the admin to confirm **each** decision individually rather than a single batch-level confirm, even though this function accepts a pre-decided batch — the "workflow" value is in *proposing* the batch coherently, not in one-click executing irreversible-feeling decisions on real applicants.
- **Audit**: Per-application entries via `reviewApplication`, plus one batch summary entry.
- **Side effects**: none beyond the rows + audit log (no emails sent by this function itself, unlike the agent-invite workflows).
- **Idempotency**: Per-item idempotent; re-running with the same `decisions` array is safe.
- **Errors**: partial-failure tolerant.
- **Dependencies**: `queryApplications`, `reviewApplication`, `logAdminActivity`.
- **Status**: new.
- Supporting: `queryApplications`, `reviewApplication`. Query: yes. Entity resolution: no. Workflow: this *is* it. AI reasoning: **the decision-making itself is AI reasoning if the batch was proposed by Copilot** — this function is deterministic execution of an already-made decision list, not the reasoning step; see `docs/copilot/COPILOT_FUNCTION_CATALOG.md` for how the decisions get produced.

---

## DOMAIN: Market Insights

Refactor recommendation: split the current single generic `saveMarketInsight(id, form)` into narrow, single-purpose functions for the operations that are actually distinct user intents, while keeping `saveMarketInsight` itself as the internal implementation detail each of these calls. This mirrors how `adminOperations.ts` already exposes narrow functions (`setListingStatus`, `setListingFeatured`) rather than one generic `updateListing(id, form)` — Market Insights should follow the same convention for consistency and for cleaner Copilot tool schemas (a tool with 3 possible fields to change is harder to specify safely than 3 tools with 1 field each).

### `createInsight(form, client?)` — Refactor (extract from `saveMarketInsight`)

- **Purpose**: create a new market insight report.
- **Domain**: Market Insights.
- **Input**: `MarketInsightForm` (title, category, description, body, file_url, cover_url, is_featured, display_order, period, read_time, published).
- **Output**: `{ data: MarketInsight | null, error: string | null }`
- **Validation**: `title` required/non-empty (not currently enforced in `saveMarketInsight` — worth adding).
- **Permission**: admin.
- **Risk**: Low.
- **Confirmation**: Required.
- **Audit**: Logs `"Market insight created"` (now does, as of this session's fix to `saveMarketInsight`).
- **Side effects**: none beyond the row + audit log.
- **Idempotency**: No — each call creates a new row (correct for a create operation).
- **Errors**: pass-through.
- **Dependencies**: `logAdminActivity`.
- **Status**: refactor — currently the `id === null` branch of `saveMarketInsight`; splitting it out clarifies intent for Copilot tool wrapping.
- Supporting: none. Query: no. Entity resolution: no. Workflow: no. AI reasoning: no (content generation to *populate* the form is a separate, already-existing AI-draft feature — `marketInsightCopilot.ts` — not part of this function).

### `setInsightPublished(id, published, client?)` — New (narrow wrapper)

- **Purpose**: publish/unpublish a market insight.
- **Domain**: Market Insights.
- **Input**: `{ id: string, published: boolean }`
- **Output**: `{ error: string | null }`
- **Validation**: existence via update-by-id.
- **Permission**: admin.
- **Risk**: Low.
- **Confirmation**: Required.
- **Audit**: Logs `"Market insight published"`/`"Market insight unpublished"`.
- **Side effects**: none beyond the row + audit log.
- **Idempotency**: Yes.
- **Errors**: pass-through.
- **Dependencies**: internally calls the existing `saveMarketInsight(id, {...existing, published})` pattern, or a lower-level single-column update — implementation detail, not fixed here.
- **Status**: new (narrow wrapper around existing lower-level logic).
- Supporting: none (fetches current row first to preserve other fields, or uses a single-column update if the underlying table supports partial updates directly). Query: no. Entity resolution: no. Workflow: no. AI reasoning: no.

### `setInsightFeatured(id, featured, client?)` — New (narrow wrapper)

Same shape as `setInsightPublished`, targeting `is_featured` instead of `published_at`. Risk: Low. Same audit/confirmation/idempotency profile.

### `reorderInsight(id, displayOrder, client?)` — New (narrow wrapper)

Same shape, targeting `display_order`. Risk: Low (cosmetic ordering only). Same profile.

---

## DOMAIN: Cross-Domain Support

### `queryEnquiryTrend(filters, client?)` — New

- **Purpose**: time-bucketed count of `property_enquiries`/`property_view_logs`, the deterministic data source for any "why did X change" reasoning.
- **Domain**: Cross-domain (Listings + Analytics).
- **Input**: `{ propertyId?: string, dateFrom: string, dateTo: string, bucket: "day"|"week" }`
- **Output**: `{ data: Array<{ bucketStart: string, count: number }> | null, error: string | null }`
- **Validation**: `dateFrom < dateTo`, range capped (e.g. max 1 year) to bound query cost.
- **Permission**: admin.
- **Risk**: None.
- **Confirmation**: Not required.
- **Audit**: Not required.
- **Side effects**: none.
- **Idempotency**: N/A.
- **Errors**: pass-through.
- **Dependencies**: none — but **this table/query pattern does not exist today**; this is new deterministic infrastructure, not just a new function signature on top of existing data access.
- **Status**: new, larger effort than other L2 functions (needs a real time-bucketing query, likely a Postgres function/view rather than a plain `.select()`).
- Supporting: none. Query: this *is* it. Entity resolution: no. Workflow: no. AI reasoning: no (feeds the L4 "why did enquiries drop" reasoning function in the Copilot catalog).

---

## Summary Table

| Function | Domain | Status | Risk | Confirm | Audit |
|---|---|---|---|---|---|
| `setListingStatus` | Listings | Existing | Medium | Yes | Yes |
| `setListingFeatured` | Listings | Existing | Low | Yes | Yes |
| `queryListings` | Listings | New | None | No | No |
| `resolveListingByTitle` | Listings | New | None | No | No |
| `bulkPublishListings` | Listings | New (workflow) | High | Yes, itemized | Yes (per-item + summary) |
| `setAgentVisibility` | Agents | Existing | Low–Medium | Yes | Yes |
| `setAgentActive` | Agents | Existing | Medium–High | Yes | Yes |
| `resendAgentInvite` | Agents | Existing | Low | Yes | Yes |
| `setAgentAdminRole` | Agents | Existing (needs self-lockout guard) | High | Yes, explicit | Yes |
| `updateAgentProfile` | Agents | Existing (needs refactor) | Low–Medium | Yes | Yes |
| `queryAgents` | Agents | New | None | No | No |
| `resolveAgentByName` | Agents | New | None | No | No |
| `bulkResendInvites` | Agents | New (workflow) | Medium | Yes, itemized | Yes (per-item + summary) |
| `reviewApplication` | Applications | Existing | Medium | Yes | Yes |
| `queryApplications` | Applications | New | None | No | No |
| `batchReviewApplications` | Applications | New (workflow) | High | Yes, per-item recommended | Yes (per-item + summary) |
| `createInsight` | Insights | Refactor | Low | Yes | Yes |
| `setInsightPublished` | Insights | New (narrow wrapper) | Low | Yes | Yes |
| `setInsightFeatured` | Insights | New (narrow wrapper) | Low | Yes | Yes |
| `reorderInsight` | Insights | New (narrow wrapper) | Low | Yes | Yes |
| `queryEnquiryTrend` | Cross-domain | New (larger effort) | None | No | No |
