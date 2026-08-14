import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useCommand, Message, MessageAction, MessageAttachment, ConvoState } from "./CommandContext";
import { streamARIA, classifyIntent, ChatMessage, ToolCall } from "@/lib/ariaClient";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, X, FileText, Image as ImageIcon, Folder, PanelLeftClose } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChatInputBar, Attachment } from "./ChatInputBar";
import {
  bookViewing, rescheduleViewing, updateViewingStatus, VIEWING_STATUSES, ViewingStatus,
} from "./scenes/viewingOperations";
import { shareLead } from "./scenes/leadShareOperations";
import { createLead, updateLeadStatus, LEAD_STATUSES } from "./scenes/leadOperations";
import { createTask, setTaskCompletion } from "./scenes/taskOperations";
import { getActivePack } from "@/lib/intentPacks";
import { mergePropertyDetails, formatPropertySummary } from "@/lib/intentPacks/real-estate";

const placeholders = [
  "Ask me anything about your leads...",
  "Try: 'Show me my best performing listing'",
  "Try: 'Draft a WhatsApp for a client'",
  "Try: 'What's my commission on a $2.8M sale?'",
  "Try: 'Schedule a viewing for Friday at 3pm'",
];

// ─── Helpers ────────────────────────────────────────────
function slugify(str: string) {
  return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toTitleCase(str: string) {
  return str.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSize(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// Best-effort conversion to a wa.me-compatible phone number (digits only,
// with a Singapore country code assumed for bare 8-digit local numbers).
function toWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.length === 8) return `65${digits}`;
  return digits;
}

function fillTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

interface UpcomingViewingMatch {
  id: string;
  scheduled_at: string;
  lead_full_name: string | null;
}

// Shared by ARIA's viewing_reschedule/viewing_update_status tools — resolves
// a lead named in chat to their upcoming (pending/confirmed) viewings, the
// same fuzzy-match-then-disambiguate pattern as lead_view.
async function findUpcomingViewingsByLeadName(agentId: string, name: string): Promise<UpcomingViewingMatch[]> {
  const { data: leadMatches } = await supabase
    .from("leads")
    .select("id, full_name")
    .eq("agent_id", agentId)
    .ilike("full_name", `%${name}%`)
    .limit(10);

  if (!leadMatches || leadMatches.length === 0) return [];

  const leadIds = leadMatches.map((l) => l.id);
  const { data: viewings } = await supabase
    .from("viewings")
    .select("id, scheduled_at, lead_id")
    .eq("agent_id", agentId)
    .in("lead_id", leadIds)
    .in("status", ["pending", "confirmed"])
    .order("scheduled_at", { ascending: true });

  const nameById = new Map(leadMatches.map((l) => [l.id, l.full_name]));
  return (viewings || []).map((v) => ({
    id: v.id,
    scheduled_at: v.scheduled_at,
    lead_full_name: nameById.get(v.lead_id) || null,
  }));
}

// Best-effort lead lookup for task_create's optional lead_name — only links
// the task when the name resolves to exactly one lead; an ambiguous or
// missing match just leaves the task unlinked rather than guessing, since
// this is soft enrichment, not the action itself.
async function findSingleLeadIdByName(agentId: string, name: string): Promise<string | null> {
  const { data } = await supabase
    .from("leads")
    .select("id")
    .eq("agent_id", agentId)
    .ilike("full_name", `%${name}%`)
    .limit(2);
  return data?.length === 1 ? data[0].id : null;
}

interface OpenTaskMatch {
  id: string;
  title: string;
}

// Shared by ARIA's task_complete tool — resolves a task named in chat by
// title fragment, same fuzzy-match-then-disambiguate pattern as lead_view.
async function findOpenTasksByTitle(agentId: string, title: string): Promise<OpenTaskMatch[]> {
  const { data } = await supabase
    .from("agent_tasks")
    .select("id, title")
    .eq("agent_id", agentId)
    .eq("is_completed", false)
    .ilike("title", `%${title}%`)
    .limit(6);
  return data || [];
}

export function AIChatPanel({ className = "" }: { className?: string }) {
  const { state, dispatch, navigateTo } = useCommand();
  const [input, setInput] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendRef = useRef<(text: string) => void>(() => {});
  const { toast } = useToast();

  const [convoState, setConvoState] = useState<ConvoState>({ mode: "idle" });
  const [folders, setFolders] = useState<string[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);

  // Load folders + notify FilesScene
  const loadFolders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("agent_files")
      .select("folder_name")
      .eq("agent_id", session.user.id);
    if (data) {
      const unique = [...new Set(data.map(f => f.folder_name).filter(Boolean))] as string[];
      setFolders(unique.filter(n => n !== "unassigned"));
    }
    window.dispatchEvent(new CustomEvent("folder_created"));
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  // Listen for external send requests (e.g. New Folder button in FilesScene)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text) {
        sendRef.current(detail.text);
      }
    };
    window.addEventListener("aria_send_message", handler);
    return () => window.removeEventListener("aria_send_message", handler);
  }, []);

  // Rotate placeholders
  useEffect(() => {
    const timer = setInterval(() => setPlaceholderIdx((i) => (i + 1) % placeholders.length), 5000);
    return () => clearInterval(timer);
  }, []);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.messages]);

  // ─── Add message helpers ─────────────────────────────
  const addUserMessage = useCallback((content: string, attachments?: MessageAttachment[]) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      attachments,
      createdAt: new Date(),
    };
    dispatch({ type: "ADD_MESSAGE", message: msg });
    return msg;
  }, [dispatch]);

  const addAssistantMessage = useCallback((content: string, actions?: MessageAction[], folderPills?: string[]) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      actions,
      folderPills,
      createdAt: new Date(),
    };
    dispatch({ type: "ADD_MESSAGE", message: msg });
    return msg;
  }, [dispatch]);

  // ─── File upload to Supabase ─────────────────────────
  const uploadFileToFolder = useCallback(async (att: MessageAttachment, folderName: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !att.file) return;

    const agentId = session.user.id;
    const fileName = `${Date.now()}-${att.name}`;
    const storagePath = `${agentId}/${folderName}/${fileName}`;
    const fileType = att.type === "image" ? "image" : att.file.type === "application/pdf" ? "document" : "text";

    const { error } = await supabase.storage.from("agent-uploads").upload(storagePath, att.file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return false;
    }

    const { data: { publicUrl } } = supabase.storage.from("agent-uploads").getPublicUrl(storagePath);

    await supabase.from("agent_files").insert({
      agent_id: agentId,
      file_name: att.name,
      file_url: publicUrl,
      file_type: fileType,
      file_size: att.file.size,
      storage_path: storagePath,
      folder_name: folderName,
      processing_status: "pending",
    });

    return true;
  }, [toast]);

  // ─── Fast-path intent handlers — sourced from the active Intent Pack,
  // so this component doesn't hardcode real-estate-specific logic itself ───
  const intentHandlerDeps = useMemo(() => ({
    addAssistantMessage,
    setConvoState,
    setPendingAttachments,
    pendingAttachments,
    loadFolders,
    uploadFileToFolder,
    slugify,
    toTitleCase,
  }), [addAssistantMessage, loadFolders, uploadFileToFolder, pendingAttachments]);

  const intentHandlers = useMemo(
    () => getActivePack().createHandlers(intentHandlerDeps),
    [intentHandlerDeps]
  );

  // ─── Handle action button clicks ─────────────────────
  const handleAction = useCallback(async (actionId: string, payload?: Record<string, string>) => {
    if (actionId === "copy_draft_message") {
      if (payload?.text) {
        try {
          await navigator.clipboard.writeText(payload.text);
          toast({ title: "Copied", description: "Message copied to clipboard." });
        } catch {
          toast({ title: "Couldn't copy", description: "Select and copy the text manually.", variant: "destructive" });
        }
      }
    } else if (actionId === "open_whatsapp_draft") {
      if (payload?.phone) {
        const url = `https://wa.me/${payload.phone}${payload.text ? `?text=${encodeURIComponent(payload.text)}` : ""}`;
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        toast({ title: "No phone number", description: "This lead doesn't have a phone number on file.", variant: "destructive" });
      }
    } else if (actionId === "goto_calendar") {
      navigateTo("calendar");
    } else if (actionId === "goto_leads") {
      navigateTo("leads");
    } else if (actionId === "goto_lead_detail") {
      if (payload?.lead_id) navigateTo("lead_detail", { lead_id: payload.lead_id });
    } else if (actionId === "goto_reschedule_viewing") {
      if (payload?.viewing_id && payload?.new_scheduled_at) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await rescheduleViewing({
          agentId: user.id,
          viewingId: payload.viewing_id,
          newScheduledAt: payload.new_scheduled_at,
        });
        if (error) {
          toast({ title: "Couldn't reschedule", description: error, variant: "destructive" });
        } else {
          toast({ title: "Viewing rescheduled" });
        }
      }
    } else if (actionId === "goto_update_viewing_status") {
      if (payload?.viewing_id && payload?.status) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await updateViewingStatus(
          user.id,
          payload.viewing_id,
          payload.status as ViewingStatus,
          payload.reason || undefined
        );
        if (error) {
          toast({ title: "Couldn't update viewing", description: error, variant: "destructive" });
        } else {
          toast({ title: "Viewing updated" });
        }
      }
    } else if (actionId === "goto_complete_task") {
      if (payload?.task_id) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await setTaskCompletion(user.id, payload.task_id, true);
        if (error) {
          toast({ title: "Couldn't update task", description: error, variant: "destructive" });
        } else {
          toast({ title: "Task marked done" });
        }
      }
    } else if (actionId === "add_to_existing") {
      if (folders.length === 0) {
        addAssistantMessage("You don't have any folders yet. Let me create one for you. What's this property called or where is it located?");
        setConvoState({ mode: "awaiting_folder_name", attachments: pendingAttachments });
        return;
      }
      addAssistantMessage("Which folder should I add this to?", undefined, folders);
      setConvoState({ mode: "awaiting_folder_select", attachments: pendingAttachments });
    } else if (actionId === "create_new_folder") {
      addAssistantMessage("What's this property called or where is it located? I'll name the folder for you.");
      setConvoState({ mode: "awaiting_folder_name", attachments: pendingAttachments });
    } else if (actionId === "start_listing") {
      addAssistantMessage("Sure! Tell me the property details — address, price, bedrooms, size, etc. I'll prepare the listing form for you.");
      setConvoState({ mode: "idle" });
    } else if (actionId === "create_listing_now") {
      if (convoState.mode === "property_extracted") {
        sessionStorage.setItem("aria_prefill", JSON.stringify(convoState.details));
        addAssistantMessage("I've prepared the listing form with your details. Opening it now...");
        navigateTo("listing_form");
        setConvoState({ mode: "idle" });
      }
    } else if (actionId === "add_photos_first") {
      addAssistantMessage("No problem! Upload your photos and documents using the + button, and I'll add them to the listing when you're ready.");
      setConvoState({ mode: "idle" });
    } else if (actionId === "same_folder") {
      // Multi-file: add all to same folder flow
      addAssistantMessage("Which folder? You can pick an existing one or I'll create a new one.", [
        { label: "📁 Add to existing folder", icon: "📁", id: "add_to_existing" },
        { label: "✨ Create new property folder", icon: "✨", id: "create_new_folder" },
      ]);
    } else if (actionId === "sort_individually") {
      addAssistantMessage("OK, let's sort them one by one. Tell me where each file should go, or upload them one at a time.");
      setConvoState({ mode: "idle" });
    }
  }, [folders, pendingAttachments, convoState, addAssistantMessage, navigateTo, toast]);

  // ─── Handle folder pill click ────────────────────────
  const handleFolderSelect = useCallback(async (folderName: string) => {
    if (convoState.mode !== "awaiting_folder_select") return;
    const atts = convoState.attachments;

    addAssistantMessage(`Adding ${atts.length === 1 ? "your file" : `${atts.length} files`} to **${toTitleCase(folderName)}**...`);

    let success = 0;
    for (const att of atts) {
      const ok = await uploadFileToFolder(att, folderName);
      if (ok) success++;
    }

    // Count total files in folder
    const { data: { session } } = await supabase.auth.getSession();
    const { count } = await supabase
      .from("agent_files")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", session?.user.id || "")
      .eq("folder_name", folderName);

    addAssistantMessage(`✅ Added to **${toTitleCase(folderName)}**. You have ${count || success} files there now.`);
    setConvoState({ mode: "idle" });
    setPendingAttachments([]);
    await loadFolders();
  }, [convoState, uploadFileToFolder, addAssistantMessage, loadFolders]);

  // ─── Main send handler ───────────────────────────────
  const sendMessage = useCallback(
    async (text: string, attachments?: Attachment[]) => {
      if (!text.trim() && (!attachments || attachments.length === 0)) return;
      if (state.isARIAThinking) return;

      // Convert Attachment to MessageAttachment with preview URLs
      const msgAttachments: MessageAttachment[] | undefined = attachments?.map(att => {
        const ma: MessageAttachment = {
          file: att.file,
          url: att.url,
          name: att.name,
          type: att.type,
        };
        if (att.file && att.type === "image") {
          ma.previewUrl = URL.createObjectURL(att.file);
        }
        return ma;
      });

      const hasFiles = msgAttachments && msgAttachments.length > 0;
      const hasText = text.trim().length > 0;

      // Add user message
      addUserMessage(text.trim() || (hasFiles ? `Uploaded ${msgAttachments!.length} file${msgAttachments!.length > 1 ? "s" : ""}` : ""), msgAttachments);
      setInput("");

      // Save to DB
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        supabase.from("aria_conversations").insert({
          agent_id: user.id,
          role: "user",
          content: text.trim() || (msgAttachments?.length ? 'Uploaded ' + msgAttachments.length + ' file(s): ' + msgAttachments.map(a => a.name).join(', ') : ''),
          data_action: hasFiles ? { action: 'file_upload', files: msgAttachments!.map(a => ({ name: a.name, type: a.type, size: a.file?.size })) } : null,
        }).then();
      }

      // ─── Conversational pattern matching ──────────
      const lower = text.toLowerCase();

      // STATE: awaiting folder name
      if (convoState.mode === "awaiting_folder_name" && hasText) {
        const slug = slugify(text);
        const atts = convoState.attachments.length > 0 ? convoState.attachments : pendingAttachments;

        if (atts.length > 0) {
          addAssistantMessage(`Creating folder **${toTitleCase(slug)}** and saving your ${atts.length === 1 ? "file" : `${atts.length} files`} there...`);
          for (const att of atts) {
            await uploadFileToFolder(att, slug);
          }
          addAssistantMessage(
            `✅ Folder **'${toTitleCase(slug)}'** created with your ${atts.length === 1 ? "file" : "files"}.\n\nUpload more photos or documents for this property, or type the property details and I'll fill in the listing form.`
          );
        } else {
          // No files — create placeholder so the folder persists
          const { data: { session } } = await supabase.auth.getSession();
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
          addAssistantMessage(`✅ Folder **'${toTitleCase(slug)}'** created. Upload photos or documents anytime.`);
        }

        setConvoState({ mode: "idle" });
        setPendingAttachments([]);
        await loadFolders();
        return;
      }

      // STATE: awaiting folder select (typed instead of clicking pill)
      if (convoState.mode === "awaiting_folder_select" && hasText) {
        const match = folders.find(f => f === slugify(text) || toTitleCase(f).toLowerCase() === lower);
        if (match) {
          await handleFolderSelect(match);
          return;
        }
        // No match, create new
        const slug = slugify(text);
        const atts = convoState.attachments;
        addAssistantMessage(`I don't see a folder named "${text}". Creating **${toTitleCase(slug)}** now...`);
        for (const att of atts) {
          await uploadFileToFolder(att, slug);
        }
        addAssistantMessage(`✅ Folder **'${slug}'** created with your files.`);
        setConvoState({ mode: "idle" });
        setPendingAttachments([]);
        await loadFolders();
        return;
      }

      // STATE: mid-listing draft, agent typed instead of clicking a button.
      // The classifier already confirmed this is a listing (that's what
      // put us in this state) — so any new detail found here merges in
      // unconditionally, no confidence gate needed, and we re-show the
      // confirm prompt with the updated summary.
      if (convoState.mode === "property_extracted" && hasText) {
        const merged = mergePropertyDetails(text, convoState.details);
        addAssistantMessage(
          `Got it, updated:\n\n${formatPropertySummary(merged)}\n\nWant me to create the listing now, or do you have photos to add first?`,
          [
            { label: "Create Listing Now", icon: "✓", id: "create_listing_now" },
            { label: "Add Photos First", icon: "📷", id: "add_photos_first" },
          ]
        );
        setConvoState({ mode: "property_extracted", details: merged });
        return;
      }

      // FILE UPLOAD — show action buttons, unless there's nothing to
      // actually choose between (no existing folders yet — the common
      // first-touch case), in which case skip straight to naming a new one
      if (hasFiles && !hasText) {
        setPendingAttachments(msgAttachments!);
        const fileNames = msgAttachments!.map(a => a.name).join(", ");

        if (folders.length === 0) {
          addAssistantMessage(
            `Got ${msgAttachments!.length > 1 ? `your ${msgAttachments!.length} files` : `**${fileNames}**`} — I'll start a new folder for this. What should I call it?`
          );
          setConvoState({ mode: "awaiting_folder_name", attachments: msgAttachments! });
        } else if (msgAttachments!.length > 1) {
          addAssistantMessage(
            `I see ${msgAttachments!.length} files uploaded. Should I add all of them to the same folder?`,
            [
              { label: "Yes, same folder", icon: "📁", id: "same_folder" },
              { label: "No, let me sort them", icon: "📋", id: "sort_individually" },
            ]
          );
          setConvoState({ mode: "awaiting_file_action", attachments: msgAttachments! });
        } else {
          addAssistantMessage(
            `I can see you've uploaded **${fileNames}**. New property, or add to an existing one?`,
            [
              { label: "✨ New property folder", icon: "✨", id: "create_new_folder" },
              { label: "📁 Add to existing folder", icon: "📁", id: "add_to_existing" },
              { label: "🏠 Start a new listing", icon: "🏠", id: "start_listing" },
            ]
          );
          setConvoState({ mode: "awaiting_file_action", attachments: msgAttachments! });
        }
        return;
      }

      // FILE + TEXT — treat text as context
      if (hasFiles && hasText) {
        setPendingAttachments(msgAttachments!);
        addAssistantMessage(
          `Got your file${msgAttachments!.length > 1 ? "s" : ""} and note. What would you like to do?`,
          [
            { label: "📁 Add to existing folder", icon: "📁", id: "add_to_existing" },
            { label: "✨ Create new property folder", icon: "✨", id: "create_new_folder" },
            { label: "🏠 Start a new listing", icon: "🏠", id: "start_listing" },
          ]
        );
        setConvoState({ mode: "awaiting_file_action", attachments: msgAttachments! });
        return;
      }

      // ─── Fast-path: can ARIA handle this herself? ──
      // Classify against the active Intent Pack's known intents. If she's
      // confident enough, run that intent's handler directly — no AI call
      // at all. Otherwise fall through, completely unchanged, to the AI.
      const { intent, confidence, threshold } = await classifyIntent(text);
      if (intent && threshold !== null && confidence >= threshold) {
        const handler = intentHandlers[intent];
        if (handler) {
          await handler(text);
          return;
        }
      }

      // ─── Default: stream to ARIA AI ───────────────
      dispatch({ type: "SET_THINKING", value: true });

      const history: ChatMessage[] = state.messages
        .slice(-18)
        .map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: text.trim() });

      let fullResponse = "";
      const controller = new AbortController();
      abortRef.current = controller;

      const currentUser = user;
      const { data: { session } } = await supabase.auth.getSession();
      await streamARIA({
        messages: history,
        agentContext: state.agentContext,
        authToken: session?.access_token ?? null,
        signal: controller.signal,
        onDelta: (chunk) => {
          fullResponse += chunk;
          dispatch({ type: "UPDATE_LAST_ASSISTANT", content: fullResponse });
        },
        onDone: async (cleanText, toolCalls: ToolCall[]) => {
          dispatch({ type: "SET_THINKING", value: false });

          // aria_conversations keeps its existing single-object JSONB shape
          // (screen_command, data_action) without a schema migration —
          // screen_navigate populates the former, the FIRST non-navigation
          // tool call populates the latter, reconstructed as {action, ...}
          // to match the old marker-era shape.
          let screenCommandForLog = null;
          let dataActionForLog = null;

          for (const call of toolCalls) {
            switch (call.name) {
              case "screen_navigate": {
                screenCommandForLog = call.input;
                navigateTo(call.input.screen, call.input);
                break;
              }

              case "folder_create": {
                if (!dataActionForLog) dataActionForLog = { action: "create_folder", ...call.input };
                if (call.input.folder_name) {
                  const folderSlug = slugify(call.input.folder_name);
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session && folderSlug) {
                    const { data: existing } = await supabase
                      .from("agent_files")
                      .select("id")
                      .eq("agent_id", session.user.id)
                      .eq("folder_name", folderSlug)
                      .limit(1);

                    if (!existing || existing.length === 0) {
                      await supabase.from("agent_files").insert({
                        agent_id: session.user.id,
                        file_name: ".folder",
                        file_url: "",
                        file_type: "placeholder",
                        file_size: 0,
                        storage_path: `${session.user.id}/${folderSlug}/.folder`,
                        folder_name: folderSlug,
                        category: "listing",
                        processing_status: "complete",
                      });
                    }
                    await loadFolders();
                    window.dispatchEvent(new CustomEvent("folder_created"));
                  }
                }
                break;
              }

              case "lead_create": {
                if (!dataActionForLog) dataActionForLog = { action: "create_lead", ...call.input };
                if (call.input.full_name && currentUser) {
                  const { error } = await createLead(currentUser.id, {
                    full_name: call.input.full_name,
                    phone: call.input.phone,
                    email: call.input.email,
                    notes: call.input.notes,
                    source: call.input.source,
                  });
                  if (error) {
                    toast({ title: "Couldn't create lead", description: error.message, variant: "destructive" });
                  } else {
                    addAssistantMessage(`✅ Added **${call.input.full_name}** as a new lead.`);
                  }
                }
                break;
              }

              case "lead_update_status": {
                if (!dataActionForLog) dataActionForLog = { action: "update_lead_status", ...call.input };
                if (call.input.lead_id) {
                  if (!(LEAD_STATUSES as readonly string[]).includes(call.input.status)) {
                    toast({ title: "Couldn't update lead", description: `"${call.input.status}" isn't a valid lead status.`, variant: "destructive" });
                  } else {
                    const { error } = await updateLeadStatus(call.input.lead_id, call.input.status);
                    if (error) {
                      toast({ title: "Couldn't update lead", description: error.message, variant: "destructive" });
                    }
                  }
                }
                break;
              }

              case "lead_draft_message": {
                if (!dataActionForLog) dataActionForLog = { action: "draft_message", ...call.input };
                if (call.input.lead_id) {
                  const channel = call.input.channel || "whatsapp";
                  const { data: lead } = await supabase
                    .from("leads")
                    .select("full_name, phone")
                    .eq("id", call.input.lead_id)
                    .maybeSingle();

                  if (!lead) {
                    toast({ title: "Couldn't draft message", description: "Lead not found.", variant: "destructive" });
                  } else {
                    let draftText = "";
                    if (currentUser) {
                      const { data: ownTemplate } = await supabase
                        .from("message_templates")
                        .select("content_en")
                        .eq("agent_id", currentUser.id)
                        .contains("channels", [channel])
                        .limit(1)
                        .maybeSingle();

                      let templateContent = ownTemplate?.content_en || null;
                      if (!templateContent) {
                        const { data: globalTemplate } = await supabase
                          .from("message_templates")
                          .select("content_en")
                          .eq("is_global", true)
                          .contains("channels", [channel])
                          .limit(1)
                          .maybeSingle();
                        templateContent = globalTemplate?.content_en || null;
                      }

                      if (templateContent) {
                        draftText = fillTemplate(templateContent, { name: lead.full_name || "there", full_name: lead.full_name || "there" });
                      }
                    }
                    // NOTE: uses content_en only for now — a bilingual pass
                    // (BUILD_GUIDE.md §15 item 5) should pick content_zh
                    // based on the lead's/agent's preferred language.
                    if (!draftText) {
                      draftText = `Hi ${lead.full_name || "there"}, this is your agent from Heng Fatt Property following up. Let me know if you'd like to arrange a viewing or have any questions!`;
                    }

                    const waPhone = toWhatsAppPhone(lead.phone);
                    addAssistantMessage(
                      `Here's a draft message for **${lead.full_name || "this lead"}**:\n\n"${draftText}"`,
                      [
                        { label: "📋 Copy Message", id: "copy_draft_message", payload: { text: draftText } },
                        ...(waPhone ? [{ label: "💬 Open in WhatsApp", id: "open_whatsapp_draft", payload: { phone: waPhone, text: draftText } }] : []),
                      ]
                    );
                  }
                }
                break;
              }

              case "viewing_book": {
                if (!dataActionForLog) dataActionForLog = { action: "book_viewing", ...call.input };
                if (call.input.lead_id && call.input.property_id && call.input.scheduled_at && currentUser) {
                  const { error } = await bookViewing({
                    agentId: currentUser.id,
                    leadId: call.input.lead_id,
                    propertyId: call.input.property_id,
                    scheduledAt: call.input.scheduled_at,
                    durationMins: call.input.duration_mins,
                  });
                  if (error) {
                    toast({ title: "Couldn't book viewing", description: error, variant: "destructive" });
                  } else {
                    const when = new Date(call.input.scheduled_at);
                    addAssistantMessage(
                      `✅ Viewing booked for ${when.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" })} at ${when.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}.`,
                      [{ label: "📅 View Schedule", id: "goto_calendar" }]
                    );
                  }
                }
                break;
              }

              case "viewing_reschedule": {
                if (!dataActionForLog) dataActionForLog = { action: "reschedule_viewing", ...call.input };
                if (call.input.lead_name && call.input.new_scheduled_at && currentUser) {
                  const matches = await findUpcomingViewingsByLeadName(currentUser.id, call.input.lead_name);
                  if (matches.length === 0) {
                    addAssistantMessage(`I couldn't find an upcoming viewing for "${call.input.lead_name}".`);
                  } else if (matches.length === 1) {
                    const { error } = await rescheduleViewing({
                      agentId: currentUser.id,
                      viewingId: matches[0].id,
                      newScheduledAt: call.input.new_scheduled_at,
                    });
                    if (error) {
                      toast({ title: "Couldn't reschedule", description: error, variant: "destructive" });
                    } else {
                      const when = new Date(call.input.new_scheduled_at);
                      addAssistantMessage(
                        `✅ Rescheduled to ${when.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" })} at ${when.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}.`,
                        [{ label: "📅 View Schedule", id: "goto_calendar" }]
                      );
                    }
                  } else {
                    addAssistantMessage(
                      `"${call.input.lead_name}" has ${matches.length} upcoming viewings — which one should I reschedule?`,
                      matches.map((m) => ({
                        label: `${m.lead_full_name || "Unnamed lead"} — ${new Date(m.scheduled_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}`,
                        id: "goto_reschedule_viewing",
                        payload: { viewing_id: m.id, new_scheduled_at: call.input.new_scheduled_at },
                      }))
                    );
                  }
                }
                break;
              }

              case "viewing_update_status": {
                if (!dataActionForLog) dataActionForLog = { action: "update_viewing_status", ...call.input };
                if (call.input.lead_name && call.input.status && currentUser) {
                  if (!(VIEWING_STATUSES as readonly string[]).includes(call.input.status)) {
                    toast({ title: "Couldn't update viewing", description: `"${call.input.status}" isn't a valid viewing status.`, variant: "destructive" });
                  } else {
                    const matches = await findUpcomingViewingsByLeadName(currentUser.id, call.input.lead_name);
                    if (matches.length === 0) {
                      addAssistantMessage(`I couldn't find an upcoming viewing for "${call.input.lead_name}".`);
                    } else if (matches.length === 1) {
                      const { error } = await updateViewingStatus(
                        currentUser.id,
                        matches[0].id,
                        call.input.status,
                        call.input.reason
                      );
                      if (error) {
                        toast({ title: "Couldn't update viewing", description: error, variant: "destructive" });
                      } else {
                        addAssistantMessage(
                          `✅ Marked the viewing with **${matches[0].lead_full_name || "this lead"}** as **${String(call.input.status).replace("_", "-")}**.`
                        );
                      }
                    } else {
                      addAssistantMessage(
                        `"${call.input.lead_name}" has ${matches.length} upcoming viewings — which one?`,
                        matches.map((m) => ({
                          label: `${m.lead_full_name || "Unnamed lead"} — ${new Date(m.scheduled_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}`,
                          id: "goto_update_viewing_status",
                          payload: { viewing_id: m.id, status: call.input.status, reason: call.input.reason || "" },
                        }))
                      );
                    }
                  }
                }
                break;
              }

              case "viewing_lookup": {
                if (!dataActionForLog) dataActionForLog = { action: "lookup_viewing", ...call.input };
                if (currentUser) {
                  let leadIds: string[] | null = null;
                  if (call.input.lead_name) {
                    const { data: leadMatches } = await supabase
                      .from("leads")
                      .select("id")
                      .eq("agent_id", currentUser.id)
                      .ilike("full_name", `%${call.input.lead_name}%`)
                      .limit(10);
                    leadIds = (leadMatches || []).map((l) => l.id);
                    if (leadIds.length === 0) {
                      addAssistantMessage(`I couldn't find any lead named "${call.input.lead_name}".`);
                      break;
                    }
                  }

                  let lookupQuery = supabase
                    .from("viewings")
                    .select("id, scheduled_at, status, leads(full_name), properties(title, property_name)")
                    .eq("agent_id", currentUser.id);
                  if (leadIds) lookupQuery = lookupQuery.in("lead_id", leadIds);
                  lookupQuery = call.input.which === "upcoming"
                    ? lookupQuery.gte("scheduled_at", new Date().toISOString()).in("status", ["pending", "confirmed"]).order("scheduled_at", { ascending: true })
                    : lookupQuery.order("created_at", { ascending: false });

                  const { data: found } = await lookupQuery.limit(1);
                  const hit = found?.[0];

                  if (!hit) {
                    addAssistantMessage(
                      call.input.lead_name
                        ? `No viewings found for "${call.input.lead_name}".`
                        : call.input.which === "upcoming"
                        ? "You don't have any upcoming viewings booked."
                        : "You don't have any viewings booked yet."
                    );
                  } else {
                    const when = new Date(hit.scheduled_at);
                    const leadName = hit.leads?.full_name || "Unnamed lead";
                    const propertyName = hit.properties?.property_name || hit.properties?.title || "a property";
                    addAssistantMessage(
                      `${call.input.which === "upcoming" ? "Your next viewing" : "Your latest booking"}: **${leadName}** at **${propertyName}**, ${when.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" })} at ${when.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })} — status **${hit.status}**.`,
                      [{ label: "📅 View Schedule", id: "goto_calendar" }]
                    );
                  }
                }
                break;
              }

              case "task_create": {
                if (!dataActionForLog) dataActionForLog = { action: "create_task", ...call.input };
                if (call.input.title && currentUser) {
                  const leadId = call.input.lead_name
                    ? await findSingleLeadIdByName(currentUser.id, call.input.lead_name)
                    : null;
                  const { error } = await createTask(currentUser.id, {
                    title: call.input.title,
                    dueAt: call.input.due_at || null,
                    leadId,
                  });
                  if (error) {
                    toast({ title: "Couldn't add task", description: error, variant: "destructive" });
                  } else {
                    addAssistantMessage(`✅ Added task: **${call.input.title}**.`);
                  }
                }
                break;
              }

              case "task_complete": {
                if (!dataActionForLog) dataActionForLog = { action: "complete_task", ...call.input };
                if (call.input.title && currentUser) {
                  const matches = await findOpenTasksByTitle(currentUser.id, call.input.title);
                  if (matches.length === 0) {
                    addAssistantMessage(`I couldn't find an open task matching "${call.input.title}".`);
                  } else if (matches.length === 1) {
                    const { error } = await setTaskCompletion(currentUser.id, matches[0].id, true);
                    if (error) {
                      toast({ title: "Couldn't update task", description: error, variant: "destructive" });
                    } else {
                      addAssistantMessage(`✅ Marked **${matches[0].title}** as done.`);
                    }
                  } else {
                    addAssistantMessage(
                      `"${call.input.title}" matches ${matches.length} open tasks — which one?`,
                      matches.map((m) => ({
                        label: m.title,
                        id: "goto_complete_task",
                        payload: { task_id: m.id },
                      }))
                    );
                  }
                }
                break;
              }

              case "lead_view": {
                if (!dataActionForLog) dataActionForLog = { action: "view_lead", ...call.input };
                if (call.input.name && currentUser) {
                  const { data: matches } = await supabase
                    .from("leads")
                    .select("id, full_name")
                    .eq("agent_id", currentUser.id)
                    .ilike("full_name", `%${call.input.name}%`)
                    .limit(6);

                  if (!matches || matches.length === 0) {
                    addAssistantMessage(`I couldn't find a lead named "${call.input.name}".`);
                  } else if (matches.length === 1) {
                    navigateTo("lead_detail", { lead_id: matches[0].id });
                  } else {
                    addAssistantMessage(
                      `I found ${matches.length} leads matching "${call.input.name}" — which one?`,
                      matches.map((m) => ({
                        label: m.full_name || "Unnamed lead",
                        id: "goto_lead_detail",
                        payload: { lead_id: m.id },
                      }))
                    );
                  }
                }
                break;
              }

              case "lead_reassign": {
                if (!dataActionForLog) dataActionForLog = { action: "reassign_lead", ...call.input };
                if (call.input.lead_id && call.input.to_agent_name && currentUser) {
                  const { data: matches } = await supabase
                    .from("agent_profiles")
                    .select("id, profiles(full_name)")
                    .eq("is_published", true);
                  const target = (matches || []).find((m) =>
                    m.profiles?.full_name?.toLowerCase().includes(String(call.input.to_agent_name).toLowerCase())
                  );
                  if (!target) {
                    toast({ title: "Couldn't reassign lead", description: `No agent found matching "${call.input.to_agent_name}".`, variant: "destructive" });
                  } else {
                    const { error } = await shareLead(currentUser.id, call.input.lead_id, target.id, call.input.message);
                    if (error) {
                      toast({ title: "Couldn't reassign lead", description: error.message, variant: "destructive" });
                    } else {
                      addAssistantMessage(
                        `✅ Sent a reassignment request for this lead to **${target.profiles?.full_name}**.`,
                        [{ label: "👥 View Leads", id: "goto_leads" }]
                      );
                    }
                  }
                }
                break;
              }
            }
          }

          if (currentUser) {
            supabase.from("aria_conversations").insert({
              agent_id: currentUser.id,
              role: "assistant",
              content: cleanText,
              screen_command: screenCommandForLog,
              data_action: dataActionForLog,
              input_mode: "text",
            }).then();
          }
        },
        onError: (err) => {
          dispatch({ type: "SET_THINKING", value: false });
          toast({ title: "ARIA Error", description: err, variant: "destructive" });
        },
      });
    },
    [state.messages, state.isARIAThinking, state.agentContext, dispatch, navigateTo, toast, convoState, folders, addUserMessage, addAssistantMessage, uploadFileToFolder, handleFolderSelect, loadFolders, pendingAttachments, intentHandlers]
  );

  // Keep ref in sync for external callers
  sendRef.current = sendMessage;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[hsl(210,50%,12%)] border-r border-gold/10 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gold/10 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-gold text-lg font-bold tracking-wide">ARIA</h2>
            <p className="text-[11px] font-body text-cream/40">Your property intelligence assistant</p>
          </div>
          <button onClick={() => dispatch({ type: "SET_CHAT_OPEN", open: false })} className="text-cream/40 hover:text-cream" title="Collapse ARIA">
            <PanelLeftClose className="w-5 h-5 hidden lg:block" />
            <X className="w-5 h-5 lg:hidden" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {state.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="w-8 h-8 text-gold/40 mb-3" />
            <p className="text-cream/40 text-sm font-body">
              Hello! I'm ARIA, your AI assistant. Ask me anything about your listings, leads, or the Singapore property market.
            </p>
          </div>
        )}
        {state.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" ? (
              <div className="max-w-[90%] space-y-2">
                <div className="border-l-2 border-gold/30 pl-3">
                  <p className="text-cream/90 text-sm font-body leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                {/* Action buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="pl-3 flex flex-col gap-1.5 mt-2">
                    {msg.actions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleAction(action.id, action.payload)}
                        className="text-left text-sm font-body px-3 py-2 rounded-lg border border-gold/30 bg-navy-light hover:bg-gold/10 hover:border-gold/50 text-cream/80 hover:text-cream transition-colors"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
                {/* Folder pills */}
                {msg.folderPills && msg.folderPills.length > 0 && (
                  <div className="pl-3 flex flex-wrap gap-1.5 mt-2">
                    {msg.folderPills.map((folder) => (
                      <button
                        key={folder}
                        onClick={() => handleFolderSelect(folder)}
                        className="text-xs font-body px-3 py-1.5 rounded-full border border-gold/40 bg-navy-light hover:bg-gold/15 text-cream/70 hover:text-cream transition-colors"
                      >
                        <Folder className="w-3 h-3 inline mr-1 text-gold/60" />
                        {toTitleCase(folder)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-[85%] space-y-2">
                {/* Attachment previews in user messages */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {msg.attachments.map((att, i) => (
                      <div key={i} className="rounded-lg overflow-hidden border border-gold/20 bg-navy-light">
                        {att.type === "image" && att.previewUrl ? (
                          <img src={att.previewUrl} alt={att.name} className="w-32 h-24 object-cover" />
                        ) : (
                          <div className="w-32 h-16 flex items-center justify-center gap-1.5 px-2">
                            <FileText className="w-5 h-5 text-gold/60 shrink-0" />
                            <span className="text-[11px] text-cream/60 font-body truncate">{att.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {msg.content && (
                  <div className="bg-navy-light rounded-xl px-3 py-2">
                    <p className="text-cream text-sm font-body">{msg.content}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {state.isARIAThinking && state.messages[state.messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="border-l-2 border-gold/30 pl-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gold/60 rounded-full animate-pulse" />
                <span className="w-1.5 h-1.5 bg-gold/60 rounded-full animate-pulse delay-100" />
                <span className="w-1.5 h-1.5 bg-gold/60 rounded-full animate-pulse delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInputBar
        input={input}
        setInput={setInput}
        onSend={(text, atts) => sendMessage(text, atts)}
        disabled={state.isARIAThinking}
        placeholder={placeholders[placeholderIdx]}
      />
    </div>
  );
}
