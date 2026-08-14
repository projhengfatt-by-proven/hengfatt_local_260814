import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { streamARIA, type ToolCall, type ChatMessage } from "@/lib/ariaClient";
import { fetchAdminOverview, formatAdminContext } from "@/components/admin/adminOverview";
import {
  reviewApplication,
  resendAgentInvite,
  setAgentActive,
  setAgentVisibility,
  setListingFeatured,
  setListingStatus,
} from "@/components/admin/adminOperations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAdminCommand, sectionForScreen, type AdminMessage, type AdminPendingAction } from "./AdminCommandContext";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

function formatActionTitle(call: ToolCall) {
  switch (call.name) {
    case "admin_set_agent_visibility":
      return "Update agent visibility";
    case "admin_set_agent_active":
      return "Change agent active status";
    case "admin_resend_agent_invite":
      return "Resend agent invite";
    case "admin_set_listing_status":
      return "Change listing status";
    case "admin_set_listing_featured":
      return "Change featured listing";
    case "admin_review_application":
      return "Review application";
    case "admin_navigate":
      return "Navigate admin section";
    default:
      return call.name;
  }
}

function formatActionDescription(call: ToolCall) {
  switch (call.name) {
    case "admin_set_agent_visibility":
      return `Agent ${call.input.agent_id} will be updated with ${call.input.is_published === undefined ? "published unchanged" : `published = ${String(call.input.is_published)}`}${call.input.is_featured === undefined ? "" : `, featured = ${String(call.input.is_featured)}`}.`;
    case "admin_set_agent_active":
      return `Agent ${call.input.agent_id} will be ${call.input.is_active ? "activated" : "suspended"}.`;
    case "admin_resend_agent_invite":
      return `Invite or recovery email will be sent to ${call.input.email}.`;
    case "admin_set_listing_status":
      return `Listing ${call.input.listing_id} will be changed to ${call.input.status}.`;
    case "admin_set_listing_featured":
      return `Listing ${call.input.listing_id} will be ${call.input.featured ? "featured" : "unfeatured"}.`;
    case "admin_review_application":
      return `Application ${call.input.application_id} will be marked ${call.input.status}.`;
    case "admin_navigate":
      return `Open the ${call.input.screen} section.`;
    default:
      return "This action needs confirmation.";
  }
}

function formatMessageText(value: string) {
  return value.trim() || "I found an action that needs confirmation.";
}

