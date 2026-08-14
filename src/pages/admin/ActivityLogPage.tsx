import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

type LogRow = {
  id: string;
  action: string;
  target_type: string;
  target_name: string | null;
  created_at: string;
  changes: Record<string, unknown> | null;
  profiles: { full_name: string | null; email: string } | null;
};

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      const { data, error } = await supabase
        .from("admin_activity_log")
        .select("id, action, target_type, target_name, created_at, changes, profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        toast({ title: "Error loading activity log", description: error.message, variant: "destructive" });
      } else {
        setLogs((data as any) ?? []);
      }
      setLoading(false);
    }
    fetchLogs();
  }, []);

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-6">
        Activity Log
      </h1>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body">When</TableHead>
              <TableHead className="font-body">Admin</TableHead>
              <TableHead className="font-body">Action</TableHead>
              <TableHead className="font-body hidden md:table-cell">Target</TableHead>
              <TableHead className="font-body hidden lg:table-cell">Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground font-body py-12">
                  No activity recorded yet.
                </TableCell>
              </TableRow>
            )}

            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-body text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(log.created_at), "dd MMM yyyy, HH:mm")}
                </TableCell>
                <TableCell className="font-body text-sm">
                  {log.profiles?.full_name ?? log.profiles?.email ?? "—"}
                </TableCell>
                <TableCell className="font-body text-sm font-medium text-foreground">
                  {log.action}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-body text-xs capitalize">
                      {log.target_type}
                    </Badge>
                    <span className="font-body text-sm text-muted-foreground">
                      {log.target_name ?? "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell font-body text-xs text-muted-foreground max-w-xs truncate">
                  {log.changes ? JSON.stringify(log.changes) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
