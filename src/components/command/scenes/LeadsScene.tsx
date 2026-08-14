import { useEffect, useState } from "react";
import { useCommand } from "../CommandContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, MoreVertical, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { shareLead, acceptLeadShare, declineLeadShare } from "./leadShareOperations";
import { createLead, updateLeadStatus, LEAD_STATUSES, LeadStatus } from "./leadOperations";
import { Input } from "@/components/ui/input";

const statusTabs = ["All", ...LEAD_STATUSES] as const;

interface PendingLeadShare {
  id: string;
  message: string | null;
  created_at: string;
  lead: { id: string; full_name: string | null } | null;
  from_agent: { profiles: { full_name: string | null } | null } | null;
}

export function LeadsScene() {
  const { state, dispatch } = useCommand();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");
  const filter = state.sceneParams?.filter;

  const [agentId, setAgentId] = useState<string | null>(null);
  const [pendingShares, setPendingShares] = useState<PendingLeadShare[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [reassignLeadId, setReassignLeadId] = useState<string | null>(null);
  const [colleagues, setColleagues] = useState<{ id: string; profiles: { full_name: string | null } | null }[]>([]);
  const [selectedColleague, setSelectedColleague] = useState("");
  const [reassignMessage, setReassignMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadNotes, setNewLeadNotes] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (filter) setActiveTab(filter);
    loadLeads();
    loadPendingShares();
  }, []);

  // Handles the Quick Access "Log a Lead" button, which dispatches
  // NAVIGATE with params: { action: "add" } — mirrors CalendarScene's
  // bookParam pattern so it also fires if this scene is already mounted.
  const addParam = state.sceneParams?.action;
  useEffect(() => {
    if (addParam === "add") openAddDialog();
  }, [addParam]);

  function openAddDialog() {
    setNewLeadName("");
    setNewLeadPhone("");
    setNewLeadEmail("");
    setNewLeadNotes("");
    setShowAddDialog(true);
  }

  async function handleAddLead() {
    if (!agentId || !newLeadName.trim()) return;
    setAdding(true);
    const { error } = await createLead(agentId, {
      full_name: newLeadName.trim(),
      phone: newLeadPhone || undefined,
      email: newLeadEmail || undefined,
      notes: newLeadNotes || undefined,
    });
    setAdding(false);
    if (error) {
      toast({ title: "Couldn't add lead", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Added ${newLeadName.trim()} as a new lead` });
    setShowAddDialog(false);
    loadLeads();
  }

  async function loadLeads() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setAgentId(user.id);

    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    setLeads(data || []);
    setLoading(false);
  }

  async function loadPendingShares() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // TODO: remove the `as any` cast once `supabase gen types typescript` has been
    // re-run after supabase/migrations/20260810000000_lead_reassignment.sql lands.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("lead_shares")
      .select("id, message, created_at, lead:leads(id, full_name), from_agent:agent_profiles!lead_shares_from_agent_id_fkey(profiles(full_name))")
      .eq("to_agent_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error) setPendingShares(data || []);
  }

  async function openReassignDialog(leadId: string) {
    setReassignLeadId(leadId);
    setSelectedColleague("");
    setReassignMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("agent_profiles")
      .select("id, profiles(full_name)")
      .eq("is_published", true)
      .neq("id", user.id)
      .order("display_order", { ascending: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setColleagues((data as any) || []);
  }

  async function handleSendReassign() {
    if (!agentId || !reassignLeadId || !selectedColleague) return;
    setSending(true);
    const { error } = await shareLead(agentId, reassignLeadId, selectedColleague, reassignMessage || undefined);
    setSending(false);
    if (error) {
      toast({ title: "Couldn't send reassignment request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reassignment request sent" });
    setReassignLeadId(null);
  }

  async function handleAccept(shareId: string) {
    setRespondingId(shareId);
    const { error } = await acceptLeadShare(shareId);
    setRespondingId(null);
    if (error) {
      toast({ title: "Couldn't accept reassignment", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lead reassigned to you" });
    loadPendingShares();
    loadLeads();
  }

  async function handleDecline(shareId: string) {
    setRespondingId(shareId);
    const { error } = await declineLeadShare(shareId);
    setRespondingId(null);
    if (error) {
      toast({ title: "Couldn't decline reassignment", description: error.message, variant: "destructive" });
      return;
    }
    loadPendingShares();
  }

  async function handleStatusChange(leadId: string, status: LeadStatus) {
    const previous = leads;
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, status } : l)));
    const { error } = await updateLeadStatus(leadId, status);
    if (error) {
      setLeads(previous);
      toast({ title: "Couldn't update lead", description: error.message, variant: "destructive" });
    }
  }

  const filtered = leads.filter((l) => {
    if (activeTab !== "All" && l.status !== activeTab) return false;
    if (search && !l.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-2xl text-navy font-bold">Leads</h2>
        <Button size="sm" onClick={openAddDialog}>
          <Plus className="w-4 h-4 mr-1" /> Add Lead
        </Button>
      </div>

      {/* Pending Reassignments */}
      {pendingShares.length > 0 && (
        <div className="mb-4 shrink-0 bg-surface border border-gold/30 rounded-lg p-3">
          <p className="text-[11px] font-body text-gold uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Pending Reassignments
          </p>
          <div className="space-y-2">
            {pendingShares.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 bg-background rounded-lg p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-body font-medium text-foreground truncate">
                    {s.lead?.full_name || "Unknown lead"}
                  </p>
                  <p className="text-xs text-muted-foreground font-body truncate">
                    from {s.from_agent?.profiles?.full_name || "a colleague"}
                    {s.message ? ` — "${s.message}"` : ""}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" disabled={respondingId === s.id} onClick={() => handleDecline(s.id)}>
                    Decline
                  </Button>
                  <Button size="sm" disabled={respondingId === s.id} onClick={() => handleAccept(s.id)}>
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 shrink-0">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-body capitalize transition-colors ${
              activeTab === tab
                ? "bg-navy text-cream"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads..."
          className="w-full pl-9 pr-3 py-2 text-sm font-body border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-gold/30"
        />
      </div>

      {/* Lead cards */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10 font-body">
            No leads found.
          </p>
        ) : (
          filtered.map((lead) => (
            <div
              key={lead.id}
              onClick={() => dispatch({ type: "NAVIGATE", scene: "lead_detail", params: { lead_id: lead.id } })}
              className="bg-surface border border-border rounded-lg p-4 hover:shadow-card cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-body font-medium text-foreground">
                    {lead.full_name || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground font-body">
                    {lead.email} · {lead.phone}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {lead.ai_score != null && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        lead.ai_score >= 70
                          ? "bg-green-100 text-green-700"
                          : lead.ai_score >= 40
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      Score {lead.ai_score}
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => openReassignDialog(lead.id)}>
                        <Users className="w-3.5 h-3.5 mr-2" /> Reassign
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground font-body">
                <div onClick={(e) => e.stopPropagation()}>
                  <Select value={lead.status} onValueChange={(v) => handleStatusChange(lead.id, v as LeadStatus)}>
                    <SelectTrigger className="h-6 w-auto gap-1 border-none bg-transparent px-0 text-xs capitalize shadow-none focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span>·</span>
                <span className="capitalize">{lead.source}</span>
                <span>·</span>
                <span>{new Date(lead.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reassign dialog */}
      <Dialog open={!!reassignLeadId} onOpenChange={(open) => !open && setReassignLeadId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Lead</DialogTitle>
            <DialogDescription>Invite a colleague to take over this lead. They'll need to accept before ownership transfers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Colleague</label>
              <Select value={selectedColleague} onValueChange={setSelectedColleague}>
                <SelectTrigger><SelectValue placeholder="Select a colleague" /></SelectTrigger>
                <SelectContent>
                  {colleagues.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.profiles?.full_name || "Unnamed agent"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Message (optional)</label>
              <Textarea value={reassignMessage} onChange={(e) => setReassignMessage(e.target.value)} placeholder="Any context for your colleague..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignLeadId(null)}>Cancel</Button>
            <Button onClick={handleSendReassign} disabled={sending || !selectedColleague}>
              {sending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lead dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Lead</DialogTitle>
            <DialogDescription>Log a new prospect manually.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Full Name *</label>
              <Input value={newLeadName} onChange={(e) => setNewLeadName(e.target.value)} placeholder="e.g. John Tan" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Phone</label>
                <Input value={newLeadPhone} onChange={(e) => setNewLeadPhone(e.target.value)} placeholder="91234567" />
              </div>
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Email</label>
                <Input value={newLeadEmail} onChange={(e) => setNewLeadEmail(e.target.value)} placeholder="john@example.com" />
              </div>
            </div>
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Notes (optional)</label>
              <Textarea value={newLeadNotes} onChange={(e) => setNewLeadNotes(e.target.value)} placeholder="How you met, what they're looking for..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddLead} disabled={adding || !newLeadName.trim()}>
              {adding ? "Adding..." : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
