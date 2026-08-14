import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatSGD } from "@/lib/listingHelpers";
import { setListingFeatured, setListingStatus } from "@/components/admin/adminOperations";
import { buildListingCopilotContext, generateListingDraft, type ListingCopilotDraft } from "@/lib/listingCopilot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, ExternalLink, Search, Sparkles, Layers3 } from "lucide-react";

type ListingRow = {
  id: string;
  title: string;
  title_zh: string | null;
  property_name: string | null;
  type: string;
  district: number | null;
  price: number | null;
  monthly_rental: number | null;
  price_on_enquiry: boolean | null;
  status: "active" | "draft" | string;
  is_featured: boolean | null;
  view_count: number | null;
  slug: string | null;
  created_at: string;
  agent_profiles?: {
    profiles?: { full_name: string | null } | null;
  } | null;
  property_images?: Array<{
    url: string | null;
    is_cover: boolean | null;
  }> | null;
};

type StatusFilter = "all" | "active" | "draft";

export default function AdminListingsPage() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotDraft, setCopilotDraft] = useState<ListingCopilotDraft | null>(null);
  const [copilotNotes, setCopilotNotes] = useState("");
  const [copilotGenerating, setCopilotGenerating] = useState(false);
  const [copilotToken, setCopilotToken] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, title_zh, property_name, type, district, price, monthly_rental, price_on_enquiry, status, is_featured, view_count, slug, created_at, agent_profiles!properties_agent_id_fkey(profiles(full_name)), property_images(url, is_cover)")
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        toast({ title: "Error loading listings", description: error.message, variant: "destructive" });
      } else {
        setListings((data ?? []) as ListingRow[]);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setCopilotToken(session?.access_token ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => ({
    total: listings.length,
    active: listings.filter((item) => item.status === "active").length,
    draft: listings.filter((item) => item.status === "draft").length,
    featured: listings.filter((item) => item.is_featured).length,
  }), [listings]);

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      if (statusFilter !== "all" && listing.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const haystack = [
        listing.title,
        listing.property_name,
        listing.type,
        listing.slug,
        listing.agent_profiles?.profiles?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [listings, search, statusFilter]);

  function getCover(listing: ListingRow) {
    return listing.property_images?.find((image) => image.is_cover)?.url ?? listing.property_images?.[0]?.url ?? null;
  }

  async function handleFeature(listing: ListingRow, value: boolean) {
    setSaving(listing.id);
    const result = await setListingFeatured(listing.id, value);
    setSaving(null);
    if (result.error) {
      toast({ title: "Could not update listing", description: result.error, variant: "destructive" });
      return;
    }
    setListings((prev) => prev.map((item) => (item.id === listing.id ? { ...item, is_featured: value } : item)));
    toast({ title: value ? "Listing marked featured" : "Listing unfeatured" });
  }

  async function handleStatus(listing: ListingRow) {
    const nextStatus = listing.status === "active" ? "draft" : "active";
    setSaving(listing.id);
    const result = await setListingStatus(listing.id, nextStatus);
    setSaving(null);
    if (result.error) {
      toast({ title: "Could not update listing", description: result.error, variant: "destructive" });
      return;
    }
    setListings((prev) => prev.map((item) => (item.id === listing.id ? { ...item, status: nextStatus } : item)));
    toast({ title: nextStatus === "active" ? "Listing published" : "Listing moved to draft" });
  }

  async function generateCopilotDraft() {
    const prompt = copilotPrompt.trim();
    if (!prompt) {
      toast({ title: "Add a brief first", description: "Paste the listing notes or property brief before generating a draft.", variant: "destructive" });
      return;
    }

    if (!copilotToken) {
      toast({ title: "Copilot not ready", description: "Please sign in again and try once the session is restored.", variant: "destructive" });
      return;
    }

    setCopilotGenerating(true);
    const context = buildListingCopilotContext(
      listings.map((item) => ({
        id: item.id,
        title: item.title,
        title_zh: item.title_zh,
        status: item.status,
        is_featured: item.is_featured,
        view_count: item.view_count,
        price: item.price,
        monthly_rental: item.monthly_rental,
        price_on_enquiry: item.price_on_enquiry,
        property_name: item.property_name,
        type: item.type,
        district: item.district,
        agent_name: item.agent_profiles?.profiles?.full_name ?? null,
      }))
    );

    const { data, error, rawText } = await generateListingDraft({
      prompt,
      authToken: copilotToken,
      context,
    });
    setCopilotGenerating(false);

    if (error || !data) {
      toast({
        title: "Copilot draft failed",
        description: error || rawText || "The copilot could not build a draft from that brief.",
        variant: "destructive",
      });
      return;
    }

    setCopilotDraft(data);
    setCopilotNotes(data.sourceNotes);
    toast({ title: "Copilot draft ready", description: "Review the draft, then apply it to the admin listing form for the final approval step." });
  }

  function applyCopilotDraft() {
    if (!copilotDraft) return;
    window.sessionStorage.setItem("aria_prefill", JSON.stringify(copilotDraft.prefill));
    navigate("/admin/listings/new?admin=1");
    toast({ title: "Draft applied", description: "The admin listing form is now prefilled. Review it, then save or publish." });
  }

  function clearCopilotDraft() {
    setCopilotPrompt("");
    setCopilotDraft(null);
    setCopilotNotes("");
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Listing control</Badge>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Listings</h1>
          <p className="mt-2 max-w-2xl font-body text-muted-foreground">
            Manage what is visible publicly, what is featured, and which listings still need review before going live.
          </p>
        </div>

        <Button asChild className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
          <Link to="/admin/listings/new">
            <Sparkles className="mr-2 h-4 w-4" />
            Create Listing
          </Link>
        </Button>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="font-heading text-xl">Copilot draft</CardTitle>
              <CardDescription className="font-body">
                Paste a property brief, let the copilot draft the listing, then apply it to the shared create form for final approval.
              </CardDescription>
            </div>
            <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Phase 2 of 4</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <Label htmlFor="listing-copilot-brief">Admin brief</Label>
              <Textarea
                id="listing-copilot-brief"
                value={copilotPrompt}
                onChange={(e) => setCopilotPrompt(e.target.value)}
                rows={9}
                placeholder="Paste the property details, listing notes, suggested price, photos, or owner notes here."
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void generateCopilotDraft()} disabled={copilotGenerating} className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {copilotGenerating ? "Drafting..." : "Generate draft"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/admin/listings/new?admin=1")}>
                  <Layers3 className="mr-2 h-4 w-4" />
                  Open create form
                </Button>
                <Button variant="ghost" onClick={clearCopilotDraft}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 space-y-3">
              <p className="font-body text-sm font-semibold text-foreground">Approval steps</p>
              <ol className="space-y-2 text-sm font-body text-muted-foreground">
                <li>1. Generate a draft from your brief.</li>
                <li>2. Review the preview and apply it to the shared admin listing form.</li>
                <li>3. Save as draft or publish from the listing form itself.</li>
              </ol>
              {copilotDraft && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
                  <p className="font-body text-xs uppercase tracking-wide text-gold">Draft ready</p>
                  <p className="mt-1 font-body text-sm font-semibold text-foreground">
                    {String(copilotDraft.prefill.title ?? copilotDraft.prefill.property_name ?? "Untitled listing")}
                  </p>
                  {copilotNotes && <p className="mt-2 whitespace-pre-wrap font-body text-sm text-muted-foreground">{copilotNotes}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={applyCopilotDraft} className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
                      Apply to form
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setCopilotDraft(null); setCopilotNotes(""); }}>
                      Discard
                    </Button>
                  </div>
                </div>
              )}
              {!copilotDraft && (
                <p className="font-body text-sm text-muted-foreground">
                  The draft preview will appear here after generation.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Draft" value={stats.draft} />
        <StatCard label="Featured" value={stats.featured} />
      </div>

      <Card className="border-border/70">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-heading text-xl">Listing list</CardTitle>
              <CardDescription className="font-body">
                Filter by status and search by title, slug, or agent name.
              </CardDescription>
            </div>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search listings"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "active", "draft"] as StatusFilter[]).map((item) => (
              <button
                key={item}
                onClick={() => setStatusFilter(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-body font-medium capitalize transition-colors ${
                  statusFilter === item ? "bg-gold text-primary" : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)
          ) : filteredListings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
              <p className="font-body text-sm text-muted-foreground">No listings match the current filters.</p>
            </div>
          ) : (
            filteredListings.map((listing) => (
              <div key={listing.id} className="grid gap-4 rounded-2xl border border-border/70 p-4 xl:grid-cols-[1.2fr_1fr_auto] xl:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {getCover(listing) ? (
                      <img src={getCover(listing) ?? undefined} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body font-semibold text-foreground">{listing.property_name || listing.title}</p>
                      <Badge variant="outline" className="font-body capitalize">
                        {listing.status}
                      </Badge>
                    </div>
                    <p className="font-body text-sm text-muted-foreground">
                      {listing.agent_profiles?.profiles?.full_name ?? "No agent"} · {listing.type}
                    </p>
                    <p className="font-body text-sm text-muted-foreground">
                      {listing.price_on_enquiry ? "Price on enquiry" : listing.price ? formatSGD(listing.price) : listing.monthly_rental ? `${formatSGD(listing.monthly_rental)}/mo` : "No price set"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoTile label="Views" value={`${listing.view_count ?? 0}`} />
                  <InfoTile label="District" value={listing.district ? `D${String(listing.district).padStart(2, "0")}` : "—"} />
                  <InfoTile label="Slug" value={listing.slug ?? "—"} />
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  {listing.slug && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={`/properties/${listing.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <div className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5">
                    <span className="font-body text-xs text-muted-foreground">Featured</span>
                    <Switch
                      checked={!!listing.is_featured}
                      onCheckedChange={(val) => void handleFeature(listing, val)}
                      disabled={saving === listing.id}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => void handleStatus(listing)}
                    disabled={saving === listing.id}
                  >
                    {listing.status === "active" ? "Take down" : "Publish"}
                  </Button>
                </div>
              </div>
            ))
          )}
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

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 p-3">
      <p className="font-body text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-body text-sm text-foreground break-words">{value}</p>
    </div>
  );
}
