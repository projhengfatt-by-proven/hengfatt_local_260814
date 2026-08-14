import { useEffect, useState } from "react";
import { useCommand } from "../CommandContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { districtName, formatSGD } from "@/lib/listingHelpers";
import {
  ArrowLeft, Phone, Mail, Calendar, Users, ExternalLink, Sparkles, Loader2, CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  updateLeadStatus, updateLeadNotes, LEAD_STATUSES, LeadStatus,
} from "./leadOperations";
import { shareLead } from "./leadShareOperations";

interface LeadRow {
  id: string;
  agent_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus | null;
  source: string | null;
  notes: string | null;
  nationality: string | null;
  financing_status: string | null;
  timeline: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_districts: number[] | null;
  preferred_types: string[] | null;
  ai_score: number | null;
  ai_summary: string | null;
  next_followup_at: string | null;
  last_contacted_at: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  property_id: string | null;
  properties: { id: string; title: string | null; property_name: string | null; slug: string | null } | null;
}

export function LeadDetailScene() {
  const { state, dispatch } = useCommand();
  const leadId = state.sceneParams?.lead_id;
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [showReassign, setShowReassign] = useState(false);
  const [colleagues, setColleagues] = useState<{ id: string; profiles: { full_name: string | null } | null }[]>([]);
  const [selectedColleague, setSelectedColleague] = useState("");
  const [reassignMessage, setReassignMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (leadId) loadLead();
  }, [leadId]);

  async function loadLead() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setAgentId(user.id);

    const { data } = await supabase
      .from("leads")
      .select("*, properties(id, title, property_name, slug)")
      .eq("id", leadId)
      .maybeSingle();

    setLead((data as unknown as LeadRow) || null);
    setNotes(data?.notes || "");
    setFollowUp(data?.next_followup_at ? data.next_followup_at.slice(0, 10) : "");
    setLoading(false);
  }

  async function handleStatusChange(status: LeadStatus) {
    if (!lead) return;
    const previous = lead.status;
    setLead({ ...lead, status });
    const { error } = await updateLeadStatus(lead.id, status);
    if (error) {
      setLead((l) => (l ? { ...l, status: previous } : l));
      toast({ title: "Couldn't update lead", description: error.message, variant: "destructive" });
    }
  }

  async function handleSaveNotes() {
    if (!lead) return;
    setSavingNotes(true);
    const { error } = await updateLeadNotes(lead.id, {
      notes,
      next_followup_at: followUp ? new Date(followUp).toISOString() : null,
    });
    setSavingNotes(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
  }

  async function openReassign() {
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
    setShowReassign(true);
  }

  async function handleSendReassign() {
    if (!agentId || !lead || !selectedColleague) return;
    setSending(true);
    const { error } = await shareLead(agentId, lead.id, selectedColleague, reassignMessage || undefined);
    setSending(false);
    if (error) {
      toast({ title: "Couldn't send reassignment request", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reassignment request sent" });
    setShowReassign(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground font-body">Lead not found.</p>
        <button onClick={() => dispatch({ type: "GO_BACK" })} className="text-sm text-gold hover:underline font-body">
          ← Back to Leads
        </button>
      </div>
    );
  }

  const propertyLabel = lead.properties?.property_name || lead.properties?.title;

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button onClick={() => dispatch({ type: "GO_BACK" })} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-xl text-navy font-bold truncate">{lead.full_name || "Unknown"}</h2>
          <p className="text-xs text-muted-foreground font-mono truncate">ID: {lead.id}</p>
        </div>
        <Select value={lead.status || "new"} onValueChange={(v) => handleStatusChange(v as LeadStatus)}>
          <SelectTrigger className="w-[130px] h-8 text-xs capitalize"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => dispatch({ type: "NAVIGATE", scene: "calendar", params: { action: "book", lead_id: lead.id } })}
        >
          <CalendarPlus className="w-3.5 h-3.5 mr-1.5" /> Book Viewing
        </Button>
        <Button size="sm" variant="outline" onClick={openReassign}>
          <Users className="w-3.5 h-3.5 mr-1.5" /> Reassign
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Contact */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-body font-semibold text-foreground text-sm mb-3">Contact</h3>
          <div className="grid grid-cols-2 gap-3 text-sm font-body">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-3.5 h-3.5" /><span>{lead.phone || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-3.5 h-3.5" /><span>{lead.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="capitalize">Source: {lead.source || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>Added {new Date(lead.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>
        </div>

        {/* AI score */}
        {(lead.ai_score != null || lead.ai_summary) && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-body font-semibold text-foreground text-sm mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gold" /> AI Insight
            </h3>
            {lead.ai_score != null && (
              <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${
                lead.ai_score >= 70 ? "bg-green-100 text-green-700" : lead.ai_score >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-muted text-muted-foreground"
              }`}>
                Score {lead.ai_score}
              </span>
            )}
            {lead.ai_summary && <p className="text-sm text-muted-foreground font-body">{lead.ai_summary}</p>}
          </div>
        )}

        {/* Qualification */}
        {(lead.budget_min || lead.budget_max || lead.preferred_districts?.length || lead.preferred_types?.length || lead.nationality || lead.financing_status || lead.timeline) && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-body font-semibold text-foreground text-sm mb-3">Qualification</h3>
            <div className="grid grid-cols-2 gap-3 text-sm font-body text-muted-foreground">
              {(lead.budget_min || lead.budget_max) && (
                <div>Budget: {lead.budget_min ? formatSGD(lead.budget_min) : "—"} – {lead.budget_max ? formatSGD(lead.budget_max) : "—"}</div>
              )}
              {lead.preferred_types?.length ? <div>Types: {lead.preferred_types.join(", ")}</div> : null}
              {lead.preferred_districts?.length ? (
                <div className="col-span-2">
                  Districts: {lead.preferred_districts.map((d) => `D${String(d).padStart(2, "0")} ${districtName[d] || ""}`).join(", ")}
                </div>
              ) : null}
              {lead.nationality && <div>Nationality: {lead.nationality}</div>}
              {lead.financing_status && <div>Financing: {lead.financing_status}</div>}
              {lead.timeline && <div>Timeline: {lead.timeline}</div>}
            </div>
          </div>
        )}

        {/* Linked property */}
        {lead.property_id && (
          <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
            <div>
              <h3 className="font-body font-semibold text-foreground text-sm">Interested In</h3>
              <p className="text-sm text-muted-foreground font-body">{propertyLabel || "Linked listing"}</p>
            </div>
            <button
              onClick={() => dispatch({ type: "NAVIGATE", scene: "listing_detail", params: { listing_id: lead.property_id } })}
              className="flex items-center gap-1.5 text-xs text-gold hover:underline font-body"
            >
              View <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Notes + follow-up */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-body font-semibold text-foreground text-sm mb-3">Notes</h3>
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes about this lead..." />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Next follow-up</label>
              <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="h-8 text-xs w-[160px]" />
            </div>
            <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
              {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-body font-semibold text-foreground text-sm mb-3">Details</h3>
          <div className="space-y-1.5 text-xs font-body text-muted-foreground">
            <div className="flex justify-between"><span>Last contacted</span><span>{lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString("en-SG") : "—"}</span></div>
            <div className="flex justify-between"><span>Converted</span><span>{lead.converted_at ? new Date(lead.converted_at).toLocaleDateString("en-SG") : "—"}</span></div>
            <div className="flex justify-between"><span>Last updated</span><span>{new Date(lead.updated_at).toLocaleDateString("en-SG")}</span></div>
          </div>
        </div>
      </div>

      {/* Reassign dialog */}
      <Dialog open={showReassign} onOpenChange={setShowReassign}>
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
            <Button variant="outline" onClick={() => setShowReassign(false)}>Cancel</Button>
            <Button onClick={handleSendReassign} disabled={sending || !selectedColleague}>
              {sending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
