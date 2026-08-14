import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatSGD, districtName, relativeTime } from "@/lib/listingHelpers";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Building2, Eye, Edit, MoreVertical, ExternalLink, Copy, Trash2,
  Share2, X, Search,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

interface PropertyListing {
  id: string;
  title: string;
  property_name: string | null;
  type: string;
  transaction_type: string;
  district: number | null;
  address: string | null;
  price: number | null;
  monthly_rental: number | null;
  price_on_enquiry: boolean;
  size_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  slug: string | null;
  status: string;
  is_featured: boolean;
  view_count: number | null;
  created_at: string;
  property_images: { url: string; is_cover: boolean }[];
}

export default function AgentListingsPage() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [enquiryCounts, setEnquiryCounts] = useState<Record<string, number>>({});

  useEffect(() => { loadListings(); }, []);

  const loadListings = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("properties")
      .select("id, title, property_name, type, transaction_type, district, address, price, monthly_rental, price_on_enquiry, size_sqft, bedrooms, bathrooms, slug, status, is_featured, view_count, created_at, property_images(url, is_cover)")
      .eq("agent_id", session.user.id)
      .order("created_at", { ascending: false });

    setListings((data as any) || []);

    // Load enquiry counts
    const { data: enqs } = await supabase
      .from("property_enquiries")
      .select("property_id")
      .eq("agent_id", session.user.id);
    
    const counts: Record<string, number> = {};
    enqs?.forEach((e: any) => { counts[e.property_id] = (counts[e.property_id] || 0) + 1; });
    setEnquiryCounts(counts);
    setLoading(false);
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "draft" : "active";
    await supabase.from("properties").update({ status: newStatus }).eq("id", id);
    toast({ title: newStatus === "active" ? "Listing published!" : "Listing taken down" });
    loadListings();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("property_images").delete().eq("property_id", deleteId);
    await supabase.from("property_private_notes").delete().eq("property_id", deleteId);
    await supabase.from("agent_files").update({ property_id: null }).eq("property_id", deleteId);
    await supabase.from("properties").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Listing deleted" });
    loadListings();
  };

  const filtered = listings.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (l.title?.toLowerCase().includes(s) || l.address?.toLowerCase().includes(s) || l.property_name?.toLowerCase().includes(s));
    }
    return true;
  });

  const stats = {
    live: listings.filter((l) => l.status === "active").length,
    draft: listings.filter((l) => l.status === "draft").length,
    views: listings.reduce((s, l) => s + (l.view_count || 0), 0),
    enquiries: Object.values(enquiryCounts).reduce((s, c) => s + c, 0),
  };

  const getCover = (l: PropertyListing) => l.property_images?.find((i) => i.is_cover)?.url || l.property_images?.[0]?.url;

  const shareListing = listings.find((l) => l.id === shareId);

  const getRequired = (l: PropertyListing) => {
    const m: string[] = [];
    if (!l.property_images?.length) m.push("Photos");
    if (!l.type) m.push("Type");
    if (!l.district) m.push("District");
    if (!l.size_sqft) m.push("Size");
    return m;
  };

  const tabs = [
    { label: "All", value: "all", count: listings.length },
    { label: "● Live", value: "active", count: stats.live },
    { label: "○ Draft", value: "draft", count: stats.draft },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">My Listings</h1>
          <Button onClick={() => navigate("/portal/agent/listings/new")} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-1" /> New Listing
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <span className="bg-card rounded-xl px-4 py-2 text-sm font-body">● {stats.live} Live</span>
          <span className="bg-card rounded-xl px-4 py-2 text-sm font-body">○ {stats.draft} Draft</span>
          <span className="bg-card rounded-xl px-4 py-2 text-sm font-body">👁 {stats.views.toLocaleString()} views</span>
          <span className="bg-card rounded-xl px-4 py-2 text-sm font-body">📩 {stats.enquiries} enquiries</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`px-4 py-2 text-sm font-body font-medium border-b-2 transition-colors ${statusFilter === t.value ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listings..."
            className="pl-9"
          />
        </div>

        {/* Listings */}
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-12 h-12 text-accent mx-auto mb-3" />
            <p className="font-heading text-lg text-foreground">No listings yet</p>
            <Button onClick={() => navigate("/portal/agent/listings/new")} className="mt-4 bg-accent text-accent-foreground">
              <Plus className="w-4 h-4 mr-1" /> Create First Listing
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((l) => {
              const cover = getCover(l);
              const missing = getRequired(l);
              return (
                <div key={l.id} className="bg-card rounded-xl shadow-sm p-4 flex gap-4">
                  {/* Cover */}
                  <div className="w-[120px] h-[90px] rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {cover ? (
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-accent" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-body text-base font-semibold text-foreground truncate">
                        {l.property_name || l.title}
                      </span>
                      <span className="text-xs font-body bg-accent/10 text-accent px-2 py-0.5 rounded-full">{l.type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-body truncate">
                      {l.address} {l.district ? `· D${String(l.district).padStart(2, "0")} ${districtName[l.district] || ""}` : ""}
                    </p>
                    <p className="text-base font-semibold text-accent mt-1 font-body">
                      {l.price_on_enquiry ? <span className="italic text-muted-foreground text-sm">Price on enquiry</span> : (
                        l.price ? formatSGD(l.price) : l.monthly_rental ? `${formatSGD(l.monthly_rental)}/mo` : "—"
                      )}
                    </p>
                    <div className="flex gap-3 text-xs text-muted-foreground font-body mt-1">
                      {l.size_sqft && <span>{l.size_sqft.toLocaleString()} sqft</span>}
                      {l.bedrooms && <span>{l.bedrooms} bed</span>}
                      {l.bathrooms && <span>{l.bathrooms} bath</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground font-body mt-1">
                      <span>👁 {l.view_count || 0} views</span>
                      <span>📩 {enquiryCounts[l.id] || 0} enquiries</span>
                      <span>📅 {relativeTime(l.created_at)}</span>
                    </div>
                    {l.status === "draft" && missing.length > 0 && (
                      <div className="mt-2 text-xs text-amber-600 font-body">
                        ⚠️ Still needed: {missing.join(", ")}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 items-end min-w-[120px]">
                    <span className={`text-xs font-body font-semibold px-2.5 py-1 rounded-full ${l.status === "active" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {l.status === "active" ? "● Live" : "○ Draft"}
                    </span>
                    <div className="flex gap-1.5 mt-auto">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/portal/agent/listings/${l.id}/edit`)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      {l.status === "active" && l.slug && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/properties/${l.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost"><MoreVertical className="w-3 h-3" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setShareId(l.id)}>
                            <Share2 className="w-3.5 h-3.5 mr-2" /> Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatus(l.id, l.status)}>
                            {l.status === "active" ? "Take Down" : "Publish"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(l.id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing?</DialogTitle>
            <DialogDescription>This action cannot be undone. All photos and data will be permanently removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share modal */}
      <Dialog open={!!shareId} onOpenChange={() => setShareId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Listing</DialogTitle>
          </DialogHeader>
          {shareListing && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">Link</label>
                <div className="flex gap-2">
                  <Input readOnly value={`${window.location.origin}/properties/${shareListing.slug}`} className="text-sm" />
                  <Button size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/properties/${shareListing.slug}`); toast({ title: "✓ Copied!" }); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-body text-muted-foreground mb-1 block">WhatsApp Message</label>
                <div className="bg-muted rounded-lg p-3 text-sm font-body whitespace-pre-line">
                  {`🏠 *${shareListing.property_name || shareListing.title}*\n📍 ${shareListing.address || ""}, D${String(shareListing.district || "").padStart(2, "0")}\n💰 ${shareListing.price ? formatSGD(shareListing.price) : "Price on Enquiry"}\n📐 ${shareListing.size_sqft || "—"} sqft · ${shareListing.bedrooms || "—"} bed · ${shareListing.bathrooms || "—"} bath\n\nView: ${window.location.origin}/properties/${shareListing.slug}`}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                    const msg = `🏠 *${shareListing.property_name || shareListing.title}*\n📍 ${shareListing.address || ""}\n💰 ${shareListing.price ? formatSGD(shareListing.price) : "Price on Enquiry"}\n\nView: ${window.location.origin}/properties/${shareListing.slug}`;
                    navigator.clipboard.writeText(msg);
                    toast({ title: "Message copied!" });
                  }}>Copy Message</Button>
                </div>
              </div>
              <div className="text-center">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/properties/${shareListing.slug}`)}`} alt="QR" className="mx-auto rounded-lg" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
