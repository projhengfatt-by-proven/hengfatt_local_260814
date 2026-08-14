import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { streamARIA, type ToolCall, type ChatMessage } from "@/lib/ariaClient";
import { fetchAdminOverview, formatAdminContext, type AdminOverview } from "@/components/admin/adminOverview";
import {
  reviewApplication,
  resendAgentInvite,
  setAgentActive,
  setAgentVisibility,
  setListingFeatured,
  setListingStatus,
} from "@/components/admin/adminOperations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type PendingAction = ToolCall & {
  title: string;
  description: string;
};

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
      return `Open the ${call.input.screen} section in the admin portal.`;
    default:
      return "This action needs confirmation.";
  }
}

function formatMessageText(value: string) {
  return value.trim() || "I found an action that needs confirmation.";
}

export default function AdminCopilot() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
        setOverview(overviewResult.data);
      }
      setLoadingOverview(false);
    })();

    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
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
    setOverview(data);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isThinking) return;
    if (!overview) {
      toast({ title: "Admin context not ready yet", description: "Please wait a moment and try again.", variant: "destructive" });
      return;
    }

    const userMessage: CopilotMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
    };

    const assistantMessageId = crypto.randomUUID();
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let streamedText = "";
    try {
      const history: ChatMessage[] = [...messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
      }));

      await streamARIA({
        messages: history,
        assistantRole: "admin",
        assistantContext: overview,
        authToken: sessionToken,
        onDelta: (delta) => {
          streamedText += delta;
          setMessages((prev) => {
            const existing = prev.find((item) => item.id === assistantMessageId);
            if (existing) {
              return prev.map((item) => (item.id === assistantMessageId ? { ...item, content: streamedText } : item));
            }
            return [...prev, { id: assistantMessageId, role: "assistant", content: streamedText }];
          });
        },
        onDone: (cleanText, toolCalls) => {
          const finalText = formatMessageText(cleanText || streamedText);
          setMessages((prev) => {
            const exists = prev.find((item) => item.id === assistantMessageId);
            if (exists) {
              return prev.map((item) => (item.id === assistantMessageId ? { ...item, content: finalText } : item));
            }
            return [...prev, { id: assistantMessageId, role: "assistant", content: finalText }];
          });

          if (toolCalls.length > 0) {
            setPendingActions(
              toolCalls.map((call) => ({
                ...call,
                title: formatActionTitle(call),
                description: formatActionDescription(call),
              }))
            );
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
      setIsThinking(false);
    }
  }

  async function executeAction(action: PendingAction) {
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
        case "admin_navigate":
          if (action.input.screen === "dashboard") navigate("/admin");
          else if (action.input.screen === "add_agent") navigate("/admin/agents/new");
          else navigate(`/admin/${action.input.screen}`);
          break;
        default:
          throw new Error(`Unsupported action: ${action.name}`);
      }

      toast({ title: "Action completed", description: action.title });
      setPendingActions((prev) => prev.filter((item) => item.id !== action.id));
      await refreshOverview();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Completed: ${action.title}.`,
        },
      ]);
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Unexpected error",
        variant: "destructive",
      });
    }
  }

  const overviewCards = overview
    ? [
        { label: "Agents", value: `${overview.counts.agentsPublished}/${overview.counts.agentsTotal}` },
        { label: "Listings", value: `${overview.counts.listingsActive}/${overview.counts.listingsTotal}` },
        { label: "Applications", value: `${overview.counts.applicationsPending} pending` },
        { label: "Activity", value: `${overview.counts.activityTotal} entries` },
      ]
    : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr] p-6 sm:p-8 max-w-7xl">
      <Card className="min-h-[78vh] flex flex-col border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/70 bg-gradient-to-r from-gold/10 via-transparent to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Admin Copilot</Badge>
                <Badge variant="outline" className="font-body">Action-confirmed</Badge>
              </div>
              <CardTitle className="mt-3 font-heading text-3xl text-foreground">Operations Copilot</CardTitle>
              <CardDescription className="mt-2 max-w-2xl font-body">
                Ask for summaries, explain a log entry, or draft a change. Any write-capable action will pause for confirmation before it touches the database.
              </CardDescription>
            </div>
            <Button variant="ghost" onClick={refreshOverview} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-4 p-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              {loadingOverview ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-gold" />
                    <p className="font-body font-semibold text-foreground">Start with a question</p>
                  </div>
                  <p className="mt-2 font-body text-sm text-muted-foreground">
                    Try: "Summarise today&apos;s dashboard", "Explain the latest activity log", or "Show me which listings are draft but should be reviewed."
                  </p>
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
            <div className="border-t border-border/70 px-6 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-gold" />
                <p className="font-body text-sm font-semibold text-foreground">
                  Confirmation needed
                </p>
              </div>
              <div className="grid gap-3">
                {pendingActions.map((action) => (
                  <div key={action.id} className="rounded-2xl border border-gold/20 bg-gold/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-body font-semibold text-foreground">{action.title}</p>
                        <p className="mt-1 font-body text-sm text-muted-foreground">{action.description}</p>
                      </div>
                      <Badge variant="outline" className="font-body capitalize">
                        {action.name.replace("admin_", "").replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={() => executeAction(action)} className="bg-gold hover:bg-gold-dark text-primary">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setPendingActions((prev) => prev.filter((item) => item.id !== action.id))}
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

          <div className="border-t border-border/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the copilot to summarise the dashboard, explain a log entry, or propose an admin action..."
                className="min-h-24 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
              />
              <div className="flex flex-row gap-2 sm:flex-col sm:w-40">
                <Button
                  className="w-full bg-gold hover:bg-gold-dark text-primary font-body font-semibold"
                  onClick={() => void sendMessage(input)}
                  disabled={isThinking}
                >
                  <Bot className="mr-2 h-4 w-4" />
                  Ask Copilot
                </Button>
                <Button variant="outline" onClick={() => setInput("")} disabled={isThinking}>
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Live context</CardTitle>
            <CardDescription className="font-body">
              The same summary the copilot sees when it answers questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingOverview ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : (
              <>
                <div className="grid gap-3">
                  {overviewCards.map((card) => (
                    <div key={card.label} className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
                      <span className="font-body text-sm text-muted-foreground">{card.label}</span>
                      <span className="font-heading text-base text-foreground">{card.value}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-muted/30 p-4">
                  <p className="font-body text-xs uppercase tracking-wide text-muted-foreground">Context snapshot</p>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-body text-xs text-foreground">
                    {contextSummary ?? "No context loaded yet."}
                  </pre>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Useful prompts</CardTitle>
            <CardDescription className="font-body">
              A few quick ways to use the admin assistant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Which applications need attention first?",
              "Explain the latest activity log entry in plain English.",
              "Which agents are not published on the Team page?",
              "Show me draft listings that should be reviewed for publishing.",
              "Send a password reset to provenmarketplace@gmail.com.",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="flex w-full items-center justify-between rounded-xl border border-border/70 px-4 py-3 text-left font-body text-sm text-foreground transition-colors hover:border-gold/40 hover:bg-gold/5"
              >
                <span>{prompt}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
