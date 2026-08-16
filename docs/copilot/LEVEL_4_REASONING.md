# Copilot Level 4 Reasoning

Implemented 2026-08-17. Level 4 is architecturally different from Levels
1-3 (`docs/copilot/LEVEL_1_IMPLEMENTATION.md`,
`LEVEL_2_IMPLEMENTATION.md`, `LEVEL_3_WORKFLOWS.md`): it is the one tier
where an LLM call is not merely permitted but *required* — the task is a
genuine judgement call, not something deterministic code can answer. What
stays deterministic is everything **around** that call: what data the
model sees, how it's retrieved, and what happens with whatever the model
recommends.

## Why Only One Capability Was Built

The task's instruction is explicit: "Implement Level 4 only for
capabilities that genuinely require AI reasoning." One capability —
"Which properties should we feature this weekend?" — was built completely
and tested. This is a deliberate scoping choice, not a shortcut: building
a second, weaker example just to have more coverage would work against
the point of Level 4, which is to be used *sparingly*, only where
deterministic code genuinely cannot answer.

## Architecture (exactly as specified)

```
User: "Which properties should we feature this weekend?"
    ↓
[1] Determine information required        — intentPatterns.ts recognizes this
    ↓                                       as a genuine judgement call, not
    ↓                                       a filterable query (Level 2) or a
    ↓                                       named single-listing action (Level 1)
[2] Deterministic data retrieval           — reasoning.ts::gatherFeaturedListingCandidates()
    ↓                                       queries real rows only, requireAdmin()-gated
[3] Provide authoritative data to AI       — reasoning.ts::buildFeaturedListingsGroundingPrompt()
    ↓                                       formats the real rows into the model's sole
    ↓                                       source of truth, with explicit grounding rules
[4] AI reasoning                            — AdminChatPanel.tsx calls streamARIA() with the
    ↓                                       grounded prompt as the model's input
[5] Return recommendations with reasons     — plain text response, no tool call
    ↓
[6] If the user chooses an action           — a SEPARATE follow-up message ("feature Marina
    → deterministic Admin Actions             Residence") is handled entirely by the existing
                                              Level 1 pipeline — this reasoning step never
                                              executes anything itself
```

Steps 1-3 live in `src/components/admin/command/intentPatterns.ts` and
`reasoning.ts` — pure, synchronous pattern matching plus typed,
`requireAdmin()`-gated Supabase queries, both fully unit-tested without
ever touching the LLM. Step 4 is the **only** place in this entire
capability that calls Claude — `AdminChatPanel.tsx::sendMessage()`,
reusing the exact same `streamARIA()` client already used for every other
Copilot interaction, no new API integration. Step 5 is just that
response, displayed as a normal chat message. Step 6 is not new code at
all — it's `docs/copilot/LEVEL_1_IMPLEMENTATION.md`'s existing pipeline,
unchanged, triggered by whatever the admin types next.

## Files

- `src/components/admin/command/reasoning.ts` — `gatherFeaturedListingCandidates()`, `formatFeaturedCandidatesForPrompt()`, `buildFeaturedListingsGroundingPrompt()`. Zero LLM calls in this file.
- `src/components/admin/command/intentPatterns.ts` — `REASONING_RECOMMEND_FEATURED_PATTERN`, deliberately narrow (see below).
- `src/components/admin/command/interpreter.ts` — the `reasoning_recommend_featured` case, returning a new `status: "needs_reasoning"` result carrying the fully-built grounding prompt and nothing else.
- `src/components/admin/command/AdminChatPanel.tsx` — the one place that actually calls the model, by substituting the grounding prompt into the message sent to `streamARIA()` while leaving the user's own visible chat bubble unchanged.

## What Data Is Supplied to the Model, and Why

This is the core of what makes this a safe Level 4 implementation rather
than "let the LLM figure it out."

| Field | Source | Why it's included |
|---|---|---|
| `title` (preferring `property_name` over `title`) | `properties` table | The model needs to name what it's recommending — without this it can't produce a usable answer. |
| `price` / `monthly_rental` | `properties` table | Directly requested context for a "should we feature this" judgement — price point is a normal factor in a featuring decision. |
| `bedrooms` | `properties` table | Same reasoning — a factual attribute the model can legitimately cite. |
| `view_count` | `properties` table | **The performance signal.** This is the one column in this schema that functions as an engagement/performance proxy — see "What Was Deliberately Left Out" below for what else was considered and why it wasn't included. |
| `is_featured` | `properties` table | So the model doesn't recommend re-featuring something already featured, and can reason about which currently-unfeatured listings deserve a look. |
| `created_at` | `properties` table | Lets the model factor in recency (a newer high-performing listing is a different case from a stale one) without fabricating a notion of "freshness" from nothing. |

**Every field above is a real column**, cross-checked against
`src/integrations/supabase/types.ts` while building `reasoning.ts` — none
of it is inferred, estimated, or invented. Only `status: "active"`
listings are fetched (querying `properties.eq("status", "active")`) —
draft/unpublished listings are excluded because "feature this weekend" is
inherently about content that's already live.

**Row limit**: capped at 20, ordered by `view_count` descending. This
bounds the prompt size (cost/latency) while keeping the highest-signal
candidates — a listing ranked 40th by views is unlikely to be a strong
featuring candidate anyway, so the cap is a reasonable tradeoff, not an
arbitrary one.

### What Was Deliberately Left Out

