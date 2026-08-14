import { streamARIA } from "@/lib/ariaClient";
import type { MarketInsight, MarketInsightForm } from "@/lib/marketInsights";

export type MarketInsightCopilotDraft = MarketInsightForm & {
  sourceNotes: string;
};

type DraftContextItem = Pick<
  MarketInsight,
  "title" | "category" | "published_at" | "is_featured" | "display_order"
>;

export function buildMarketInsightCopilotContext(items: DraftContextItem[]) {
  const featured = items.filter((item) => item.is_featured).length;
  const published = items.filter((item) => !!item.published_at).length;

  return [
    "MARKET INSIGHT ADMIN CONTEXT",
    `- Total insights: ${items.length}`,
    `- Published: ${published}`,
    `- Featured: ${featured}`,
    "",
    "Existing insight titles:",
    ...(items.length
      ? items
          .slice(0, 10)
          .map((item) => `- ${item.title} (${item.category ?? "MARKET OUTLOOK"}, ${item.published_at ? "published" : "draft"})`)
      : ["- None"]),
  ].join("\n");
}

export async function generateMarketInsightDraft({
  prompt,
  authToken,
  context,
}: {
  prompt: string;
  authToken: string | null;
  context: string;
}): Promise<{ data: MarketInsightCopilotDraft | null; error: string | null; rawText: string }> {
  if (!authToken) {
    return { data: null, error: "You must be signed in to use the copilot.", rawText: "" };
  }

  let streamedText = "";
  const messages = [
    {
      role: "user" as const,
      content: [
        "You are an admin copilot for a Singapore real-estate website.",
        "Turn the admin's market insight brief into a clean draft for the admin form.",
        "Return ONLY valid JSON with these keys:",
        `title, category, description, body, file_url, cover_url, is_featured, display_order, period, read_time, published, sourceNotes`,
        "",
        "Rules:",
        "- category should usually be MARKET OUTLOOK unless the brief clearly suggests another category.",
        "- description should be a short card excerpt.",
        "- body should be a polished article body with paragraphs and bullet points where helpful.",
        "- read_time should be a human-friendly value like '7 min read'.",
        "- published must be false unless the admin explicitly asks to publish immediately.",
        "- sourceNotes should explain the image direction, gaps to review, or any assumptions.",
        "- If the brief does not include a direct image URL, leave cover_url and file_url as empty strings.",
        "",
        "Current page context:",
        context,
        "",
        "Admin brief:",
        prompt,
      ].join("\n"),
    },
  ];

  const result = await new Promise<{ data: MarketInsightCopilotDraft | null; error: string | null; rawText: string }>((resolve) => {
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

function parseDraft(rawText: string): MarketInsightCopilotDraft | null {
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const candidate = tryParseJson(stripped) ?? tryParseJson(extractJsonBlock(stripped));
  if (!candidate) return null;

  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const category = typeof candidate.category === "string" ? candidate.category.trim() : "MARKET OUTLOOK";
  const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
  const body = typeof candidate.body === "string" ? candidate.body.trim() : "";
  const fileUrl = typeof candidate.file_url === "string" ? candidate.file_url.trim() : "";
  const coverUrl = typeof candidate.cover_url === "string" ? candidate.cover_url.trim() : "";
  const sourceNotes = typeof candidate.sourceNotes === "string" ? candidate.sourceNotes.trim() : "";
  const readTime = typeof candidate.read_time === "string" ? candidate.read_time.trim() : "7 min read";
  const period = typeof candidate.period === "string" ? candidate.period.trim() : "";
  const displayOrder = Number(candidate.display_order);

  if (!title || !body) return null;

  return {
    title,
    category: category || "MARKET OUTLOOK",
    description,
    body,
    file_url: fileUrl,
    cover_url: coverUrl,
    is_featured: Boolean(candidate.is_featured),
    display_order: Number.isFinite(displayOrder) ? displayOrder : 100,
    period,
    read_time: readTime || "7 min read",
    published: Boolean(candidate.published),
    sourceNotes,
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
