import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, UserPlus, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type AgentRow = {
  id: string;
  cea_no: string;
  position: string | null;
  agent_type: string | null;
  is_published: boolean;
  is_featured: boolean;
  specialisations: string[];
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    email: string;
    password_set_at: string | null;
  } | null;
};

async function logActivity(
  action: string,
  targetType: string,
  targetId: string,
  targetName: string | null,
  changes: Record<string, unknown> | null
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("admin_activity_log").insert({
    admin_id: user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    target_name: targetName,
    changes: changes as any,
  });
}

export default function AgentsListPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);

  async function fetchAgents() {
    const { data, error } = await supabase
      .from("agent_profiles")
      .select("id, cea_no, position, agent_type, is_published, is_featured, specialisations, profiles(full_name, avatar_url, email, password_set_at)")
      .order("display_order", { ascending: true });

    if (error) {
      toast({ title: "Error loading agents", description: error.message, variant: "destructive" });
    } else {
      setAgents(
        (data ?? []).map((row: any) => ({
          ...row,
          is_published: row.is_published ?? false,
          is_featured: row.is_featured ?? false,
          specialisations: row.specialisations ?? [],
          profiles: row.profiles,
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAgents();
  }, []);

  async function handleToggle(agent: AgentRow, field: "is_published" | "is_featured", value: boolean) {
    // Only internal agents can be featured on homepage
    if (field === "is_featured" && value && agent.agent_type !== "internal") {
      toast({ title: "Only internal agents can be featured on the homepage", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("agent_profiles")
      .update({ [field]: value })
      .eq("id", agent.id);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }

    const label = field === "is_published" ? "Team page visibility" : "Homepage visibility";
    await logActivity(
      `${label} ${value ? "enabled" : "disabled"}`,
      "agent",
      agent.id,
      agent.profiles?.full_name ?? null,
      { [field]: value }
    );

    setAgents((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, [field]: value } : a))
    );
    toast({ title: `${label} ${value ? "enabled" : "disabled"}` });
  }

  async function handleResendInvite(agent: AgentRow) {
    if (!agent.profiles?.email) return;
    setResending(agent.id);
    try {
      const { data, error } = await supabase.functions.invoke("resend-agent-invite", {
        body: { email: agent.profiles.email },
      });
      if (error) {
        // supabase.functions.invoke wraps non-2xx as FunctionsHttpError
        const errMsg = typeof data === "object" && data?.error ? data.error : error.message;
        throw new Error(errMsg);
      }
      // Check for application-level error in response body
      if (data?.error) {
        throw new Error(data.error);
      }
      toast({ title: "✅ Invite resent successfully", description: `Email sent to ${agent.profiles.email}` });
    } catch (err: any) {
      console.error("Resend invite error:", err);
      toast({ title: "Failed to resend invite", description: err.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setResending(null);
    }
  }

  const initials = (name: string | null) =>
    (name ?? "??")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
          Agents
        </h1>
        <Link to="/admin/agents/new">
          <Button className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Agent
          </Button>
        </Link>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body">Agent</TableHead>
              <TableHead className="font-body hidden md:table-cell">Type</TableHead>
              <TableHead className="font-body hidden lg:table-cell">Position</TableHead>
              <TableHead className="font-body hidden lg:table-cell">CEA No.</TableHead>
              <TableHead className="font-body text-center">Team Page</TableHead>
              <TableHead className="font-body text-center">Homepage</TableHead>
              <TableHead className="font-body text-center">Edit</TableHead>
              <TableHead className="font-body text-center">Invite</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!loading && agents.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground font-body py-12">
                  No agents found. Invite your first agent to get started.
                </TableCell>
              </TableRow>
            )}

            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
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
                  <Badge
                    variant={agent.agent_type === "internal" ? "default" : "outline"}
                    className={
                      agent.agent_type === "internal"
                        ? "bg-gold/10 text-gold border-gold/30 font-body"
                        : "font-body"
                    }
                  >
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
                    onCheckedChange={(val) => handleToggle(agent, "is_published", val)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={agent.is_featured}
                    onCheckedChange={(val) => handleToggle(agent, "is_featured", val)}
                    disabled={agent.agent_type !== "internal"}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Link to={`/admin/agents/${agent.id}/edit`}>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-gold">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </Link>
                </TableCell>
                <TableCell className="text-center">
                  {!agent.profiles?.password_set_at && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-gold"
                          disabled={resending === agent.id}
                          onClick={() => handleResendInvite(agent)}
                        >
                          {resending === agent.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Resend invite email</TooltipContent>
                    </Tooltip>
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
