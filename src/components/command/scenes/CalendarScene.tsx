import { useEffect, useState, useCallback } from "react";
import { useCommand } from "../CommandContext";
import { supabase } from "@/integrations/supabase/client";
import {
  bookViewing, updateViewingStatus, rescheduleViewing, VIEWING_STATUSES, ViewingStatus,
} from "./viewingOperations";
import { createTask, setTaskCompletion } from "./taskOperations";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, Search, CheckCircle2, Circle, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface ViewingRow {
  id: string;
  scheduled_at: string;
  duration_mins: number | null;
  status: ViewingStatus;
  notes: string | null;
  leads: { full_name: string | null; phone: string | null } | null;
  properties: { title: string | null; property_name: string | null; address: string | null } | null;
}

// agent_tasks — the agent's other personal-assistant activities (calls,
// follow-ups, admin reminders) that aren't a property viewing. Deliberately
// a separate, lighter table from `viewings` (no conflict/buffer checking,
// due_at is optional) rather than one shared "events" table — see
// BUILD_GUIDE.md Part E.
interface TaskRow {
  id: string;
  title: string;
  due_at: string | null;
  is_completed: boolean;
  leads: { full_name: string | null } | null;
  properties: { title: string | null; property_name: string | null } | null;
}

const statusStyles: Record<ViewingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

const statusTabs = ["All", ...VIEWING_STATUSES] as const;

