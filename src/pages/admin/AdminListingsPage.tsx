import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatSGD, districtName } from "@/lib/listingHelpers";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Building2, ExternalLink, Search, Eye, Trash2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

export default function AdminListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [enquiryPanel, setEnquiryPanel] = useState<string | null>(null);
  const [enquiries, setEnquiries] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("properties")
      .select("id, title, property_name, type, district, price, monthly_rental, price_on_enquiry, status, is_featured, view_count, slug, created_at, property_images(url, is_cover), agent_profiles!properties_agent_id_fkey(profiles(full_name))")
      .order("created_at", { ascending: false });
    setListings(data || []);
    setLoading(false);
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    await supabase.from("properties").update({ is_featured: !current }).eq("id", id);
    toast({ title: !current ? "Marked as featured" : "Removed from featured" });
    load();
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "draft" : "active";
    await supabase.from("properties").update({ status: newStatus }).eq("id", id);
    toast({ title: newStatus === "active" ? "Published" : "Taken down" });
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("property_images").delete().eq("property_id", deleteId);
    await supabase.from("property_private_notes").delete().eq("property_id", deleteId);
    await supabase.from("properties").delete().eq("id", deleteId);
    setDeleteId(null);
    toast({ title: "Deleted" });
    load();
  };

  const openEnquiries = async (propertyId: string) => {
    setEnquiryPanel(propertyId);
    const { data } = await supabase
      .from("property_enquiries")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });
    setEnquiries(data || []);
  };

  const filtered = listings.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return l.title?.toLowerCase().includes(s) || l.property_name?.toLowerCase().includes(s);
    }
    return true;
  });

  const stats = {
    total: listings.length,
    active: listings.filter((l) => l.status === "active").length,
    draft: listings.filter((l) => l.status === "draft").length,
    featured: listings.filter((l) => l.is_featured).length,
  };

  const getCover = (l: any) => l.property_images?.find((i: any) => i.is_cover)?.url || l.property_images?.[0]?.url;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Listings Management</h1>
        <div className="flex gap-3 text-sm font-body">
          <span>{stats.total} Total</span>
          <span className="text-green-600">{stats.active} Active</span>
          <span className="text-muted-foreground">{stats.draft} Draft</span>
          <span className="text-accent">{stats.featured} Featured</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
        </div>
        <div className="flex gap-1">
          {["all", "active", "draft"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-body capitalize ${statusFilter === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="bg-card rounded-xl overflow-hidden">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Property</th>
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Price</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Featured</th>
                <th className="text-center px-4 py-3 font-medium">Views</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {getCover(l) ? <img src={getCover(l)} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-4 h-4 m-auto text-muted-foreground mt-2" />}
                      </div>
                      <span className="font-medium truncate max-w-[200px]">{l.property_name || l.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{(l as any).agent_profiles?.profiles?.full_name || "—"}</td>
                  <td className="px-4 py-3"><span className="bg-accent/10 text-accent px-2 py-0.5 rounded-full text-xs">{l.type}</span></td>
                  <td className="px-4 py-3">
                    {l.price_on_enquiry ? <span className="italic text-muted-foreground text-xs">POA</span> : l.price ? formatSGD(l.price) : l.monthly_rental ? `${formatSGD(l.monthly_rental)}/mo` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${l.status === "active" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {l.status === "active" ? "● Live" : "○ Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={l.is_featured} onCheckedChange={() => toggleFeatured(l.id, l.is_featured)} />
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{l.view_count || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {l.slug && (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/properties/${l.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(l.id, l.status)}>
                        {l.status === "active" ? "Take Down" : "Publish"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(l.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground font-body">No listings found</div>
          )}
        </div>
      )}

      {/* Delete modal */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing?</DialogTitle>
            <DialogDescription>Permanently remove this listing.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
