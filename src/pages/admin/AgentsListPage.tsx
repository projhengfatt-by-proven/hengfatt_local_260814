import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AddNewAgentForm from "@/components/admin/AddNewAgentForm";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, Send, Loader2, Search, Sparkles, UserPlus } from "lucide-react";
import { resendAgentInvite, setAgentActive, setAgentVisibility, setAgentAdminRole } from "@/components/admin/adminOperations";
import {
  buildAgentInviteCopilotContext,
  generateAgentInviteDraft,
  type AgentInviteDraft,
} from "@/lib/agentInviteCopilot";

type AgentRow = {
  id: string;
  cea_no: string;
  position: string | null;
  agent_type: string | null;
  is_published: boolean;
  is_featured: boolean;
  display_order: number | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    email: string;
    phone: string | null;
    is_active: boolean | null;
    password_set_at: string | null;
  } | null;
  is_admin: boolean;
};

type AgentFilter = "all" | "published" | "featured" | "pending-invite" | "internal" | "external";

export default function AgentsListPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AgentFilter>("all");
  const [searchParams] = useSearchParams();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [invitePrompt, setInvitePrompt] = useState("");
  const [inviteDraft, setInviteDraft] = useState<AgentInviteDraft | null>(null);
  const [inviteDraftRaw, setInviteDraftRaw] = useState("");
  const [inviteDraftError, setInviteDraftError] = useState("");
  const [generatingInviteDraft, setGeneratingInviteDraft] = useState(false);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const createSectionRef = useRef<HTMLDivElement | null>(null);

  async function fetchAgents() {
    const { data, error } = await supabase
      .from("agent_profiles")
      .select("id, cea_no, position, agent_type, is_published, is_featured, display_order, profiles(full_name, avatar_url, email, phone, is_active, password_set_at)")
      .order("display_order", { ascending: true });

    if (error) {
      toast({ title: "Error loading agents", description: error.message, variant: "destructive" });
    } else {
      const agentRows = (data ?? []).map((row) => ({
        ...row,
        is_published: row.is_published ?? false,
        is_featured: row.is_featured ?? false,
        is_admin: false,
        profiles: row.profiles,
      })) as AgentRow[];

      const agentIds = agentRows.map((row) => row.id);
      const { data: roles } = agentIds.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", agentIds)
        : { data: [] as Array<{ user_id: string; role: string }> };
      const adminIds = new Set((roles ?? []).filter((row) => row.role === "admin").map((row) => row.user_id));

      setAgents(agentRows.map((row) => ({ ...row, is_admin: adminIds.has(row.id) })));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setShowCreateForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!showCreateForm) return;

    const timer = window.setTimeout(() => {
      createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstInput = document.getElementById("fullName") as HTMLInputElement | null;
      firstInput?.focus();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [showCreateForm]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const status = agent.profiles?.password_set_at ? "active" : "pending-invite";
      if (filter !== "all") {
        if (filter === "published" && !agent.is_published) return false;
        if (filter === "featured" && !agent.is_featured) return false;
        if (filter === "internal" && agent.agent_type !== "internal") return false;
        if (filter === "external" && agent.agent_type !== "external") return false;
        if (filter === "pending-invite" && status !== "pending-invite") return false;
      }

      if (!search.trim()) return true;
      const haystack = [
        agent.profiles?.full_name,
        agent.profiles?.email,
        agent.position,
        agent.cea_no,
        agent.agent_type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [agents, filter, search]);

  const stats = useMemo(() => ({
    total: agents.length,
    published: agents.filter((agent) => agent.is_published).length,
    featured: agents.filter((agent) => agent.is_featured).length,
    admins: agents.filter((agent) => agent.is_admin).length,
    pendingInvite: agents.filter((agent) => !agent.profiles?.password_set_at).length,
  }), [agents]);

  const inviteCopilotContext = useMemo(() => {
    return buildAgentInviteCopilotContext(
      agents.map((agent) => ({
        full_name: agent.profiles?.full_name ?? null,
        email: agent.profiles?.email ?? null,
        agent_type: agent.agent_type ?? null,
        is_published: agent.is_published,
        is_featured: agent.is_featured,
      }))
    );
  }, [agents]);

  async function handleVisibility(agent: AgentRow, field: "is_published" | "is_featured", value: boolean) {
    const result = await setAgentVisibility(agent.id, { [field]: value });
    if (result.error) {
      toast({ title: "Update failed", description: result.error, variant: "destructive" });
      return;
    }
    setAgents((prev) => prev.map((item) => (item.id === agent.id ? { ...item, [field]: value } : item)));
    toast({ title: "Agent visibility updated" });
  }

  async function handleActive(agent: AgentRow, value: boolean) {
    const result = await setAgentActive(agent.id, value);
    if (result.error) {
      toast({ title: "Update failed", description: result.error, variant: "destructive" });
      return;
    }
    setAgents((prev) => prev.map((item) => (item.id === agent.id ? { ...item, profiles: item.profiles ? { ...item.profiles, is_active: value } : item.profiles } : item)));
    toast({ title: value ? "Agent reactivated" : "Agent suspended" });
  }

  async function handleResendInvite(agent: AgentRow) {
    if (!agent.profiles?.email) return;
    setResending(agent.id);
    const result = await resendAgentInvite(agent.profiles.email);
    setResending(null);
    if (result.error) {
      toast({ title: "Failed to resend invite", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Invite resent", description: `Email sent to ${agent.profiles.email}` });
  }

  async function handleAdminRole(agent: AgentRow, value: boolean) {
    setTogglingAdmin(agent.id);
    const result = await setAgentAdminRole(agent.id, value);
    setTogglingAdmin(null);
    if (result.error) {
      toast({ title: "Could not update admin role", description: result.error, variant: "destructive" });
      return;
    }
    setAgents((prev) => prev.map((item) => (item.id === agent.id ? { ...item, is_admin: value } : item)));
    toast({ title: value ? "Admin role granted" : "Admin role removed" });
  }

  async function handleGenerateInviteDraft() {
    if (!invitePrompt.trim()) {
      toast({
        title: "Add a short brief",
        description: "Tell the copilot who this agent is and what details should be filled in.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingInviteDraft(true);
    setInviteDraftError("");
    setInviteDraft(null);
    setInviteDraftRaw("");

    const { data: session } = await supabase.auth.getSession();
    const result = await generateAgentInviteDraft({
      prompt: invitePrompt.trim(),
      authToken: session.session?.access_token ?? null,
      context: inviteCopilotContext,
    });

    setGeneratingInviteDraft(false);

    if (result.error || !result.data) {
      setInviteDraftError(result.error ?? "The copilot could not build a draft.");
      setInviteDraftRaw(result.rawText);
      toast({
        title: "Draft generation failed",
        description: result.error ?? "Please refine the brief and try again.",
        variant: "destructive",
      });
      return;
    }

    setInviteDraft(result.data);
    setInviteDraftRaw(result.rawText);
  }

  function applyInviteDraftToForm() {
    if (!inviteDraft) return;
    setConfirmApplyOpen(true);
  }

  function confirmApplyInviteDraft() {
    if (!inviteDraft) return;

    sessionStorage.setItem("agent_invite_prefill", JSON.stringify(inviteDraft));
    setConfirmApplyOpen(false);
    setShowCreateForm(true);
    toast({
      title: "Draft copied to form",
      description: "The invite form is open and ready for review.",
    });
  }

  const initials = (name: string | null) =>
    (name ?? "??")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="p-6 sm:p-8 max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Agent visibility</Badge>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Agents</h1>
          <p className="mt-2 font-body text-muted-foreground">
            Search by name or email, control public visibility, and resend invites when an agent has not set a password yet.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateForm((current) => !current)}
          className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          {showCreateForm ? "Hide Create Form" : "Add Agent"}
        </Button>
      </div>

      <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <Badge variant="secondary" className="bg-gold/10 text-gold border-gold/30 font-body">
                Phase 3: Agent Invite Copilot
              </Badge>
            </div>
            <h2 className="mt-2 font-heading text-xl font-semibold text-foreground">Draft an invite before sending</h2>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              Describe the agent in plain language. The copilot will fill a structured draft, then we can review it and push
              it into the existing invite form for final confirmation.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleGenerateInviteDraft}
            disabled={generatingInviteDraft}
            className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold"
          >
            {generatingInviteDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate draft
          </Button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <Textarea
              value={invitePrompt}
              onChange={(e) => setInvitePrompt(e.target.value)}
              rows={5}
              placeholder="Example: Create an external agent invite for Amelia Tan, senior residential specialist, English + Mandarin, strong in condo and landed homes, CEA number R123456A, around 8 years of experience..."
              className="min-h-[140px]"
            />
            <p className="font-body text-xs text-muted-foreground">
              Use this for the first-pass draft only. We still review the data manually before the invite is sent.
            </p>
            {inviteDraftError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 font-body text-sm text-destructive">
                {inviteDraftError}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <div className="flex items-center justify-between">
              <p className="font-heading text-sm font-semibold text-foreground">Draft preview</p>
              {inviteDraft && (
                <Button type="button" variant="outline" size="sm" onClick={applyInviteDraftToForm}>
                  Apply to form
                </Button>
              )}
            </div>

            {inviteDraft ? (
              <div className="mt-3 space-y-2 font-body text-sm">
                <p><span className="font-semibold text-foreground">Name:</span> {inviteDraft.fullName}</p>
                <p><span className="font-semibold text-foreground">Email:</span> {inviteDraft.email}</p>
                <p><span className="font-semibold text-foreground">Phone:</span> {inviteDraft.phone}</p>
                <p><span className="font-semibold text-foreground">Agent type:</span> {inviteDraft.agentType}</p>
                <p><span className="font-semibold text-foreground">Position:</span> {inviteDraft.position || "Not set yet"}</p>
                <p><span className="font-semibold text-foreground">Languages:</span> {inviteDraft.languages.join(", ")}</p>
                <p><span className="font-semibold text-foreground">Specialisations:</span> {inviteDraft.specialisations.join(", ") || "Not set yet"}</p>
                <p><span className="font-semibold text-foreground">Notes:</span> {inviteDraft.sourceNotes || "No notes returned"}</p>
              </div>
            ) : (
              <p className="mt-3 font-body text-sm text-muted-foreground">
                Generated details will appear here before we copy them into the invite form.
              </p>
            )}

            {inviteDraftRaw && (
              <details className="mt-4">
                <summary className="cursor-pointer font-body text-xs text-muted-foreground">
                  Raw copilot output
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] text-muted-foreground">
                  {inviteDraftRaw}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this draft to the invite form?</AlertDialogTitle>
            <AlertDialogDescription>
              We will copy the draft into the existing create form, open that section, and focus the first field so you can
              review it before sending the invite.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {inviteDraft && (
            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm font-body">
              <p><span className="font-semibold text-foreground">Name:</span> {inviteDraft.fullName}</p>
              <p><span className="font-semibold text-foreground">Email:</span> {inviteDraft.email}</p>
              <p><span className="font-semibold text-foreground">Agent type:</span> {inviteDraft.agentType}</p>
              <p><span className="font-semibold text-foreground">Languages:</span> {inviteDraft.languages.join(", ")}</p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApplyInviteDraft}>Apply draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showCreateForm && (
        <div ref={createSectionRef} id="create-agent" className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground">Create a new agent</h2>
              <p className="mt-1 font-body text-sm text-muted-foreground">
                Fill in the form below to create the account and send the invite from the same page.
              </p>
            </div>
            <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
              Close
            </Button>
          </div>
          <div className="pt-6">
            <AddNewAgentForm />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total agents" value={stats.total} />
        <StatCard label="Published" value={stats.published} />
        <StatCard label="Featured" value={stats.featured} />
        <StatCard label="Admins" value={stats.admins} />
        <StatCard label="Pending invite" value={stats.pendingInvite} />
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents by name, email, position, or CEA number"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "published", "featured", "pending-invite", "internal", "external"] as AgentFilter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-body font-medium capitalize transition-colors ${
                  filter === item ? "bg-gold text-primary" : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {item.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body">Agent</TableHead>
              <TableHead className="font-body hidden md:table-cell">Type</TableHead>
              <TableHead className="font-body hidden lg:table-cell">Position</TableHead>
              <TableHead className="font-body hidden lg:table-cell">CEA No.</TableHead>
              <TableHead className="font-body text-center">Team Page</TableHead>
              <TableHead className="font-body text-center">Homepage</TableHead>
              <TableHead className="font-body text-center">Admin</TableHead>
              <TableHead className="font-body text-center">Account</TableHead>
              <TableHead className="font-body text-center">Edit</TableHead>
              <TableHead className="font-body text-center">Invite</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!loading && filteredAgents.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center font-body text-muted-foreground">
                  No agents match the current filters.
                </TableCell>
              </TableRow>
            )}

            {filteredAgents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={agent.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-gold/10 text-gold text-xs font-semibold">
                        {initials(agent.profiles?.full_name ?? null)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-body font-semibold text-foreground text-sm">
                        {agent.profiles?.full_name ?? "—"}
                      </p>
                      <p className="font-body text-xs text-muted-foreground">
                        {agent.profiles?.email ?? "—"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant={agent.agent_type === "internal" ? "default" : "outline"} className={agent.agent_type === "internal" ? "bg-gold/10 text-gold border-gold/30 font-body" : "font-body"}>
                    {agent.agent_type === "internal" ? "Internal" : "External"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell font-body text-sm text-muted-foreground">
                  {agent.position || "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell font-body text-sm text-muted-foreground font-mono">
                  {agent.cea_no}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={agent.is_published}
                    onCheckedChange={(val) => void handleVisibility(agent, "is_published", val)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={agent.is_featured}
                    onCheckedChange={(val) => void handleVisibility(agent, "is_featured", val)}
                    disabled={agent.agent_type !== "internal"}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={agent.is_admin}
                    onCheckedChange={(val) => void handleAdminRole(agent, val)}
                    disabled={togglingAdmin === agent.id}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={agent.profiles?.is_active ?? false}
                    onCheckedChange={(val) => void handleActive(agent, val)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Link to={`/admin/agents/${agent.id}/edit`}>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-gold">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                </TableCell>
                <TableCell className="text-center">
                  {!agent.profiles?.password_set_at ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-gold"
                          disabled={resending === agent.id}
                          onClick={() => void handleResendInvite(agent)}
                        >
                          {resending === agent.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Resend invite email</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="font-body text-xs text-muted-foreground">Sent</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <p className="font-body text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-3xl text-foreground">{value}</p>
    </div>
  );
}
