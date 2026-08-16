import { matchIntent } from "./intentPatterns";
import { resolveListingByTitle, resolveAgentByName } from "./entityResolvers";
import { queryAgents, queryListings } from "./adminQueries";
import { previewPublishApprovedListings } from "./workflows";
import { gatherFeaturedListingCandidates, buildFeaturedListingsGroundingPrompt } from "./reasoning";
import type { AdminPendingAction } from "./AdminCommandContext";

/**
 * Orchestrates the full deterministic pipeline (steps 1-4): pattern match
 * -> entity resolution -> a pending action shaped identically to what the
 * LLM tool-use path produces. See docs/copilot/INTENT_MODEL.md.
 *
 * `status: "resolved"` and `status: "navigate"` mean the message was fully
 * handled without ever calling the LLM. `status: "unmatched"` means the
 * caller should fall through to the existing streamARIA/tool-use path
 * (step 5) — this module never blocks that fallback, it only short-circuits
 * it when it can do so with full confidence.
 */
export type InterpretationResult =
  | { status: "resolved"; action: AdminPendingAction }
  | { status: "navigate"; screen: string }
  | { status: "ambiguous"; message: string }
  | { status: "not_found"; message: string }
  | { status: "query_result"; message: string }
  // Level 4: deterministic data was gathered and formatted (steps 1-3 of
  // the architecture) — the caller must now perform step 4 (the actual
  // model call) itself, since this module deliberately never talks to the LLM.
  | { status: "needs_reasoning"; groundingPrompt: string }
  | { status: "unmatched" };

function buildAction(name: string, input: Record<string, unknown>, title: string, description: string): AdminPendingAction {
  return { id: crypto.randomUUID(), name, input, title, description };
}

/** Level 2 queries are read-only — no confirmation, execute immediately, format a plain-language result. */
async function runAgentsActiveQuery(targetValue: boolean): Promise<InterpretationResult> {
  const result = await queryAgents({ isActive: targetValue, limit: 20 });
  if (result.error) return { status: "query_result", message: `Couldn't load agents: ${result.error}` };
  if (result.data.length === 0) {
    return { status: "query_result", message: `No ${targetValue ? "active" : "inactive"} agents found.` };
  }
  const names = result.data.map((a) => a.fullName).join(", ");
  return {
    status: "query_result",
    message: `Found ${result.data.length} ${targetValue ? "active" : "inactive"} agent${result.data.length === 1 ? "" : "s"}: ${names}.`,
  };
}

async function runListingsBedroomsPriceQuery(bedrooms: number, priceMax: number): Promise<InterpretationResult> {
  const result = await queryListings({ bedrooms, priceMax, limit: 20 });
  if (result.error) return { status: "query_result", message: `Couldn't load listings: ${result.error}` };
  if (result.data.length === 0) {
    return { status: "query_result", message: `No ${bedrooms}-bedroom listings found below $${priceMax.toLocaleString()}.` };
  }
  const items = result.data
    .map((l) => `"${l.title}" (${l.price ? `$${l.price.toLocaleString()}` : "price on enquiry"})`)
    .join(", ");
  return {
    status: "query_result",
    message: `Found ${result.data.length} ${bedrooms}-bedroom listing${result.data.length === 1 ? "" : "s"} below $${priceMax.toLocaleString()}: ${items}.`,
  };
}

async function resolvePublishOrFeature(
  match: { entityText: string; targetValue: boolean },
  kind: "publish" | "feature"
): Promise<InterpretationResult> {
  // Ambiguous verb: try listings first (the more common case in an admin
  // real-estate portal), then agents. See docs/copilot/INTENT_MODEL.md
  // "Known Ambiguity" section for why this order was chosen and what it
  // means if the intended target was actually the other type.
  const listingResult = await resolveListingByTitle(match.entityText);
  if (listingResult.status === "single") {
    const listing = listingResult.entity;
    if (kind === "publish") {
      return {
        status: "resolved",
        action: buildAction(
          "admin_set_listing_status",
          { listing_id: listing.id, status: match.targetValue ? "active" : "draft" },
          "Change listing status",
          `"${listing.title}" will be ${match.targetValue ? "published" : "moved to draft"}.`
        ),
      };
    }
    return {
      status: "resolved",
      action: buildAction(
        "admin_set_listing_featured",
        { listing_id: listing.id, featured: match.targetValue },
        "Change featured listing",
        `"${listing.title}" will be ${match.targetValue ? "featured" : "unfeatured"}.`
      ),
    };
  }

  if (listingResult.status === "ambiguous") {
    return {
      status: "ambiguous",
      message: `I found ${listingResult.candidates.length} listings matching "${match.entityText}": ${listingResult.candidates
        .map((c) => `"${c.title}"`)
        .join(", ")}. Try again with the full title.`,
    };
  }

  const agentResult = await resolveAgentByName(match.entityText);
  if (agentResult.status === "single") {
    const agent = agentResult.entity;
    return {
      status: "resolved",
      action: buildAction(
        "admin_set_agent_visibility",
        kind === "publish" ? { agent_id: agent.id, is_published: match.targetValue } : { agent_id: agent.id, is_featured: match.targetValue },
        "Update agent visibility",
        kind === "publish"
          ? `${agent.fullName} will be ${match.targetValue ? "shown on" : "hidden from"} the public Team page.`
          : `${agent.fullName} will be ${match.targetValue ? "featured" : "unfeatured"} on the homepage.`
      ),
    };
  }

  if (agentResult.status === "ambiguous") {
    return {
      status: "ambiguous",
      message: `I found ${agentResult.candidates.length} agents matching "${match.entityText}": ${agentResult.candidates
        .map((c) => c.fullName)
        .join(", ")}. Which one did you mean?`,
    };
  }

  return { status: "not_found", message: `I couldn't find a listing or agent matching "${match.entityText}".` };
}