export function AdminChatPanel({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { state, dispatch, navigateTo } = useAdminCommand();
  const [input, setInput] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, pendingActions, overview, isThinking } = state;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: sessionData }, overviewResult] = await Promise.all([
        supabase.auth.getSession(),
        fetchAdminOverview(),
      ]);

      if (!mounted) return;

      setSessionToken(sessionData.session?.access_token ?? null);
      if (overviewResult.error) {
        toast({ title: "Could not load admin context", description: overviewResult.error, variant: "destructive" });
      } else {
        dispatch({ type: "SET_OVERVIEW", overview: overviewResult.data });
      }
      setLoadingOverview(false);
    })();

    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pendingActions]);

  const contextSummary = useMemo(() => {
    if (!overview) return null;
    return formatAdminContext(overview);
  }, [overview]);

  async function refreshOverview() {
    const { data, error } = await fetchAdminOverview();
    if (error) {
      toast({ title: "Could not refresh dashboard data", description: error, variant: "destructive" });
      return;
    }
    dispatch({ type: "SET_OVERVIEW", overview: data });
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isThinking) return;
    if (!overview) {
      toast({ title: "Admin context not ready yet", description: "Please wait a moment and try again.", variant: "destructive" });
      return;
    }

    const userMessage: AdminMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
    };

    const assistantMessageId = crypto.randomUUID();
    dispatch({ type: "ADD_MESSAGE", message: userMessage });
    setInput("");
    dispatch({ type: "SET_THINKING", value: true });

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let streamedText = "";
    const history: ChatMessage[] = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    try {
      await streamARIA({
        messages: history,
        assistantRole: "admin",
        assistantContext: overview,
        authToken: sessionToken,
        onDelta: (delta) => {
          streamedText += delta;
          dispatch({ type: "UPSERT_ASSISTANT", id: assistantMessageId, content: streamedText });
        },
        onDone: (cleanText, toolCalls) => {
          const finalText = formatMessageText(cleanText || streamedText);
          dispatch({ type: "UPSERT_ASSISTANT", id: assistantMessageId, content: finalText });

          if (toolCalls.length > 0) {
            const actions: AdminPendingAction[] = toolCalls.map((call) => ({
              ...call,
              title: formatActionTitle(call),
              description: formatActionDescription(call),
            }));

            // Navigation calls that map to an in-place scene switch don't need confirmation.
            const navActions = actions.filter((action) => action.name === "admin_navigate");
            const otherActions = actions.filter((action) => action.name !== "admin_navigate");

            navActions.forEach((action) => {
              const screen = String(action.input.screen ?? "");
              const section = sectionForScreen(screen);
              if (section) {
                navigateTo(section);
              } else if (screen === "add_agent") {
                navigate("/admin/agents?create=1");
              }
            });

            if (otherActions.length > 0) {
              dispatch({ type: "SET_PENDING_ACTIONS", actions: otherActions });
            }
          }
        },
        onError: (error) => {
          toast({ title: "Copilot error", description: error, variant: "destructive" });
        },
        signal: controller.signal,
      });
    } catch (error) {
      toast({
        title: "Copilot failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: "SET_THINKING", value: false });
    }
  }

  async function executeAction(action: AdminPendingAction) {
    try {
      switch (action.name) {
        case "admin_set_agent_visibility":
          await setAgentVisibility(action.input.agent_id, {
            is_published: action.input.is_published,
            is_featured: action.input.is_featured,
          });
          break;
        case "admin_set_agent_active":
          await setAgentActive(action.input.agent_id, action.input.is_active);
          break;
        case "admin_resend_agent_invite":
          await resendAgentInvite(action.input.email);
          break;
        case "admin_set_listing_status":
          await setListingStatus(action.input.listing_id, action.input.status);
          break;
        case "admin_set_listing_featured":
          await setListingFeatured(action.input.listing_id, action.input.featured);
          break;
        case "admin_review_application":
          await reviewApplication(action.input.application_id, action.input.status, action.input.admin_notes);
          break;
        default:
          throw new Error(`Unsupported action: ${action.name}`);
      }

      toast({ title: "Action completed", description: action.title });
      dispatch({ type: "DISMISS_PENDING_ACTION", id: action.id });
      await refreshOverview();
      dispatch({
        type: "ADD_MESSAGE",
        message: { id: crypto.randomUUID(), role: "assistant", content: `Completed: ${action.title}.` },
      });
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    }
  }

  const suggestedPrompts = [
    "Show me the listings",
    "Which applications need attention first?",
    "Explain the latest activity log entry in plain English.",
    "Which agents are not published on the Team page?",
    "Show me draft listings that should be reviewed for publishing.",
  ];

  return (
    <div className={cn("flex flex-col h-full border-r border-border/70 bg-background", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-gold/10 via-transparent to-transparent px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-gold/10 text-gold border-gold/30 font-body">
              <Sparkles className="mr-1 h-3 w-3" />
              Admin Copilot
            </Badge>
          </div>
          <p className="mt-2 font-body text-xs text-muted-foreground">
            Actions pause for confirmation before touching the database.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={refreshOverview} title="Refresh context">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => dispatch({ type: "SET_CHAT_OPEN", open: false })}
            title="Collapse chat"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {loadingOverview ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-gold" />
                <p className="font-body font-semibold text-foreground text-sm">Start with a question</p>
              </div>
              <p className="mt-2 font-body text-xs text-muted-foreground">
                Try: "Show me the listings", "Summarise today's dashboard", or "Which applications need attention first?"
              </p>
              <div className="mt-3 space-y-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="flex w-full items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-left font-body text-xs text-foreground transition-colors hover:border-gold/40 hover:bg-gold/5"
                  >
                    <span>{prompt}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[92%] rounded-2xl px-4 py-3 text-sm font-body",
                message.role === "user"
                  ? "ml-auto bg-gold text-primary shadow-sm"
                  : "bg-muted/40 text-foreground border border-border/70"
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking through the admin data...
            </div>
          )}
        </div>
      </div>

      {pendingActions.length > 0 && (
        <div className="border-t border-border/70 px-4 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-gold" />
            <p className="font-body text-sm font-semibold text-foreground">Confirmation needed</p>
          </div>
          <div className="grid gap-3">
            {pendingActions.map((action) => (
              <div key={action.id} className="rounded-2xl border border-gold/20 bg-gold/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-body font-semibold text-foreground text-sm">{action.title}</p>
                    <p className="mt-1 font-body text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => executeAction(action)} className="bg-gold hover:bg-gold-dark text-primary">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dispatch({ type: "DISMISS_PENDING_ACTION", id: action.id })}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border/70 p-3">
        <div className="flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the copilot..."
            className="min-h-20 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
          />
          <Button
            className="w-full bg-gold hover:bg-gold-dark text-primary font-body font-semibold"
            onClick={() => void sendMessage(input)}
            disabled={isThinking}
          >
            <Bot className="mr-2 h-4 w-4" />
            Ask Copilot
          </Button>
        </div>
      </div>
    </div>
  );
}