export function CalendarScene() {
  const { state, dispatch } = useCommand();
  const { toast } = useToast();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<string>("All");
  const [search, setSearch] = useState("");

  const [leads, setLeads] = useState<{ id: string; full_name: string | null }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string | null; property_name: string | null }[]>([]);

  const [form, setForm] = useState({ leadId: "", propertyId: "", date: "", time: "", durationMins: "60", notes: "" });

  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [taskTogglingId, setTaskTogglingId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({ title: "", dueDate: "", dueTime: "", leadId: "", propertyId: "" });

  const loadViewings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setAgentId(user.id);

    const { data } = await supabase
      .from("viewings")
      .select("id, scheduled_at, duration_mins, status, notes, leads(full_name, phone), properties(title, property_name, address)")
      .eq("agent_id", user.id)
      .order("scheduled_at", { ascending: true });

    setViewings((data as unknown as ViewingRow[]) || []);
    setLoading(false);
  }, []);

  const loadTasks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("agent_tasks")
      .select("id, title, due_at, is_completed, leads(full_name), properties(title, property_name)")
      .eq("agent_id", user.id)
      .order("due_at", { ascending: true, nullsFirst: true });

    setTasks((data as unknown as TaskRow[]) || []);
  }, []);

  useEffect(() => {
    loadViewings();
    loadTasks();
  }, [loadViewings, loadTasks]);

  const openDialog = useCallback(async (prefillLeadId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // loadViewings() is the only other place agentId gets set, and it can
    // race with session hydration on mount and leave it stuck null even
    // after this call successfully authenticates — sync it here too so
    // Book/Reschedule/Cancel never fail against a stale null agentId.
    setAgentId(user.id);
    const [leadsRes, propsRes] = await Promise.all([
      supabase.from("leads").select("id, full_name").eq("agent_id", user.id).order("created_at", { ascending: false }),
      supabase.from("properties").select("id, title, property_name").eq("agent_id", user.id).eq("status", "active"),
    ]);
    setLeads(leadsRes.data || []);
    setProperties(propsRes.data || []);
    setForm({ leadId: prefillLeadId || "", propertyId: "", date: "", time: "", durationMins: "60", notes: "" });
    setDialogOpen(true);
  }, []);

  // Auto-open the booking dialog when arriving via the Quick Access "Book
  // Viewing" button, or via LeadDetailScene's "Book Viewing" button (which
  // also passes lead_id to pre-select that lead).
  const bookParam = state.sceneParams?.action;
  const bookLeadId = state.sceneParams?.lead_id;
  useEffect(() => {
    if (bookParam === "book") openDialog(bookLeadId);
  }, [bookParam, bookLeadId, openDialog]);

  const openTaskDialog = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setAgentId(user.id);
    const [leadsRes, propsRes] = await Promise.all([
      supabase.from("leads").select("id, full_name").eq("agent_id", user.id).order("created_at", { ascending: false }),
      supabase.from("properties").select("id, title, property_name").eq("agent_id", user.id).eq("status", "active"),
    ]);
    setLeads(leadsRes.data || []);
    setProperties(propsRes.data || []);
    setTaskForm({ title: "", dueDate: "", dueTime: "", leadId: "", propertyId: "" });
    setTaskDialogOpen(true);
  }, []);

  const handleAddTask = async () => {
    if (!agentId || !taskForm.title.trim()) {
      toast({ title: "Missing info", description: "A title is required.", variant: "destructive" });
      return;
    }
    setSavingTask(true);
    const dueAt = taskForm.dueDate
      ? new Date(`${taskForm.dueDate}T${taskForm.dueTime || "00:00"}`).toISOString()
      : null;
    const { error } = await createTask(agentId, {
      title: taskForm.title,
      dueAt,
      leadId: taskForm.leadId || null,
      propertyId: taskForm.propertyId || null,
    });
    setSavingTask(false);
    if (error) {
      toast({ title: "Couldn't add task", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Task added" });
    setTaskDialogOpen(false);
    await loadTasks();
  };

  const handleToggleTask = async (taskId: string, isCompleted: boolean) => {
    if (!agentId) return;
    setTaskTogglingId(taskId);
    const { error } = await setTaskCompletion(agentId, taskId, isCompleted);
    setTaskTogglingId(null);
    if (error) {
      toast({ title: "Couldn't update task", description: error, variant: "destructive" });
      return;
    }
    await loadTasks();
  };

  const handleBook = async () => {
    const missing: string[] = [];
    if (!agentId) missing.push("your session — try closing this dialog and reopening it");
    if (!form.leadId) missing.push("a lead");
    if (!form.propertyId) missing.push("a property");
    if (!form.date) missing.push("a date");
    if (!form.time) missing.push("a time (make sure hour, minute, and AM/PM are all set)");
    if (missing.length > 0) {
      toast({ title: "Missing info", description: `Still need: ${missing.join(", ")}.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await bookViewing({
      agentId,
      leadId: form.leadId,
      propertyId: form.propertyId,
      scheduledAt: `${form.date}T${form.time}`,
      durationMins: Number(form.durationMins) || 60,
      notes: form.notes,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't book viewing", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Viewing booked" });
    setDialogOpen(false);
    await loadViewings();
  };

  const handleStatusChange = async (viewingId: string, status: ViewingStatus) => {
    if (!agentId) return;
    const { error } = await updateViewingStatus(agentId, viewingId, status);
    if (error) {
      toast({ title: "Couldn't update", description: error, variant: "destructive" });
      return;
    }
    await loadViewings();
  };

  function openReschedule(viewingId: string) {
    setRescheduleId(viewingId);
    setRescheduleDate("");
    setRescheduleTime("");
  }

  async function handleReschedule() {
    if (!agentId || !rescheduleId || !rescheduleDate || !rescheduleTime) return;
    setRescheduling(true);
    const { error } = await rescheduleViewing({
      agentId,
      viewingId: rescheduleId,
      newScheduledAt: `${rescheduleDate}T${rescheduleTime}`,
    });
    setRescheduling(false);
    if (error) {
      toast({ title: "Couldn't reschedule", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Viewing rescheduled" });
    setRescheduleId(null);
    await loadViewings();
  }

  function openCancel(viewingId: string) {
    setCancelId(viewingId);
    setCancelReason("");
  }

  async function handleCancel() {
    if (!agentId || !cancelId) return;
    setCancelling(true);
    const { error } = await updateViewingStatus(agentId, cancelId, "cancelled", cancelReason || undefined);
    setCancelling(false);
    if (error) {
      toast({ title: "Couldn't cancel", description: error, variant: "destructive" });
      return;
    }
    setCancelId(null);
    await loadViewings();
  }

  const filtered = viewings.filter((v) => {
    if (activeTab !== "All" && v.status !== activeTab) return false;
    if (search && !v.leads?.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const upcoming = filtered.filter((v) => v.status === "pending" || v.status === "confirmed");
  const past = filtered.filter((v) => v.status !== "pending" && v.status !== "confirmed");

  const filteredTasks = tasks.filter((t) => {
    if (!search) return true;
    return t.title.toLowerCase().includes(search.toLowerCase()) || t.leads?.full_name?.toLowerCase().includes(search.toLowerCase());
  });
  const openTasks = filteredTasks.filter((t) => !t.is_completed);
  const completedTasks = filteredTasks.filter((t) => t.is_completed);

  const nothingToShow = filtered.length === 0 && filteredTasks.length === 0;

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0 gap-2">
        <h2 className="font-heading text-2xl text-navy font-bold">Schedule</h2>
        <div className="flex gap-2">
          <Button onClick={openTaskDialog} size="sm" variant="outline" className="gap-1.5">
            <ListTodo className="w-4 h-4" /> Add Task
          </Button>
          <Button onClick={() => openDialog()} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Book Viewing
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 shrink-0">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-body capitalize transition-colors whitespace-nowrap ${
              activeTab === tab
                ? "bg-navy text-cream"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.replace("_", "-")}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by lead name..."
          className="w-full pl-9 pr-3 py-2 text-sm font-body border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-gold/30"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : nothingToShow ? (
          <p className="text-center text-muted-foreground text-sm py-10 font-body">
            Nothing scheduled yet — book a viewing or add a task.
          </p>
        ) : (
          <>
            {openTasks.length > 0 && (
              <TaskList title="Open Tasks" items={openTasks} onToggle={handleToggleTask} togglingId={taskTogglingId} />
            )}
            <ViewingList
              title="Upcoming"
              items={upcoming}
              onStatusChange={handleStatusChange}
              onReschedule={openReschedule}
              onCancel={openCancel}
              onOpen={(id) => dispatch({ type: "NAVIGATE", scene: "viewing_detail", params: { viewing_id: id } })}
            />
            {past.length > 0 && (
              <ViewingList
                title="Past"
                items={past}
                onStatusChange={handleStatusChange}
                onReschedule={openReschedule}
                onCancel={openCancel}
                onOpen={(id) => dispatch({ type: "NAVIGATE", scene: "viewing_detail", params: { viewing_id: id } })}
              />
            )}
            {completedTasks.length > 0 && (
              <TaskList title="Completed Tasks" items={completedTasks} onToggle={handleToggleTask} togglingId={taskTogglingId} />
            )}
          </>
        )}
      </div>

      {/* Book dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book a Viewing</DialogTitle>
            <DialogDescription>Schedule a property viewing for one of your leads.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Lead</label>
              <Select value={form.leadId} onValueChange={(v) => setForm((f) => ({ ...f, leadId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a lead" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.full_name || "Unnamed lead"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Property</label>
              <Select value={form.propertyId} onValueChange={(v) => setForm((f) => ({ ...f, propertyId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title || p.property_name || "Untitled property"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Date</label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Time</label>
                <Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Duration (minutes)</label>
              <Input type="number" min={15} step={15} value={form.durationMins} onChange={(e) => setForm((f) => ({ ...f, durationMins: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Notes (optional)</label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Access instructions, what the client is looking for, etc." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBook} disabled={saving}>{saving ? "Booking..." : "Book Viewing"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={!!rescheduleId} onOpenChange={(open) => !open && setRescheduleId(null)}>
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
            <Button variant="outline" onClick={() => setRescheduleId(null)}>Cancel</Button>
            <Button onClick={handleReschedule} disabled={rescheduling || !rescheduleDate || !rescheduleTime}>
              {rescheduling ? "Rescheduling..." : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Viewing</DialogTitle>
            <DialogDescription>Optional — note why, useful later for drop-off tracking.</DialogDescription>
          </DialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Client rescheduled travel plans" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>Back</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel Viewing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>Log a reminder or to-do — a call, follow-up, or anything else that isn't a viewing.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Title *</label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Call John about financing" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Due date (optional)</label>
                <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Due time (optional)</label>
                <Input type="time" value={taskForm.dueTime} onChange={(e) => setTaskForm((f) => ({ ...f, dueTime: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Linked lead (optional)</label>
              <Select value={taskForm.leadId} onValueChange={(v) => setTaskForm((f) => ({ ...f, leadId: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.full_name || "Unnamed lead"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-body text-muted-foreground mb-1 block">Linked property (optional)</label>
              <Select value={taskForm.propertyId} onValueChange={(v) => setTaskForm((f) => ({ ...f, propertyId: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title || p.property_name || "Untitled property"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTask} disabled={savingTask || !taskForm.title.trim()}>
              {savingTask ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskList({ title, items, onToggle, togglingId }: {
  title: string;
  items: TaskRow[];
  onToggle: (id: string, isCompleted: boolean) => void;
  togglingId: string | null;
}) {
  return (
    <div>
      <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-2">
        {items.map((t) => (
          <div key={t.id} className="bg-surface border border-border rounded-lg p-3 flex items-start gap-3">
            <button
              onClick={() => onToggle(t.id, !t.is_completed)}
              disabled={togglingId === t.id}
              className="mt-0.5 shrink-0 text-gold hover:text-gold-dark transition-colors disabled:opacity-50"
            >
              {t.is_completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            </button>
            <div className="min-w-0">
              <p className={`font-body text-sm ${t.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {t.title}
              </p>
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                {t.due_at && new Date(t.due_at).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" })}
                {t.leads?.full_name && `${t.due_at ? " · " : ""}${t.leads.full_name}`}
                {(t.properties?.title || t.properties?.property_name) && ` · ${t.properties.title || t.properties.property_name}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewingList({ title, items, onStatusChange, onReschedule, onCancel, onOpen }: {
  title: string;
  items: ViewingRow[];
  onStatusChange: (id: string, status: ViewingStatus) => void;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-body text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-3">
        {items.map((v) => {
          const dt = new Date(v.scheduled_at);
          return (
            <div
              key={v.id}
              onClick={() => onOpen(v.id)}
              className="bg-surface border border-border rounded-lg p-4 hover:shadow-card cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-body font-medium text-foreground">
                    {v.properties?.title || v.properties?.property_name || "Untitled property"}
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-0.5">
                    with {v.leads?.full_name || "Unknown lead"}
                  </p>
                  <p className="text-xs text-muted-foreground font-body flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {dt.toLocaleDateString()} · {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {v.duration_mins || 60} min
                  </p>
                  {v.notes && <p className="text-xs text-muted-foreground font-body mt-1 italic">{v.notes}</p>}
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${statusStyles[v.status]}`}>
                  {v.status.replace("_", "-")}
                </span>
              </div>
              {(v.status === "pending" || v.status === "confirmed") && (
                <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                  {v.status === "pending" && (
                    <button onClick={() => onStatusChange(v.id, "confirmed")} className="text-xs font-body text-gold hover:text-gold-dark transition-colors">
                      Confirm
                    </button>
                  )}
                  <button onClick={() => onStatusChange(v.id, "completed")} className="text-xs font-body text-muted-foreground hover:text-foreground transition-colors">
                    Mark Completed
                  </button>
                  <button onClick={() => onStatusChange(v.id, "no_show")} className="text-xs font-body text-muted-foreground hover:text-foreground transition-colors">
                    Mark No-show
                  </button>
                  <button onClick={() => onReschedule(v.id)} className="text-xs font-body text-muted-foreground hover:text-foreground transition-colors">
                    Reschedule
                  </button>
                  <button onClick={() => onCancel(v.id)} className="text-xs font-body text-destructive hover:text-destructive/80 transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
