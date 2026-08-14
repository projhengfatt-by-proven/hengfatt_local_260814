import { useEffect, useState } from "react";
import { useCommand } from "../CommandContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Phone, Mail, Clock, ExternalLink, StickyNote,
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
  updateViewingStatus, rescheduleViewing, VIEWING_STATUSES, ViewingStatus,
} from "./viewingOperations";

interface ViewingDetailRow {
  id: string;
  agent_id: string | null;
  lead_id: string | null;
  property_id: string | null;
  scheduled_at: string;
  duration_mins: number | null;
  status: ViewingStatus;
  notes: string | null;
  cancellation_reason: string | null;
  source: string | null;
  created_at: string;
  leads: { id: string; full_name: string | null; phone: string | null; email: string | null } | null;
  properties: { id: string; title: string | null; property_name: string | null; slug: string | null } | null;
}

const statusStyles: Record<ViewingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

export function ViewingDetailScene() {
  const { state, dispatch } = useCommand();
  const viewingId = state.sceneParams?.viewing_id;
  const [viewing, setViewing] = useState<ViewingDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);

  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (viewingId) loadViewing();
  }, [viewingId]);

  async function loadViewing() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setAgentId(user.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("viewings")
      .select(
        "*, leads(id, full_name, phone, email), properties(id, title, property_name, slug)"
      )
      .eq("id", viewingId)
      .maybeSingle();

    setViewing((data as ViewingDetailRow) || null);
    setLoading(false);
  }

  async function handleStatusChange(status: ViewingStatus) {
    if (!viewing || !agentId) return;
    const previous = viewing.status;
    setViewing({ ...viewing, status });
    const { error } = await updateViewingStatus(agentId, viewing.id, status);
    if (error) {
      setViewing((v) => (v ? { ...v, status: previous } : v));
      toast({ title: "Couldn't update viewing", description: error, variant: "destructive" });
    }
  }

  async function handleReschedule() {
    if (!agentId || !viewing || !rescheduleDate || !rescheduleTime) return;
    setRescheduling(true);
    const { error, viewingId: newId } = await rescheduleViewing({
      agentId,
      viewingId: viewing.id,
      newScheduledAt: `${rescheduleDate}T${rescheduleTime}`,
    });
    setRescheduling(false);
    if (error) {
      toast({ title: "Couldn't reschedule", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Viewing rescheduled" });
    setShowReschedule(false);
    if (newId) {
      dispatch({ type: "NAVIGATE", scene: "viewing_detail", params: { viewing_id: newId } });
    } else {
      await loadViewing();
    }
  }

  async function handleCancel() {
    if (!agentId || !viewing) return;
    setCancelling(true);
    const { error } = await updateViewingStatus(agentId, viewing.id, "cancelled", cancelReason || undefined);
    setCancelling(false);
    if (error) {
      toast({ title: "Couldn't cancel", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Viewing cancelled" });
    setShowCancel(false);
    await loadViewing();
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!viewing) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground font-body">Viewing not found.</p>
        <button onClick={() => dispatch({ type: "GO_BACK" })} className="text-sm text-gold hover:underline font-body">
          ← Back to Schedule
        </button>
      </div>
    );
  }

  const propertyLabel = viewing.properties?.property_name || viewing.properties?.title || "Untitled property";
  const dt = new Date(viewing.scheduled_at);
  const editable = viewing.status === "pending" || viewing.status === "confirmed";

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button onClick={() => dispatch({ type: "GO_BACK" })} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-xl text-navy font-bold truncate">{propertyLabel}</h2>
          <p className="text-xs text-muted-foreground font-mono truncate">ID: {viewing.id}</p>
        </div>
        <Select value={viewing.status} onValueChange={(v) => handleStatusChange(v as ViewingStatus)}>
          <SelectTrigger className="w-[130px] h-8 text-xs capitalize"><SelectValue /></SelectTrigger>
          <SelectContent>
            {VIEWING_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace("_", "-")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {editable && (
          <>
            <Button size="sm" variant="outline" onClick={() => { setRescheduleDate(""); setRescheduleTime(""); setShowReschedule(true); }}>
              Reschedule
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setCancelReason(""); setShowCancel(true); }}>
              Cancel
            </Button>
          </>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* When */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-body font-semibold text-foreground text-sm mb-3">When</h3>
          <div className="grid grid-cols-2 gap-3 text-sm font-body text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              <span>{dt.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div>{dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {viewing.duration_mins || 60} min</div>
            <span className={`inline-block w-fit text-xs font-bold px-2 py-0.5 rounded-full capitalize ${statusStyles[viewing.status]}`}>
              {viewing.status.replace("_", "-")}
            </span>
            {viewing.source && <div className="capitalize">Source: {viewing.source}</div>}
          </div>
          {viewing.status === "cancelled" && viewing.cancellation_reason && (
            <p className="text-xs text-muted-foreground font-body mt-3 italic">Cancelled: {viewing.cancellation_reason}</p>
          )}
        </div>

        {/* Lead contact */}
        <div className="bg-surface border border-border rounded-lg p-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-body font-semibold text-foreground text-sm mb-2">{viewing.leads?.full_name || "Unknown lead"}</h3>
            <div className="space-y-1 text-sm font-body text-muted-foreground">
              <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /><span>{viewing.leads?.phone || "—"}</span></div>
              <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /><span>{viewing.leads?.email || "—"}</span></div>
            </div>
          </div>
          {viewing.lead_id && (
            <button
              onClick={() => dispatch({ type: "NAVIGATE", scene: "lead_detail", params: { lead_id: viewing.lead_id } })}
              className="flex items-center gap-1.5 text-xs text-gold hover:underline font-body shrink-0"
            >
              View Lead <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Property */}
        {viewing.property_id && (
          <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between">
            <div>
              <h3 className="font-body font-semibold text-foreground text-sm">Property</h3>
              <p className="text-sm text-muted-foreground font-body">{propertyLabel}</p>
            </div>
            <button
              onClick={() => dispatch({ type: "NAVIGATE", scene: "listing_detail", params: { listing_id: viewing.property_id } })}
              className="flex items-center gap-1.5 text-xs text-gold hover:underline font-body"
            >
              View <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Notes */}
        {viewing.notes && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-body font-semibold text-foreground text-sm mb-2 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5 text-gold" /> Notes
            </h3>
            <p className="text-sm text-muted-foreground font-body">{viewing.notes}</p>
          </div>
        )}
      </div>

      {/* Reschedule dialog */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Viewing</DialogTitle>
            <DialogDescription>Pick a new date and time. The original booking will be kept for history.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">New Date</label>
              <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">New Time</label>
              <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReschedule(false)}>Cancel</Button>
            <Button onClick={handleReschedule} disabled={rescheduling || !rescheduleDate || !rescheduleTime}>
              {rescheduling ? "Rescheduling..." : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Viewing</DialogTitle>
            <DialogDescription>Optional — note why, useful later for drop-off tracking.</DialogDescription>
          </DialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Client rescheduled travel plans" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancel(false)}>Back</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel Viewing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
