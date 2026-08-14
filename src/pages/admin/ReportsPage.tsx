import { useEffect, useMemo, useState, type ComponentType } from "react";
import { fetchAdminOverview, type AdminOverview } from "@/components/admin/adminOverview";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Building2, FileText, Users } from "lucide-react";

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardDescription className="font-body">{label}</CardDescription>
          <Icon className="h-5 w-5 text-gold" />
        </div>
        <CardTitle className="font-heading text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-body text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await fetchAdminOverview();
      if (!mounted) return;
      if (error) {
        toast({ title: "Error loading reports", description: error, variant: "destructive" });
      } else {
        setOverview(data);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!overview) return null;

    const agentPublishRate = overview.counts.agentsTotal
      ? Math.round((overview.counts.agentsPublished / overview.counts.agentsTotal) * 100)
      : 0;
    const listingLiveRate = overview.counts.listingsTotal
      ? Math.round((overview.counts.listingsActive / overview.counts.listingsTotal) * 100)
      : 0;
    const inviteBacklog = overview.counts.agentsPendingInvite;
    const applicationBacklog = overview.counts.applicationsPending + overview.counts.applicationsReviewing;

    return { agentPublishRate, listingLiveRate, inviteBacklog, applicationBacklog };
  }, [overview]);

  const counts = overview?.counts;

  return (
    <div className="p-6 sm:p-8 max-w-7xl space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-gold" />
        <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Operational report</Badge>
      </div>
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground">Reports</h1>
        <p className="mt-2 font-body text-muted-foreground">
          A practical reporting view for admin decisions, public visibility, and backlog tracking.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Agent publish rate"
              value={`${metrics?.agentPublishRate ?? 0}%`}
              detail="How many agents are currently visible on the public team page."
              icon={Users}
            />
            <StatCard
              label="Listing live rate"
              value={`${metrics?.listingLiveRate ?? 0}%`}
              detail="How many listings are active on the public site."
              icon={Building2}
            />
            <StatCard
              label="Invite backlog"
              value={`${metrics?.inviteBacklog ?? 0}`}
              detail="Agents still waiting on password setup or first login."
              icon={FileText}
            />
            <StatCard
              label="Application backlog"
              value={`${metrics?.applicationBacklog ?? 0}`}
              detail="Applications waiting to be reviewed or moved forward."
              icon={BarChart3}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">Visibility health</CardTitle>
            <CardDescription className="font-body">
              These are the main levers that change what visitors see on the public site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : (
              <>
                <MetricLine label="Team page visibility" value={`${counts?.agentsPublished ?? 0}/${counts?.agentsTotal ?? 0}`} percent={metrics?.agentPublishRate ?? 0} />
                <MetricLine label="Homepage featured agents" value={`${counts?.agentsFeatured ?? 0}`} percent={counts?.agentsTotal ? Math.round(((counts.agentsFeatured ?? 0) / counts.agentsTotal) * 100) : 0} />
                <MetricLine label="Active listings" value={`${counts?.listingsActive ?? 0}/${counts?.listingsTotal ?? 0}`} percent={metrics?.listingLiveRate ?? 0} />
                <MetricLine label="Featured listings" value={`${counts?.listingsFeatured ?? 0}`} percent={counts?.listingsTotal ? Math.round(((counts.listingsFeatured ?? 0) / counts.listingsTotal) * 100) : 0} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">What this means</CardTitle>
            <CardDescription className="font-body">
              A quick read on the current admin workload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoBlock
              title="Admin focus"
              text="Keep agents published only when their profile is ready, and use featured status sparingly so the public homepage stays curated."
            />
            <InfoBlock
              title="Application queue"
              text="When the review backlog grows, move the most complete applications into the interview stage first so the pipeline keeps moving."
            />
            <InfoBlock
              title="Invite flow"
              text="If an invite email lands in spam, the admin can still resend the recovery/invite email from the Agents page."
            />
            <InfoBlock
              title="Copilot"
              text="Use the Admin Copilot for summaries and controlled actions when you want to move faster without hopping between pages."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricLine({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="font-body text-sm text-muted-foreground">{label}</span>
        <span className="font-body text-sm font-semibold text-foreground">{value}</span>
      </div>
      <Progress value={percent} className="h-2" />
      <p className="font-body text-xs text-muted-foreground">{percent}%</p>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <p className="font-body font-semibold text-foreground">{title}</p>
      <p className="mt-1 font-body text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
