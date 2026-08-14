import { streamARIA } from "@/lib/ariaClient";

export type AgentInviteDraft = {
  fullName: string;
  email: string;
  phone: string;
  preferredLang: "en" | "zh";
  ceaNo: string;
  yearsExperience: number | "";
  agentType: "internal" | "external";
  position: string;
  specialisations: string[];
  languages: string[];
  linkedinUrl: string;
  displayOrder: number | "";
  bioEn: string;
  bioZh: string;
  sourceNotes: string;
};

export function buildAgentInviteCopilotContext(items: Array<{ full_name: string | null; email: string | null; agent_type: string | null; is_published: boolean | null; is_featured: boolean | null }>) {
  const internal = items.filter((item) => item.agent_type === "internal").length;
  const published = items.filter((item) => item.is_published).length;

  return [
    "AGENT INVITE ADMIN CONTEXT",
    `- Total agents: ${items.length}`,
    `- Internal agents: ${internal}`,
    `- Published on team page: ${published}`,
    "",
    "Existing agent names:",
    ...(items.length
      ? items.slice(0, 10).map((item) => `- ${item.full_name ?? item.email ?? "Unnamed agent"} (${item.agent_type ?? "unknown"})`)
      : ["- None"]),
  ].join("\n");
}

export async function generateAgentInviteDraft({
  prompt,
  authToken,
  context,
}: {
  prompt: string;
  authToken: string | null;
  context: string;
}): Promise<{ data: AgentInviteDraft | null; error: string | null; rawText: string }> {
  if (!authToken) {
    return { data: null, error: "You must be signed in to use the copilot.", rawText: "" };
  }

  let streamedText = "";
  const messages = [
    {
      role: "user" as const,
      content: [
        "You are an admin copilot for a Singapore real-estate website.",
        "Turn the admin's agent invite brief into a clean draft for the invite form.",
        "Return ONLY valid JSON with these keys:",
        `fullName, email, phone, preferredLang, ceaNo, yearsExperience, agentType, position, specialisations, languages, linkedinUrl, displayOrder, bioEn, bioZh, sourceNotes`,
        "",
        "Rules:",
        "- preferredLang must be 'en' or 'zh'.",
        "- agentType must be 'internal' or 'external'.",
        "- specialisations and languages must be arrays of strings.",
        "- yearsExperience and displayOrder can be numbers or empty strings if unknown.",
        "- ceaNo should follow the format R123456A when known, otherwise empty string.",
        "- sourceNotes should explain what is inferred and what the admin still needs to confirm before sending.",
        "",
        "Current page context:",
        context,
        "",
        "Admin brief:",
        prompt,
      ].join("\n"),
    },
  ];

  const result = await new Promise<{ data: AgentInviteDraft | null; error: string | null; rawText: string }>((resolve) => {
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

function parseDraft(rawText: string): AgentInviteDraft | null {
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const candidate = tryParseJson(stripped) ?? tryParseJson(extractJsonBlock(stripped));
  if (!candidate || typeof candidate !== "object") return null;

  const fullName = typeof candidate.fullName === "string" ? candidate.fullName.trim() : "";
  const email = typeof candidate.email === "string" ? candidate.email.trim() : "";
  const phone = typeof candidate.phone === "string" ? candidate.phone.trim() : "";
  const preferredLang = candidate.preferredLang === "zh" ? "zh" : "en";
  const ceaNo = typeof candidate.ceaNo === "string" ? candidate.ceaNo.trim().toUpperCase() : "";
  const yearsExperience = typeof candidate.yearsExperience === "number" ? candidate.yearsExperience : candidate.yearsExperience === "" ? "" : "";
  const agentType = candidate.agentType === "internal" ? "internal" : "external";
  const position = typeof candidate.position === "string" ? candidate.position.trim() : "";
  const specialisations = Array.isArray(candidate.specialisations) ? candidate.specialisations.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
  const languages = Array.isArray(candidate.languages) ? candidate.languages.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : ["English"];
  const linkedinUrl = typeof candidate.linkedinUrl === "string" ? candidate.linkedinUrl.trim() : "";
  const displayOrder = typeof candidate.displayOrder === "number" ? candidate.displayOrder : candidate.displayOrder === "" ? "" : 99;
  const bioEn = typeof candidate.bioEn === "string" ? candidate.bioEn.trim() : "";
  const bioZh = typeof candidate.bioZh === "string" ? candidate.bioZh.trim() : "";
  const sourceNotes = typeof candidate.sourceNotes === "string" ? candidate.sourceNotes.trim() : "";

  if (!fullName || !email || !phone) return null;

  return {
    fullName,
    email,
    phone,
    preferredLang,
    ceaNo,
    yearsExperience,
    agentType,
    position,
    specialisations,
    languages: languages.length ? languages : ["English"],
    linkedinUrl,
    displayOrder,
    bioEn,
    bioZh,
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