- **`property_enquiries` (a separate table tracking enquiry events)** was
  considered as a second performance signal alongside `view_count`, since
  "performance data" in the task's own architecture description
  reasonably suggests more than page views. It was not included in this
  pass: aggregating it (a `COUNT(*) GROUP BY property_id` query) is
  additional query-layer work beyond a straightforward column read, and
  `view_count` alone is a real, already-available, single-column signal
  that satisfies "give the model real performance data" without
  overbuilding. If enquiry-count grounding is wanted later, it's a new
  query function alongside `gatherFeaturedListingCandidates()`, not a
  redesign of this architecture.
- **Anything not returned by the query is not sent to the model, ever.**
  There's no fallback to "let the model guess" for a field that isn't in
  the `FeaturedCandidate` type — the prompt-building function
  (`formatFeaturedCandidatesForPrompt`) can only render fields that exist
  on the typed row.

## Grounding Discipline

`buildFeaturedListingsGroundingPrompt()` implements the
`ai_grounded_reasoning` pattern already added to the base library earlier
this session (`base-library/11-copilot/execution-patterns/ai-grounding-pattern.md`)
— specifically:

1. **Fresh data, every time.** `gatherFeaturedListingCandidates()` is
   called at the moment the request is interpreted, not reused from
   earlier in the conversation or from the general `AdminOverview`
   context blob (which doesn't carry per-listing view counts anyway).
2. **The literal query result is injected as the sole source of
   grounding**, inside an explicit `[AUTHORITATIVE DATA]` block, with the
   instruction: *"Do not use any figures, listings, or view counts that
   are not present below."*
3. **Uncertainty is explicitly permitted, not just tolerated.** The
   prompt states: *"If the data doesn't clearly favor any listing over
   the others..., say so plainly instead of inventing a distinguishing
   reason."* This is stated as a correct outcome, not a failure to avoid
   — directly following the grounding pattern's own guidance.
4. **The response is instructed to be recommendation-only, not
   action-taking**: *"Do not propose a tool call — respond in plain text
   only. The admin will separately ask to feature a specific listing if
   they agree."* This is the mechanism that makes step 6 ("if the user
   chooses an action, call deterministic Admin Actions") a genuinely
   separate step rather than something the reasoning call does itself.

## The LLM Never Modifies the Database

Verified at every layer, consistent with every prior level this session:

- `reasoning.ts` never calls the LLM — it only builds a prompt string.
- The model's response to the grounding prompt is plain conversational
  text (the prompt explicitly asks it not to propose a tool call for
  this). Even if it did propose one anyway, the existing confirm-before-execute
  infrastructure (`docs/copilot/LEVEL_1_IMPLEMENTATION.md`) would still
  require an explicit admin confirmation before anything executed — this
  reasoning capability doesn't weaken that guarantee, it simply doesn't
  need to exercise it.
- Acting on a Level 4 recommendation is always a **new, separate**
  message from the admin ("feature Marina Residence"), processed by the
  completely unrelated, already-tested Level 1 deterministic pipeline.
  The reasoning step and the action step do not share any execution code
  — they're connected only by the admin reading the recommendation and
  deciding what to type next.

## Why the Trigger Pattern Is Deliberately Narrow

`REASONING_RECOMMEND_FEATURED_PATTERN` only matches "which/what
properties/listings should we/I feature" — it does not attempt to catch
every conceivable phrasing of a featuring-recommendation request. Two
reasons:

1. **Precision over recall for the boundary between levels.** A false
   match here would send a request that should have been a Level 1/2
   action through an expensive, slower LLM round-trip instead. A missed
   match just falls through to the general LLM tool-use path, which can
   still reason about it conversationally — so under-matching is the safe
   failure mode, over-matching is not.
2. **Consistency with every other level built this session** — Level 1's
   `docs/copilot/INTENT_MODEL.md` and Level 2's `docs/copilot/LEVEL_2_IMPLEMENTATION.md`
   both state the same principle: never guess at an intent it isn't
   confident about.

## Testing

`src/components/admin/command/reasoning.test.ts` (8 tests) — data
retrieval (permission enforcement, row mapping, error handling) and
prompt construction (every real field renders correctly, the "no active
listings" honest fallback, the grounding instructions are present
verbatim) are all tested without any LLM call. `intentPatterns.test.ts`
(+4 tests, 26 total) and `interpreter.test.ts` (+3 tests, 22 total) cover
the task's exact worked example end-to-end up to (but not including) the
model call itself — confirming the right data is gathered and the right
prompt is built, without needing to mock or invoke Claude. Full project
suite: 12 files / 108 tests, `tsc --noEmit` clean, `vite build` clean.

## What Isn't Tested (and Why That's the Right Boundary)

The actual model call (`streamARIA()` inside `AdminChatPanel.tsx`) is not
covered by a new automated test in this pass — it reuses the same
streaming client already used by every other Copilot interaction in this
codebase, none of which have dedicated render-level tests either (no
`AdminChatPanel.test.tsx` exists in this repo at all, prior or after this
session). Adding one now would be scope beyond what this task asked for
and inconsistent with the existing test-coverage boundary for this file.
What *is* tested — and is the part that actually matters for "the LLM
must not directly modify the database" — is everything upstream (what
data reaches the model, in what shape, under what permission
constraints) and everything downstream (any resulting action goes through
the already-tested Level 1 pipeline). The model call itself is a thin,
already-battle-tested pass-through in between.