export async function interpretAdminMessage(rawText: string): Promise<InterpretationResult> {
  const matched = matchIntent(rawText);
  if (!matched) return { status: "unmatched" };

  switch (matched.kind) {
    case "reasoning_recommend_featured": {
      const { data: candidates, error } = await gatherFeaturedListingCandidates();
      if (error) return { status: "query_result", message: `Couldn't gather listing data: ${error}` };
      if (candidates.length === 0) return { status: "query_result", message: "No active listings found to recommend from." };
      return { status: "needs_reasoning", groundingPrompt: buildFeaturedListingsGroundingPrompt(rawText, candidates) };
    }

    case "navigate":
      return { status: "navigate", screen: matched.screen };

    case "resend_invite":
      return {
        status: "resolved",
        action: buildAction(
          "admin_resend_agent_invite",
          { email: matched.email },
          "Resend agent invite",
          `Invite or recovery email will be sent to ${matched.email}.`
        ),
      };

    case "agent_active": {
      const result = await resolveAgentByName(matched.entityText);
      if (result.status === "single") {
        const agent = result.entity;
        return {
          status: "resolved",
          action: buildAction(
            "admin_set_agent_active",
            { agent_id: agent.id, is_active: matched.targetValue },
            "Change agent active status",
            `${agent.fullName} will be ${matched.targetValue ? "activated" : "suspended"}.`
          ),
        };
      }
      if (result.status === "ambiguous") {
        return {
          status: "ambiguous",
          message: `I found ${result.candidates.length} agents matching "${matched.entityText}": ${result.candidates
            .map((c) => c.fullName)
            .join(", ")}. Which one did you mean?`,
        };
      }
      return { status: "not_found", message: `I couldn't find an agent matching "${matched.entityText}".` };
    }

    case "publish":
      return resolvePublishOrFeature(matched, "publish");

    case "feature":
      return resolvePublishOrFeature(matched, "feature");

    case "query_agents_active":
      return runAgentsActiveQuery(matched.targetValue);

    case "query_listings_bedrooms_price":
      return runListingsBedroomsPriceQuery(matched.bedrooms, matched.priceMax);

    case "query_not_supported":
      return { status: "query_result", message: matched.reason };

    case "workflow_not_supported":
      return { status: "query_result", message: matched.reason };

    case "workflow_publish_approved_listings": {
      const preview = await previewPublishApprovedListings();
      if (preview.error) return { status: "query_result", message: `Couldn't check approved listings: ${preview.error}` };

      const { ready, notReady } = preview.data!;
      if (ready.length === 0 && notReady.length === 0) {
        return { status: "query_result", message: "No approved, unpublished listings found — nothing to publish." };
      }
      if (ready.length === 0) {
        return {
          status: "query_result",
          message: `${notReady.length} approved listing${notReady.length === 1 ? " is" : "s are"} waiting, but none are ready to publish yet: ${notReady
            .map((c) => `"${c.title}" (${c.reasons.join(", ")})`)
            .join("; ")}.`,
        };
      }

      const readySummary = ready.map((c) => `"${c.title}"`).join(", ");
      const notReadySummary =
        notReady.length > 0
          ? ` ${notReady.length} more approved listing${notReady.length === 1 ? " is" : "s are"} not ready and will be skipped: ${notReady
              .map((c) => `"${c.title}" (${c.reasons.join(", ")})`)
              .join("; ")}.`
          : "";

      return {
        status: "resolved",
        action: buildAction(
          "admin_workflow_publish_approved_listings",
          {},
          "Publish approved listings",
          `This will publish ${ready.length} listing${ready.length === 1 ? "" : "s"}: ${readySummary}.${notReadySummary}`
        ),
      };
    }

    default:
      return { status: "unmatched" };
  }
}
