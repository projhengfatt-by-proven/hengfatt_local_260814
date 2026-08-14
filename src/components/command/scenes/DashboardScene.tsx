import { useEffect, useState } from "react";
import { useCommand } from "../CommandContext";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Users, Home, DollarSign, BarChart3 } from "lucide-react";

interface KPI {
  label: string;
  value: string;
  icon: any;
  onClick?: () => void;
}

export function DashboardScene() {
  const { state, dispatch } = useCommand();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Fetch agent data in parallel
    const [listingsRes, leadsRes, viewingsRes] = await Promise.all([
      supabase.from("properties").select("id, price, status, view_count").eq("agent_id", user.id),
      supabase.from("leads").select("*").eq("agent_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("viewings").select("*").eq("agent_id", user.id).gte("scheduled_at", new Date().toISOString().split("T")[0]),
    ]);

    const listings = listingsRes.data || [];
    const leads = leadsRes.data || [];
    const viewings = viewingsRes.data || [];

    const activeListings = listings.filter((l) => l.status === "active");
    const pipelineValue = activeListings.reduce((s, l) => s + Number(l.price || 0), 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const newLeads = leads.filter((l) => l.created_at && l.created_at > thirtyDaysAgo);

    setKpis([
      { label: "Active Listings", value: String(activeListings.length), icon: Home },
      { label: "New Leads (30d)", value: String(newLeads.length), icon: Users },
      { label: "Pipeline Value", value: `$${(pipelineValue / 1e6).toFixed(1)}M`, icon: DollarSign },
      {
        label: "Viewings Today",
        value: String(viewings.length),
        icon: BarChart3,
        onClick: () => dispatch({ type: "NAVIGATE", scene: "calendar" }),
      },
    ]);

    setRecentLeads(leads.slice(0, 5));

    // Update global context
    dispatch({
      type: "SET_AGENT_CONTEXT",
      ctx: {
        listingsCount: activeListings.length,
        leadsCount: leads.length,
        viewingsTodayCount: viewings.length,
        pipelineValue,
      },
    });

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <h2 className="font-heading text-2xl text-navy font-bold">Dashboard</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            onClick={kpi.onClick}
            className={`bg-surface rounded-lg p-4 shadow-card border border-border ${
              kpi.onClick ? "cursor-pointer hover:border-gold/50 transition-colors" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-body">
                {kpi.label}
              </span>
              <kpi.icon className="w-4 h-4 text-gold" />
            </div>
            <p className="font-heading text-3xl font-bold text-navy">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Leads */}
      <div className="bg-surface rounded-lg shadow-card border border-border">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-heading text-lg text-navy font-semibold">Recent Leads</h3>
          <button
            onClick={() => dispatch({ type: "NAVIGATE", scene: "leads" })}
            className="text-xs font-body text-gold hover:text-gold-dark transition-colors"
          >
            View All →
          </button>
        </div>
        {recentLeads.length === 0 ? (
          <p className="px-5 py-6 text-center text-muted-foreground text-sm font-body">
            No leads yet. ARIA will notify you when new ones arrive.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {recentLeads.map((lead) => (
              <div
                key={lead.id}
                className="px-5 py-3 flex items-center justify-between hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => dispatch({ type: "NAVIGATE", scene: "lead_detail", params: { lead_id: lead.id } })}
              >
                <div>
                  <p className="font-body text-sm font-medium text-foreground">
                    {lead.full_name || "Unknown"}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    {lead.source} · {lead.status}
                  </p>
                </div>
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
                    {lead.ai_score}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
