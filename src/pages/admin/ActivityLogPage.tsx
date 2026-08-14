import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, ClipboardList, Search } from "lucide-react";

type LogRow = {
  id: string;
  action: string;
  target_type: string;
  target_name: string | null;
  created_at: string;
  changes: Record<string, unknown> | null;
  profiles: { full_name: string | null; email: string } | null;
};

type TargetFilter = "all" | "agent" | "listing" | "application" | "other";

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedChanges, setExpandedChanges] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("admin_activity_log")
        .select("id, action, target_type, target_name, created_at, changes, profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!mounted) return;

      if (error) {
        toast({ title: "Error loading activity log", description: error.message, variant: "destructive" });
      } else {
        const rows = (data as LogRow[]) ?? [];
        setLogs(rows);
        setSelectedId(rows[0]?.id ?? null);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (targetFilter !== "all") {
        if (targetFilter === "other" && ["agent", "listing", "application"].includes(log.target_type)) return false;
        if (targetFilter !== "other" && log.target_type !== targetFilter) return false;
      }

      if (!search.trim()) return true;
      const haystack = [log.action, log.target_type, log.target_name, log.profiles?.full_name, log.profiles?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [logs, search, targetFilter]);

  const selected = filteredLogs.find((log) => log.id === selectedId) ?? filteredLogs[0] ?? null;

  useEffect(() => {
    if (selected?.id) setSelectedId(selected.id);
  }, [selected?.id]);

  const stats = useMemo(() => ({
    total: logs.length,
    agents: logs.filter((log) => log.target_type === "agent").length,
    listings: logs.filter((log) => log.target_type === "listing").length,
    applications: logs.filter((log) => log.target_type === "application").length,
  }), [logs]);

  return (
    <div className="p-6 sm:p-8 max-w-7xl space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-gold" />
        <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Audit trail</Badge>
      </div>

      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">Activity Log</h1>
        <p className="mt-2 font-body text-muted-foreground">
          Filter the admin audit trail, inspect who made the change, and review the exact fields that changed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total entries" value={stats.total} />
        <StatCard label="Agent actions" value={stats.agents} />
        <StatCard label="Listing actions" value={stats.listings} />
        <StatCard label="Application actions" value={stats.applications} />
      </div>

      <Card className="border-border/70">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-heading text-xl">Log entries</CardTitle>
              <CardDescription className="font-body">
                Search and narrow the log before opening one record for details.
              </CardDescription>
            </div>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search action, target, or admin name"
                className="pl-9"
              />
            </div>
          </div>

          <Tabs value={targetFilter} onValueChange={(value) => setTargetFilter(value as TargetFilter)} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="agent">Agents</TabsTrigger>
              <TabsTrigger value="listing">Listings</TabsTrigger>
              <TabsTrigger value="application">Applications</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-xl" />)
            ) : filteredLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
                <p className="font-body text-sm text-muted-foreground">No activity matches the current filters.</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const active = log.id === selected?.id;
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedId(log.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      active ? "border-gold bg-gold/5" : "border-border/70 hover:border-gold/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-body font-semibold text-foreground">{log.action}</p>
                          <Badge variant="outline" className="font-body capitalize">
                            {log.target_type}
                          </Badge>
                        </div>
                        <p className="font-body text-sm text-muted-foreground">
                          {log.target_name ?? "Unnamed target"} • {log.profiles?.full_name ?? log.profiles?.email ?? "Unknown admin"}
                        </p>
                      </div>
                      <p className="font-body text-sm text-muted-foreground">
                        {format(new Date(log.created_at), "dd MMM yyyy, HH:mm")}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="font-heading text-xl">Detail view</CardTitle>
              <CardDescription className="font-body">
                Open one log item to inspect the actor, the target, and the change payload.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected ? (
                <>
                  <InfoRow label="Action" value={selected.action} />
                  <InfoRow label="Target" value={`${selected.target_type} / ${selected.target_name ?? "Unnamed"}`} />
                  <InfoRow label="Admin" value={selected.profiles?.full_name ?? selected.profiles?.email ?? "Unknown"} />
                  <InfoRow label="When" value={format(new Date(selected.created_at), "dd MMM yyyy, HH:mm")} />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-body text-sm font-semibold text-foreground">Changes</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedChanges((current) => (current === selected.id ? null : selected.id))}
                      >
                        {expandedChanges === selected.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                      <pre className="whitespace-pre-wrap break-words font-body text-xs text-foreground">
                        {expandedChanges === selected.id
                          ? JSON.stringify(selected.changes ?? {}, null, 2)
                          : selected.changes
                            ? JSON.stringify(selected.changes)
                            : "No change payload."}
                      </pre>
                    </div>
                  </div>
                </>
              ) : (
                <p className="font-body text-sm text-muted-foreground">Select a log entry to see more detail.</p>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <CardDescription className="font-body">{label}</CardDescription>
        <CardTitle className="font-heading text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 p-3">
      <p className="font-body text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-body text-sm text-foreground break-words">{value}</p>
    </div>
  );
}
