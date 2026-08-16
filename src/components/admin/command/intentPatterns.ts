/**
 * Steps 1-3 of the interpretation pipeline (exact command, alias/synonym,
 * pattern matching) — pure, synchronous, no I/O. See docs/copilot/INTENT_MODEL.md.
 *
 * Deliberately narrow: only intents with an unambiguous verb->function
 * mapping and a clean "verb + entity name" shape are covered here. Anything
 * requiring free-form field extraction (profile edits, application review
 * notes) or open-ended reasoning is intentionally left to the existing
 * LLM tool-use path — this module must never guess.
 */

export type NavigateMatch = { kind: "navigate"; screen: string };
export type PublishMatch = { kind: "publish"; entityText: string; targetValue: boolean };
export type FeatureMatch = { kind: "feature"; entityText: string; targetValue: boolean };
export type AgentActiveMatch = { kind: "agent_active"; entityText: string; targetValue: boolean };
export type ResendInviteMatch = { kind: "resend_invite"; email: string };
// Level 2: structured filter queries, matched deterministically where the
// phrasing is regular enough — see docs/copilot/LEVEL_2_IMPLEMENTATION.md.
export type QueryAgentsActiveMatch = { kind: "query_agents_active"; targetValue: boolean };
export type QueryListingsBedroomsPriceMatch = { kind: "query_listings_bedrooms_price"; bedrooms: number; priceMax: number };
export type QueryNotSupportedMatch = { kind: "query_not_supported"; reason: string };
// Level 3: multi-function workflows — see docs/copilot/LEVEL_3_WORKFLOWS.md.
export type WorkflowPublishApprovedListingsMatch = { kind: "workflow_publish_approved_listings" };
export type WorkflowNotSupportedMatch = { kind: "workflow_not_supported"; reason: string };
// Level 4: genuine AI reasoning — see docs/copilot/LEVEL_4_REASONING.md.
export type ReasoningRecommendFeaturedMatch = { kind: "reasoning_recommend_featured" };

export type MatchedIntent =
  | NavigateMatch
  | PublishMatch
  | FeatureMatch
  | AgentActiveMatch
  | ResendInviteMatch
  | QueryAgentsActiveMatch
  | QueryListingsBedroomsPriceMatch
  | QueryNotSupportedMatch
  | WorkflowPublishApprovedListingsMatch
  | WorkflowNotSupportedMatch
  | ReasoningRecommendFeaturedMatch;

// --- Step 1: exact command --------------------------------------------------

const EXACT_SCREEN_COMMANDS: Record<string, string> = {
  dashboard: "dashboard",
  agents: "agents",
  listings: "listings",
  properties: "listings",
  applications: "applications",
  reports: "reports",
  settings: "settings",
  activity: "activity",
  "activity log": "activity",
  insights: "insights",
  "market insights": "insights",
};

// --- Step 2/3: alias + pattern matching, per verb category ------------------
// Each pattern's capture group is the raw entity text. Order matters within
// a category (more specific phrasings first); category order matters too
// (checked in matchIntent's fixed priority order below).

const PUBLISH_TRUE_PATTERNS: RegExp[] = [
  /^publish\s+(.+)$/i,
  /^put\s+(.+?)\s+live$/i,
  /^make\s+(.+?)\s+live$/i,
  /^go\s+live\s+(?:with|on)?\s*(.+)$/i,
  /^(.+?)\s+(?:is|goes)\s+live(?:\s+now)?$/i,
];

const PUBLISH_FALSE_PATTERNS: RegExp[] = [
  /^unpublish\s+(.+)$/i,
  /^take\s+down\s+(.+)$/i,
  /^move\s+(.+?)\s+to\s+draft$/i,
  /^draft\s+(.+)$/i,
  /^hide\s+(.+)$/i,
];

const FEATURE_TRUE_PATTERNS: RegExp[] = [
  /^feature\s+(.+)$/i,
  /^add\s+(.+?)\s+to\s+featured$/i,
  /^highlight\s+(.+)$/i,
];

const FEATURE_FALSE_PATTERNS: RegExp[] = [
  /^unfeature\s+(.+)$/i,
  /^remove\s+(.+?)\s+from\s+featured$/i,
  /^un-?highlight\s+(.+)$/i,
];

