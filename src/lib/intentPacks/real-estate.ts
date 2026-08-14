// Client half of the "real-estate" Intent Pack — the actual handler code,
// requires an engineer to write/edit (unlike the server half's plain
// phrase lists). These are the exact same handler bodies that used to
// live inline in AIChatPanel.tsx's regex-triggered gates — only how
// they're *triggered* changed, not what they do.

import { supabase } from "@/integrations/supabase/client";
import type { MessageAction, MessageAttachment, ConvoState } from "@/components/command/CommandContext";

export interface IntentHandlerDeps {
  addAssistantMessage: (text: string, actions?: MessageAction[], folderPills?: string[]) => void;
  setConvoState: (state: ConvoState) => void;
  setPendingAttachments: (atts: MessageAttachment[]) => void;
  pendingAttachments: MessageAttachment[];
  loadFolders: () => Promise<void>;
  uploadFileToFolder: (att: MessageAttachment, folderName: string) => Promise<boolean | undefined>;
  slugify: (s: string) => string;
  toTitleCase: (s: string) => string;
}

// ─── Property-detail extraction (moved here from AIChatPanel.tsx, unchanged) ───
// Split into a raw extractor (always returns whatever it found, even a
// single field) and the gated version below (requires enough to be
// confident this message is *starting* a listing). The raw version exists
// for the property_extracted continuation gate in AIChatPanel.tsx, which
// doesn't need that confidence gate — the conversation state already
// proves intent, so even a single new field (e.g. "actually it's
// freehold") should merge in.
function extractPropertyDetailsRaw(text: string): Record<string, string> {
  const lower = text.toLowerCase();
  const details: Record<string, string> = {};

  const priceMatch = text.match(/\$[\d,.]+[mk]?/i) || text.match(/([\d,.]+)\s*(?:million|mil|m)\b/i);
  if (priceMatch) {
    let raw = priceMatch[0].replace(/[$,]/g, "");
    if (/m|mil|million/i.test(raw)) {
      raw = String(parseFloat(raw.replace(/[^\d.]/g, "")) * 1_000_000);
    }
    details.price = `$${Number(raw).toLocaleString()}`;
  }

  const brMatch = text.match(/(\d+)\s*(?:bed(?:room)?s?|br)\b/i);
  if (brMatch) details.bedrooms = brMatch[1];

  const sizeMatch = text.match(/([\d,]+)\s*(?:sq\s*ft|sqft|sf)\b/i);
  if (sizeMatch) details.size = sizeMatch[1].replace(/,/g, "") + " sqft";

  if (/freehold/i.test(lower)) details.tenure = "Freehold";
  else if (/leasehold|99.?year/i.test(lower)) details.tenure = "Leasehold";

  if (/\bcondo/i.test(lower)) details.type = "Condo";
  else if (/\bhdb\b/i.test(lower)) details.type = "HDB";
  else if (/\bshophouse/i.test(lower)) details.type = "Shophouse";
  else if (/\blanded/i.test(lower)) details.type = "Landed";

  const addrMatch = text.match(/(?:at|in|on)\s+([A-Z][A-Za-z\s]+(?:Road|Street|Avenue|Boulevard|Drive|Lane|Place|Crescent|Way|Close|Terrace|Walk|Hill|Rise|Park|Gardens?|Heights?|Tower|Residences?|Court)?)/);
  if (addrMatch) details.address = addrMatch[1].trim();

  return details;
}

export function extractPropertyDetails(text: string) {
  const details = extractPropertyDetailsRaw(text);
  const hasEnough = Object.keys(details).length >= 2 && (details.price || details.address);
  return hasEnough ? details : null;
}

// ─── Merge a follow-up free-text reply into an in-progress listing draft ───
// Used by the property_extracted continuation gate in AIChatPanel.tsx: the
// agent already confirmed she's drafting a listing (that's what put the
// conversation in this state), so any new detail found here should merge
// in and re-show the confirm prompt — no confidence gate needed, unlike
// the initial classifier trigger.
export function mergePropertyDetails(text: string, existing: Record<string, string>): Record<string, string> {
  return { ...existing, ...extractPropertyDetailsRaw(text) };
}

export function formatPropertySummary(details: Record<string, string>): string {
  const lines: string[] = [];
  if (details.address) lines.push(`📍 ${details.address}`);
  const typeParts = [details.bedrooms ? `${details.bedrooms}BR` : "", details.type || "", details.size || "", details.tenure || ""].filter(Boolean).join(" · ");
  if (typeParts) lines.push(`🏠 ${typeParts}`);
  if (details.price) lines.push(`💰 ${details.price}`);
  return lines.join("\n");
}

