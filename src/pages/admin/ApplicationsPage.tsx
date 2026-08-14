import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { reviewApplication } from "@/components/admin/adminOperations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, FileText, Search, Sparkles, UserCheck, UserX } from "lucide-react";

type ApplicationStatus = "pending" | "reviewing" | "interview" | "approved" | "declined";

type ApplicationRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  current_agency: string | null;
  years_of_experience: number | null;
  specialisations: string[] | null;
  portfolio_url: string | null;
  resume_url: string | null;
  short_bio: string | null;
  message: string | null;
  cea_no: string | null;
  nric_last4: string | null;
  status: ApplicationStatus | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

const statusStyles: Record<ApplicationStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  reviewing: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  interview: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  declined: "bg-rose-500/10 text-rose-700 border-rose-500/20",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = applications.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("agent_applications")
        .select("id, full_name, email, phone, current_agency, years_of_experience, specialisations, portfolio_url, resume_url, short_bio, message, cea_no, nric_last4, status, admin_notes, reviewed_at, reviewed_by, created_at")
        .order("created_at", { ascending: false });

      if (!mounted) return;
      if (error) {
        toast({ title: "Error loading applications", description: error.message, variant: "destructive" });
      } else {
        const rows = (data ?? []) as ApplicationRow[];
        setApplications(rows);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
        setNotes(rows[0]?.admin_notes ?? "");
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setNotes(selected?.admin_notes ?? "");
  }, [selected?.admin_notes, selected?.id]);

  const filtered = useMemo(() => {
    return applications.filter((application) => {
      if (statusFilter !== "all" && (application.status ?? "pending") !== statusFilter) return false;
      if (!search.trim()) return true;
      const haystack = [
        application.full_name,
        application.email,
        application.current_agency,
        application.cea_no,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [applications, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: applications.length,
      pending: applications.filter((item) => (item.status ?? "pending") === "pending").length,
      reviewing: applications.filter((item) => item.status === "reviewing").length,
      interview: applications.filter((item) => item.status === "interview").length,
      approved: applications.filter((item) => item.status === "approved").length,
      declined: applications.filter((item) => item.status === "declined").length,
    };
  }, [applications]);

  async function applyStatus(status: ApplicationStatus) {
    if (!selected) return;
    setSaving(true);
    const { error } = await reviewApplication(selected.id, status, notes);
    setSaving(false);
    if (error) {
      toast({ title: "Unable to update application", description: error, variant: "destructive" });
      return;
    }
    toast({ title: `Application marked ${status}` });
    setApplications((prev) =>
      prev.map((item) =>
        item.id === selected.id
          ? { ...item, status, admin_notes: notes, reviewed_at: new Date().toISOString() }
          : item
      )
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Review queue</Badge>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Applications</h1>
          <p className="mt-2 font-body text-muted-foreground">
            Review new agent applications, store admin notes, and move each record through the review stages.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Total", value: stats.total, icon: FileText },
          { label: "Pending", value: stats.pending, icon: Sparkles },
          { label: "Reviewing", value: stats.reviewing, icon: UserCheck },
          { label: "Interview", value: stats.interview, icon: CheckCircle2 },
          { label: "Approved", value: stats.approved, icon: UserCheck },
          { label: "Declined", value: stats.declined, icon: UserX },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="font-body">{item.label}</CardDescription>
                <item.icon className="h-5 w-5 text-gold" />
              </div>
              <CardTitle className="font-heading text-3xl">{item.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Queue</CardTitle>
            <CardDescription className="font-body">
              Search, filter, and open any application in the queue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, agency, or CEA number"
                  className="pl-9"
                />
              </div>
              <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as ApplicationStatus | "all")}>
                <TabsList className="grid grid-cols-3 md:grid-cols-6">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="reviewing">Reviewing</TabsTrigger>
                  <TabsTrigger value="interview">Interview</TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                  <TabsTrigger value="declined">Declined</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="h-[70vh] pr-3">
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)
                ) : filtered.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
                    <p className="font-body text-sm text-muted-foreground">No applications match the current filters.</p>
                  </div>
                ) : (
                  filtered.map((application) => {
                    const status = application.status ?? "pending";
                    const active = application.id === selectedId;
                    return (
                      <button
                        key={application.id}
                        onClick={() => setSelectedId(application.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                          active ? "border-gold bg-gold/5" : "border-border/70 hover:border-gold/30 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-body font-semibold text-foreground">{application.full_name}</p>
                              <Badge variant="outline" className={statusStyles[status]}>
                                {status}
                              </Badge>
                            </div>
                            <p className="mt-1 font-body text-sm text-muted-foreground">{application.email}</p>
                            <p className="mt-1 font-body text-sm text-muted-foreground">
                              {application.current_agency ?? "No agency listed"} · {application.years_of_experience ?? "?"} years
                            </p>
                          </div>
                          <div className="text-sm text-muted-foreground font-body">
                            Submitted {format(new Date(application.created_at), "dd MMM yyyy")}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Application detail</CardTitle>
            <CardDescription className="font-body">
              Review notes, decide the next status, and keep a short record of the decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-[60vh] rounded-xl" />
            ) : selected ? (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-heading text-2xl text-foreground">{selected.full_name}</h2>
                    <p className="font-body text-sm text-muted-foreground">{selected.email}</p>
                  </div>
                  <Badge variant="outline" className={statusStyles[selected.status ?? "pending"]}>
                    {selected.status ?? "pending"}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Phone" value={selected.phone} />
                  <Info label="CEA No." value={selected.cea_no ?? "—"} />
                  <Info label="Agency" value={selected.current_agency ?? "—"} />
                  <Info label="Experience" value={selected.years_of_experience ? `${selected.years_of_experience} years` : "—"} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="application-notes">Admin notes</Label>
                  <Textarea
                    id="application-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    placeholder="Write a concise review note for the admin team..."
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button disabled={saving} onClick={() => void applyStatus("reviewing")} variant="outline">
                    Mark reviewing
                  </Button>
                  <Button disabled={saving} onClick={() => void applyStatus("interview")} variant="outline">
                    Shortlist interview
                  </Button>
                  <Button disabled={saving} onClick={() => void applyStatus("approved")} className="bg-gold hover:bg-gold-dark text-primary">
                    Approve
                  </Button>
                  <Button disabled={saving} onClick={() => void applyStatus("declined")} variant="destructive">
                    Decline
                  </Button>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/70 p-4">
                  <div>
                    <p className="font-body font-semibold text-foreground">Source material</p>
                    <p className="font-body text-sm text-muted-foreground">
                      Use the files and links below when validating the application.
                    </p>
                  </div>
                  <LinkRow label="Portfolio" value={selected.portfolio_url} />
                  <LinkRow label="Resume" value={selected.resume_url} />
                  <Info label="Bio" value={selected.short_bio ?? "—"} />
                  <Info label="Applicant message" value={selected.message ?? "—"} />
                </div>

                <div className="rounded-2xl bg-muted/30 p-4">
                  <p className="font-body text-xs uppercase tracking-wide text-muted-foreground">Audit trail</p>
                  <p className="mt-2 font-body text-sm text-foreground">
                    Reviewed at {selected.reviewed_at ? format(new Date(selected.reviewed_at), "dd MMM yyyy, HH:mm") : "not yet reviewed"}.
                  </p>
                  <p className="font-body text-sm text-muted-foreground">
                    Last note: {selected.admin_notes || "No note yet."}
                  </p>
                </div>
              </>
            ) : (
              <p className="font-body text-sm text-muted-foreground">Select an application from the queue.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 p-3">
      <p className="font-body text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-body text-sm text-foreground break-words">{value}</p>
    </div>
  );
}

function LinkRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2">
      <span className="font-body text-sm text-muted-foreground">{label}</span>
      {value ? (
        <a href={value} target="_blank" rel="noreferrer" className="font-body text-sm text-gold hover:text-gold-dark">
          Open
        </a>
      ) : (
        <span className="font-body text-sm text-muted-foreground">Not provided</span>
      )}
    </div>
  );
}