const AGENT_ACTIVE_TRUE_PATTERNS: RegExp[] = [
  /^activate\s+(.+)$/i,
  /^reactivate\s+(.+)$/i,
  /^enable\s+(.+?)(?:'s)?\s+account$/i,
  /^unsuspend\s+(.+)$/i,
];

const AGENT_ACTIVE_FALSE_PATTERNS: RegExp[] = [
  /^suspend\s+(.+)$/i,
  /^deactivate\s+(.+)$/i,
  /^disable\s+(.+?)(?:'s)?\s+account$/i,
];

const RESEND_INVITE_PATTERNS: RegExp[] = [
  /^resend\s+(?:the\s+)?invite\s+(?:to|for)\s+(.+)$/i,
  /^resend\s+(?:invite|invitation)\s+(.+)$/i,
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Level 2: structured filter queries -------------------------------------

const QUERY_AGENTS_ACTIVE_PATTERN = /^(?:show|list|find)\s+(?:me\s+)?(?:all\s+)?(active|inactive)\s+agents$/i;

// "Show three-bedroom properties below $3M" / "show 3 bedroom listings under 1.5m"
const QUERY_LISTINGS_BEDROOMS_PRICE_PATTERN =
  /^(?:show|list|find)\s+(?:me\s+)?(?:all\s+)?(\d+|one|two|three|four|five|six)[\s-]*bedroom\s+(?:properties|listings)\s+(?:below|under)\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(m|k)?$/i;

const WORD_TO_NUMBER: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

function parseBedroomCount(raw: string): number | null {
  const lower = raw.toLowerCase();
  if (lower in WORD_TO_NUMBER) return WORD_TO_NUMBER[lower];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parsePriceWithUnit(raw: string, unit: string | undefined): number | null {
  const base = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  if (unit?.toLowerCase() === "m") return base * 1_000_000;
  if (unit?.toLowerCase() === "k") return base * 1_000;
  return base;
}

// "Expiring"/"expiry" has no corresponding column anywhere in the
// properties table (confirmed against src/integrations/supabase/types.ts —
// see docs/copilot/LEVEL_2_IMPLEMENTATION.md). Rather than let this fall
// through to an LLM tool schema that would have to either omit the field
// (silently ignoring the request) or fabricate one, this is intercepted
// deterministically with an honest capability-boundary message.
const QUERY_NOT_SUPPORTED_PATTERNS: Array<{ test: RegExp; reason: string }> = [
  {
    test: /expir/i,
    reason:
      "Listings don't currently track an expiry date in this system — there's no such field to filter on. If that's needed, it would require a schema change, not just a smarter query.",
  },
];

// --- Level 3: multi-function workflows --------------------------------------

const WORKFLOW_PUBLISH_APPROVED_PATTERN =
  /^publish\s+all\s+approved\s+(?:properties|listings)(?:\s+that\s+are\s+ready)?$/i;

// Same "expir" boundary as the Level 2 query case, checked first so a
// workflow-shaped request about expiring listings gets the same honest
// answer rather than silently falling through to "unmatched".
const WORKFLOW_NOT_SUPPORTED_PATTERNS: Array<{ test: RegExp; reason: string }> = [
  {
    test: /prepare\s+expir.*(?:for\s+review|listings)|expir.*(?:listings?|properties)\s+for\s+review/i,
    reason:
      "There's no expiry date tracked on listings in this system, so there's nothing to identify as \"expiring\" — this workflow would need a schema change (an expiry field) before it could exist.",
  },
];

// --- Level 4: genuine AI reasoning ------------------------------------------
// Deliberately narrow trigger — only requests that are genuinely asking for
// a *judgement call* (which of several similar options is best) match here.
// A request answerable by a plain filter belongs in Level 2, not here.
const REASONING_RECOMMEND_FEATURED_PATTERN =
  /^(?:which|what)\s+(?:properties|listings)\s+should\s+(?:we|i)\s+feature\b/i;

function tryPatterns(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanEntityText(match[1]);
  }
  return null;
}

/**
 * Strips leading noise words a captured entity phrase commonly carries
 * ("the", and the generic role noun "agent"/"listing"/"property") so
 * "Deactivate agent A102" resolves against "A102", not "agent A102" —
 * these nouns never identify anything themselves, they just name the
 * entity type, which the intent's `kind` already encodes.
 */
function cleanEntityText(raw: string): string {
  return raw
    .trim()
    .replace(/^the\s+/i, "")
    .replace(/^(agent|listing|property)\s+/i, "")
    .trim();
}

/**
 * Runs steps 1-3 against a raw user message. Returns null if nothing
 * matched — the caller (interpreter.ts) must then fall through to entity
 * resolution being skipped entirely and the existing LLM path taking over.
 * Never throws, never guesses at an entity it can't cleanly extract.
 */
export function matchIntent(rawText: string): MatchedIntent | null {
  // Strip trailing sentence punctuation so "Put Marina Residence live."
  // matches the same as "Put Marina Residence live" — the patterns below
  // anchor on `$` and would otherwise reject any message ending in a period.
  const text = rawText.trim().replace(/[.!?]+$/, "");
  if (!text) return null;

  // Step 1: exact command (case-insensitive, whole-message match only).
  const exactScreen = EXACT_SCREEN_COMMANDS[text.toLowerCase()];
  if (exactScreen) return { kind: "navigate", screen: exactScreen };

  // Level 4: genuine reasoning requests, checked before Level 2/3 since
  // "which properties should we feature" is a judgement call, not a filter.
  if (REASONING_RECOMMEND_FEATURED_PATTERN.test(text)) {
    return { kind: "reasoning_recommend_featured" };
  }

  // Level 3, checked before Level 2's "expir" boundary since a workflow
  // phrasing ("prepare expiring listings for review") is more specific
  // than a bare query and deserves its own message.
  for (const { test, reason } of WORKFLOW_NOT_SUPPORTED_PATTERNS) {
    if (test.test(text)) return { kind: "workflow_not_supported", reason };
  }

  if (WORKFLOW_PUBLISH_APPROVED_PATTERN.test(text)) {
    return { kind: "workflow_publish_approved_listings" };
  }

  // Level 2, checked early: an honest "can't do that" beats guessing.
  for (const { test, reason } of QUERY_NOT_SUPPORTED_PATTERNS) {
    if (test.test(text)) return { kind: "query_not_supported", reason };
  }

  // Level 2: structured filter queries with a fully regular shape.
  const agentsActiveMatch = text.match(QUERY_AGENTS_ACTIVE_PATTERN);
  if (agentsActiveMatch) {
    return { kind: "query_agents_active", targetValue: agentsActiveMatch[1].toLowerCase() === "active" };
  }

  const listingsMatch = text.match(QUERY_LISTINGS_BEDROOMS_PRICE_PATTERN);
  if (listingsMatch) {
    const bedrooms = parseBedroomCount(listingsMatch[1]);
    const priceMax = parsePriceWithUnit(listingsMatch[2], listingsMatch[3]);
    if (bedrooms !== null && priceMax !== null) {
      return { kind: "query_listings_bedrooms_price", bedrooms, priceMax };
    }
  }

  // Step 2/3: resend-invite (email is self-identifying, no entity
  // resolution needed at all — the cheapest possible non-trivial case).
  const inviteTarget = tryPatterns(text, RESEND_INVITE_PATTERNS);
  if (inviteTarget && EMAIL_REGEX.test(inviteTarget)) {
    return { kind: "resend_invite", email: inviteTarget.toLowerCase() };
  }

  // Step 2/3: agent activate/suspend — unambiguous verb, always an agent.
  const activeTarget = tryPatterns(text, AGENT_ACTIVE_TRUE_PATTERNS);
  if (activeTarget) return { kind: "agent_active", entityText: activeTarget, targetValue: true };
  const suspendTarget = tryPatterns(text, AGENT_ACTIVE_FALSE_PATTERNS);
  if (suspendTarget) return { kind: "agent_active", entityText: suspendTarget, targetValue: false };

  // Step 2/3: publish/unpublish — ambiguous between listing and agent
  // (Team page). Entity-type resolution happens in interpreter.ts, which
  // tries listings first, then agents — see docs/copilot/INTENT_MODEL.md.
  const publishTarget = tryPatterns(text, PUBLISH_TRUE_PATTERNS);
  if (publishTarget) return { kind: "publish", entityText: publishTarget, targetValue: true };
  const unpublishTarget = tryPatterns(text, PUBLISH_FALSE_PATTERNS);
  if (unpublishTarget) return { kind: "publish", entityText: unpublishTarget, targetValue: false };

  // Step 2/3: feature/unfeature — same ambiguity, same resolution order.
  const featureTarget = tryPatterns(text, FEATURE_TRUE_PATTERNS);
  if (featureTarget) return { kind: "feature", entityText: featureTarget, targetValue: true };
  const unfeatureTarget = tryPatterns(text, FEATURE_FALSE_PATTERNS);
  if (unfeatureTarget) return { kind: "feature", entityText: unfeatureTarget, targetValue: false };

  return null;
}
