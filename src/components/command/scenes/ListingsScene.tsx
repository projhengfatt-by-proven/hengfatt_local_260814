import { useEffect, useState } from "react";
import { useCommand } from "../CommandContext";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Users, Clock } from "lucide-react";

const statusTabs = ["All", "active", "draft", "sold", "archived"] as const;

export function ListingsScene() {
  const { dispatch } = useCommand();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("All");

  useEffect(() => { loadListings(); }, []);

  async function loadListings() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("properties")
      .select("*")
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false });
    setListings(data || []);
    setLoading(false);
  }

  const filtered = activeTab === "All" ? listings : listings.filter((l) => l.status === activeTab);

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-2xl text-navy font-bold">My Listings</h2>
      </div>

      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 shrink-0">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-body capitalize transition-colors ${
              activeTab === tab ? "bg-navy text-cream" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10 font-body">No listings found.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((listing) => (
              <div
                key={listing.id}
                onClick={() => dispatch({ type: "NAVIGATE", scene: "listing_detail", params: { listing_id: listing.id } })}
                className="bg-surface border border-border rounded-lg p-4 hover:shadow-card cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-body font-semibold text-foreground text-sm">{listing.title}</h3>
                  <span className="font-heading text-lg font-bold text-navy">
                    ${Number(listing.price).toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 font-mono mb-1 truncate">
                  ID: {listing.id}
                </p>
                <p className="text-xs text-muted-foreground font-body mb-3">
                  D{listing.district} · {listing.type} · {listing.tenure || "N/A"}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground font-body">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{listing.view_count || 0}</span>
                  <span className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    listing.status === "active" ? "bg-green-100 text-green-700" :
                    listing.status === "draft" ? "bg-yellow-100 text-yellow-700" :
                    "bg-muted text-muted-foreground"
                  }`}>{listing.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
