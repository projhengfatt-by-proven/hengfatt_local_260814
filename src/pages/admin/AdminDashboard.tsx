import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { fetchAdminOverview, type AdminOverview } from "@/components/admin/adminOverview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Building2,
  FileText,
  Sparkles,
  Users,
  ClipboardList,
  BarChart3,
  Settings,
  UserPlus,
} from "lucide-react";

const quickActions = [
  { label: "Add New Agent", href: "/admin/agents/new", icon: UserPlus },
  { label: "Review Applications", href: "/admin/applications", icon: FileText },
  { label: "Check Listings", href: "/admin/listings", icon: Building2 },
  { label: "Open Copilot", href: "/admin/copilot", icon: Sparkles },
];

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardDescription className="font-body text-sm">{title}</CardDescription>
          <Icon className="h-5 w-5 text-gold" />
        </div>
        <CardTitle className="font-heading text-3xl text-foreground">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="font-body text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await fetchAdminOverview();
      if (!mounted) return;
      if (error) {
        toast({ title: "Could not load admin dashboard", description: error, variant: "destructive" });
      } else {
        setOverview(data);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const counts = overview?.counts;

  return (
    <div className="p-6 sm:p-8 max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Admin Operations</Badge>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground">
            Admin Dashboard
          </h1>
          <p className="max-w-2xl font-body text-muted-foreground">
            See what needs attention first: agent visibility, listing status, applications, and the latest admin activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Button key={action.href} asChild className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
              <Link to={action.href}>
                <action.icon className="mr-2 h-4 w-4" />
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)
        ) : (
          <>
            <MetricCard
              title="Agents published"
              value={`${counts?.agentsPublished ?? 0}/${counts?.agentsTotal ?? 0}`}
              detail={`${counts?.agentsFeatured ?? 0} featured on the homepage`}
              icon={Users}
            />
            <MetricCard
              title="Listings live"
              value={`${counts?.listingsActive ?? 0}/${counts?.listingsTotal ?? 0}`}
              detail={`${counts?.listingsFeatured ?? 0} marked as featured`}
              icon={Building2}
            />
            <MetricCard
              title="Applications pending"
              value={counts?.applicationsPending ?? 0}
              detail={`${counts?.applicationsReviewing ?? 0} under review`}
              icon={FileText}
            />
            <MetricCard
              title="Pending invites"
              value={counts?.agentsPendingInvite ?? 0}
              detail="Agents who have not set a password yet"
              icon={UserPlus}
            />
            <MetricCard
              title="Activity entries"
              value={counts?.activityTotal ?? 0}
              detail="Recent admin actions captured in the log"
              icon={ClipboardList}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="font-heading text-xl">Work queue</CardTitle>
              <CardDescription className="font-body">
                The items most likely to need a follow-up right now.
              </CardDescription>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/admin/copilot" className="gap-2">
                Ask Copilot <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)
            ) : (
              <>
                <div className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-body font-semibold text-foreground">Pending applications</p>
                      <p className="font-body text-sm text-muted-foreground">
                        Review {counts?.applicationsPending ?? 0} new or waiting applications.
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/admin/applications">Open</Link>
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-body font-semibold text-foreground">Draft listings</p>
                      <p className="font-body text-sm text-muted-foreground">
                        {counts?.listingsDraft ?? 0} drafts are hidden from the public site until published.
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/admin/listings">Open</Link>
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-body font-semibold text-foreground">Agent invites</p>
                      <p className="font-body text-sm text-muted-foreground">
                        {counts?.agentsPendingInvite ?? 0} agents still need their first login or password setup.
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/admin/agents">Open</Link>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">Copilot</CardTitle>
            <CardDescription className="font-body">
              Read dashboard metrics, explain logs, and propose controlled admin actions with confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-gold/5 border border-gold/20 p-4">
              <p className="font-body text-sm text-foreground">
                Try questions like:
              </p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground font-body">
                <li>• What needs attention today?</li>
                <li>• Which listings are draft but should go live?</li>
                <li>• Explain the last activity log entry.</li>
              </ul>
            </div>

            <Button asChild className="w-full bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
              <Link to="/admin/copilot">
                <Sparkles className="mr-2 h-4 w-4" />
                Open Admin Copilot
              </Link>
            </Button>

            <div className="rounded-xl border border-border/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-body text-sm text-muted-foreground">Settings</span>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="font-body text-sm text-foreground">
                Visibility rules, invite defaults, and admin preferences are documented in Settings.
              </p>
              <Button variant="ghost" asChild className="px-0 text-gold hover:text-gold-dark">
                <Link to="/admin/settings" className="gap-2">
                  Review settings <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">Pending invites</CardTitle>
            <CardDescription className="font-body">
              Agents who have not set a password yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : overview?.pendingInvites.length ? (
              overview.pendingInvites.slice(0, 5).map((agent) => (
                <div key={agent.id} className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                  <div>
                    <p className="font-body font-semibold text-foreground">
                      {agent.profiles?.full_name ?? "Unnamed agent"}
                    </p>
                    <p className="font-body text-sm text-muted-foreground">
                      {agent.profiles?.email ?? "No email"}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-body">
                    Invite pending
                  </Badge>
                </div>
              ))
            ) : (
              <p className="font-body text-sm text-muted-foreground">
                No pending invites right now.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">Recent activity</CardTitle>
            <CardDescription className="font-body">
              The latest admin actions and content changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : overview?.activity.length ? (
              overview.activity.slice(0, 5).map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-body font-semibold text-foreground">{entry.action}</p>
                    <Badge variant="outline" className="font-body capitalize">
                      {entry.target_type}
                    </Badge>
                  </div>
                  <p className="mt-1 font-body text-sm text-muted-foreground">
                    {entry.target_name ?? "Unnamed target"} {entry.profiles?.full_name ? `by ${entry.profiles.full_name}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="font-body text-sm text-muted-foreground">
                No activity recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