// ─── create_folder handler (extracted from the old 2.2e regex gate) ───
async function handleCreateFolderIntent(text: string, deps: IntentHandlerDeps): Promise<void> {
  const folderCmdMatch = text.match(/(?:create|new|make)\s+(?:a\s+)?folder\s*[""'"']?\s*([^""'"']+?)(?:[""'"']?\s*$)/i)
    || text.match(/(?:create|new|make)\s+(?:a\s+)?folder\s*[""'"']\s*(.+?)\s*[""'"']/i)
    || text.match(/(?:create|new|make)\s+(?:a\s+)?folder\s+(?:called|named|for)\s+[""'"']?\s*(.+?)(?:[""'"']?\s*$)/i);
  const inlineName = folderCmdMatch?.[1]?.replace(/[""'"']/g, "").trim();
  const atts = deps.pendingAttachments.length > 0 ? deps.pendingAttachments : [];

  if (inlineName) {
    const slug = deps.slugify(inlineName);
    const { data: { session } } = await supabase.auth.getSession();

    // Duplicate check
    if (session) {
      const { data: existing, count } = await supabase
        .from("agent_files")
        .select("id", { count: "exact" })
        .eq("agent_id", session.user.id)
        .eq("folder_name", slug)
        .limit(1);

      if (existing && existing.length > 0) {
        const visibleCount = count || 0;
        deps.addAssistantMessage(
          `Folder **${deps.toTitleCase(slug)}** already exists with ${visibleCount} file${visibleCount !== 1 ? "s" : ""}. Want to add files to it, or create a folder with a different name?`,
          [
            { label: "📁 Add to existing folder", icon: "📁", id: "add_to_existing" },
            { label: "✨ Use a different name", icon: "✨", id: "create_new_folder" },
          ]
        );
        deps.setPendingAttachments(atts);
        deps.setConvoState({ mode: "awaiting_folder_select", attachments: atts });
        return;
      }
    }

    // No duplicate — create folder
    deps.addAssistantMessage(`Creating folder **${deps.toTitleCase(slug)}**...`);

    if (atts.length > 0) {
      for (const att of atts) {
        await deps.uploadFileToFolder(att, slug);
      }
      deps.addAssistantMessage(`✅ Folder **'${deps.toTitleCase(slug)}'** created with your ${atts.length} file${atts.length > 1 ? "s" : ""}.`);
    } else {
      if (session) {
        await supabase.from("agent_files").insert({
          agent_id: session.user.id,
          file_name: ".folder",
          file_url: "",
          file_type: "placeholder",
          file_size: 0,
          storage_path: `${session.user.id}/${slug}/.folder`,
          folder_name: slug,
          category: "listing",
          processing_status: "complete",
        });
      }
      deps.addAssistantMessage(`✅ Folder **'${deps.toTitleCase(slug)}'** created. Upload photos or documents to this folder anytime.`);
    }

    deps.setConvoState({ mode: "idle" });
    deps.setPendingAttachments([]);
    await deps.loadFolders();
    return;
  }

  deps.addAssistantMessage("Sure! What should I name the folder?");
  deps.setConvoState({ mode: "awaiting_folder_name", attachments: atts });
}

// ─── start_listing handler (extracted from the old 2.2f gate) ───
async function handleStartListingIntent(text: string, deps: IntentHandlerDeps): Promise<void> {
  const extracted = extractPropertyDetails(text);

  if (!extracted) {
    // Classifier was confident this is about a listing, but the regex
    // extractor couldn't pull enough fields out — don't do nothing (the
    // turn already committed to handling this herself), ask instead.
    deps.addAssistantMessage(
      "Sounds like you're describing a new listing — tell me a bit more (price, size, bedrooms, address) and I'll get it started, or I can open a blank listing form for you.",
      [{ label: "Open Listing Form", icon: "🏠", id: "start_listing" }]
    );
    return;
  }

  deps.addAssistantMessage(
    `Got it. I've noted:\n\n${formatPropertySummary(extracted)}\n\nWant me to create the listing now, or do you have photos to add first?`,
    [
      { label: "Create Listing Now", icon: "✓", id: "create_listing_now" },
      { label: "Add Photos First", icon: "📷", id: "add_photos_first" },
    ]
  );
  deps.setConvoState({ mode: "property_extracted", details: extracted });
}

export function createHandlers(deps: IntentHandlerDeps): Record<string, (text: string) => Promise<void>> {
  return {
    create_folder: (text: string) => handleCreateFolderIntent(text, deps),
    start_listing: (text: string) => handleStartListingIntent(text, deps),
  };
}
