import { streamARIA } from "@/lib/ariaClient";
import type { AdminListing } from "@/components/admin/adminOverview";

export type ListingCopilotDraft = {
  prefill: Record<string, unknown>;
  sourceNotes: string;
  suggestedOwnerName: string;
  suggestedOwnerEmail: string;
  suggestedOwnerId: string;
};

type ListingContextItem = Pick<
  AdminListing,
  "title" | "title_zh" | "status" | "is_featured" | "view_count" | "price" | "monthly_rental" | "price_on_enquiry"
> & {
  property_name?: string | null;
  type?: string | null;
  district?: number | null;
  agent_name?: string | null;
};

export function buildListingCopilotContext(items: ListingContextItem[]) {
  const active = items.filter((item) => item.status === "active").length;
  const draft = items.filter((item) => item.status === "draft").length;
  const featured = items.filter((item) => item.is_featured).length;

  return [
    "LISTING ADMIN CONTEXT",
    `- Total listings: ${items.length}`,
    `- Active: ${active}`,
    `- Draft: ${draft}`,
    `- Featured: ${featured}`,
    "",
    "Existing listing titles:",
    ...(items.length
      ? items
          .slice(0, 10)
          .map((item) => `- ${item.property_name ?? item.title} (${item.status}, ${item.type ?? "property"})`)
      : ["- None"]),
  ].join("\n");
}

export async function generateListingDraft({
  prompt,
  authToken,
  context,
}: {
  prompt: string;
  authToken: string | null;
  context: string;
}): Promise<{ data: ListingCopilotDraft | null; error: string | null; rawText: string }> {
  if (!authToken) {
    return { data: null, error: "You must be signed in to use the copilot.", rawText: "" };
  }

  let streamedText = "";
  const messages = [
    {
      role: "user" as const,
      content: [
        "You are an admin copilot for a Singapore real-estate website.",
        "Turn the admin's listing brief into a clean draft for the admin listing form.",
        "Return ONLY valid JSON with these keys:",
        `prefill, sourceNotes, suggestedOwnerName, suggestedOwnerEmail, suggestedOwnerId`,
        "",
        "The `prefill` object should use the same field names as the admin listing form. Include only what you can infer safely.",
        "Useful prefill keys: transaction_type, property_type, property_name, unit_number, address, postal_code, district, mrt_nearest, mrt_distance_m, title, title_zh, size_sqft, floor_level, total_units, bedrooms, bathrooms, car_parks, tenure, top_year, facing, furnishing, availability_date, price, monthly_rental, price_on_enquiry, description_en, description_zh, virtual_tour_url, cobroke_enabled, cobroke_commission, owner_bottom_price, reason_for_selling, owner_urgency, private_notes, photos, floorPlans.",
        "If there is no suitable value for a field, omit it or use an empty string / empty array where appropriate.",
        "Set `price_on_enquiry` only when the brief clearly says so.",
        "Set `photos` to an array of image URLs if the brief mentions them.",
        "sourceNotes should explain what was inferred and what the admin still needs to confirm.",
        "suggestedOwner* fields should be blank unless the brief clearly names one specific owner.",
        "",
        "Current page context:",
        context,
        "",
        "Admin brief:",
        prompt,
      ].join("\n"),
    },
  ];

  const result = await new Promise<{ data: ListingCopilotDraft | null; error: string | null; rawText: string }>((resolve) => {
    void streamARIA({
      messages,
      assistantRole: "admin",
      assistantContext: context,
      authToken,
      onDelta: (delta) => {
        streamedText += delta;
      },
      onDone: (cleanText) => {
        const rawText = (cleanText || streamedText).trim();
        const parsed = parseDraft(rawText);
        if (!parsed) {
          resolve({
            data: null,
            error: "The copilot response was not valid JSON. Try giving a clearer brief.",
            rawText,
          });
          return;
        }

        resolve({ data: parsed, error: null, rawText });
      },
      onError: (error) => {
        resolve({ data: null, error, rawText: streamedText.trim() });
      },
    });
  });

  return result;
}

function parseDraft(rawText: string): ListingCopilotDraft | null {
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const candidate = tryParseJson(stripped) ?? tryParseJson(extractJsonBlock(stripped));
  if (!candidate || typeof candidate !== "object") return null;

  const prefill = typeof candidate.prefill === "object" && candidate.prefill ? candidate.prefill as Record<string, unknown> : {};
  const sourceNotes = typeof candidate.sourceNotes === "string" ? candidate.sourceNotes.trim() : "";
  const suggestedOwnerName = typeof candidate.suggestedOwnerName === "string" ? candidate.suggestedOwnerName.trim() : "";
  const suggestedOwnerEmail = typeof candidate.suggestedOwnerEmail === "string" ? candidate.suggestedOwnerEmail.trim() : "";
  const suggestedOwnerId = typeof candidate.suggestedOwnerId === "string" ? candidate.suggestedOwnerId.trim() : "";

  return {
    prefill,
    sourceNotes,
    suggestedOwnerName,
    suggestedOwnerEmail,
    suggestedOwnerId,
  };
}

function extractJsonBlock(text: string) {
  const blockMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (blockMatch?.[1]) return blockMatch[1].trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
