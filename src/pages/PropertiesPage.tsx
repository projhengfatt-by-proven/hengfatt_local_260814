import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatSGD, calcPSF, districtName, districtOptions, trackView } from "@/lib/listingHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, Bed, Maximize, ChevronDown, ChevronUp } from "lucide-react";

interface Listing {
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
  tenure: string | null;
  slug: string | null;
  is_featured: boolean;
  view_count: number | null;
  created_at: string;
  description_en: string | null;
  property_images: { url: string; is_cover: boolean; display_order: number }[];
  agent_profiles: { id: string; profiles: { full_name: string; avatar_url: string | null; phone: string | null } | null } | null;
}

export default function PropertiesPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [txFilter, setTxFilter] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 12;

  useEffect(() => { loadListings(true); }, [typeFilter, txFilter]);

  const loadListings = async (reset = false) => {
    const newOffset = reset ? 0 : offset;
    setLoading(true);

    let query = supabase
      .from("properties")
      .select(`
        id, title, property_name, type, transaction_type,
        district, address, price, monthly_rental, price_on_enquiry,
        size_sqft, bedrooms, bathrooms, tenure, slug,
        is_featured, view_count, created_at, description_en,
        property_images(url, is_cover, display_order),
        agent_profiles!properties_agent_id_fkey(id, profiles(full_name, avatar_url, phone))
      `)
      .eq("status", "active")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .range(newOffset, newOffset + pageSize - 1);

    if (typeFilter) query = query.eq("type", typeFilter as any);
    if (txFilter) query = query.eq("transaction_type", txFilter as any);

    const { data } = await query;
    const items = (data as any) || [];
    
    if (reset) {
      setListings(items);
      setOffset(pageSize);
    } else {
      setListings((prev) => [...prev, ...items]);
      setOffset(newOffset + pageSize);
    }
    setHasMore(items.length === pageSize);
    setLoading(false);
  };

  const getCover = (l: Listing) => {
    const cover = l.property_images?.find((i) => i.is_cover);
    return cover?.url || l.property_images?.sort((a, b) => a.display_order - b.display_order)?.[0]?.url;
  };

  const filtered = search
    ? listings.filter((l) => {
        const s = search.toLowerCase();
        return (
          l.title?.toLowerCase().includes(s) ||
          l.property_name?.toLowerCase().includes(s) ||
          l.address?.toLowerCase().includes(s) ||
          (l.district && districtName[l.district]?.toLowerCase().includes(s))
        );
      })
    : listings;

  const featured = filtered.filter((l) => l.is_featured);
  const allListings = filtered;

  const quickFilters = [
    { label: "All", value: "" },
    { label: "For Sale", value: "sale", type: "tx" },
    { label: "For Rent", value: "rent", type: "tx" },
    { label: "HDB", value: "HDB" },
    { label: "Condo", value: "Condo" },
    { label: "Landed", value: "Landed" },
    { label: "Commercial", value: "Commercial" },
    { label: "Shophouse", value: "Conservation Shophouse" },
    { label: "New Launch", value: "New Launch" },
  ];

  const PropertyCard = ({ listing }: { listing: Listing }) => {
    const cover = getCover(listing);
    const price = listing.price || listing.monthly_rental;
    const psf = listing.price && listing.size_sqft ? calcPSF(listing.price, listing.size_sqft) : 0;

    return (
      <Link
        to={`/properties/${listing.slug}`}
        className="bg-card rounded-xl shadow-sm overflow-hidden flex hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-300 group"
      >
        {/* Image */}
        <div className="w-[280px] flex-shrink-0 relative overflow-hidden">
          {cover ? (
            <img src={cover} alt={listing.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center min-h-[200px]">
              <MapPin className="w-8 h-8 text-accent" />
            </div>
          )}
          <span className="absolute top-3 left-3 bg-accent text-accent-foreground text-xs font-body font-semibold px-2.5 py-1 rounded-full">
            {listing.type}
          </span>
        </div>

        {/* Info */}
        <div className="p-5 flex flex-col justify-between flex-1">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin size={12} className="text-accent" />
              <span className="text-xs font-body text-muted-foreground">
                {listing.address ? `${listing.address} · ` : ""}
                {listing.district ? `D${String(listing.district).padStart(2, "0")} ${districtName[listing.district] || ""}` : ""}
              </span>
            </div>
            <h3 className="font-heading text-xl font-bold text-foreground mb-1 line-clamp-2">
              {listing.property_name || listing.title}
            </h3>
            {listing.price_on_enquiry ? (
              <p className="text-sm italic text-accent font-body">Price on Enquiry</p>
            ) : (
              <div>
                <p className="font-heading text-lg font-bold text-accent">
                  {price ? formatSGD(price) : "—"}
                  {listing.monthly_rental ? <span className="text-sm font-normal">/mo</span> : ""}
                </p>
                {psf > 0 && <p className="text-xs text-muted-foreground font-body">(${psf.toLocaleString()} psf)</p>}
              </div>
            )}
            <p className="text-xs text-muted-foreground font-body mt-1">
              {listing.size_sqft ? `${listing.size_sqft.toLocaleString()} sqft` : ""}
              {listing.tenure ? ` · ${listing.tenure}` : ""}
            </p>
            {listing.description_en && (
              <p className="text-sm text-muted-foreground font-body mt-2 line-clamp-3">{listing.description_en}</p>
            )}
          </div>
          <div className="border-t border-border pt-3 mt-3 flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-body">
              {listing.agent_profiles?.profiles?.full_name ? `Agent: ${listing.agent_profiles.profiles.full_name}` : ""}
            </span>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs">
              Enquire Privately
            </Button>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <section className="bg-primary py-12 text-center">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground">Property Listings</h1>
        <p className="font-body text-primary-foreground/70 mt-2">Curated properties across Singapore</p>
      </section>

      {/* Search */}
      <div className="bg-secondary sticky top-16 md:top-20 z-30 shadow-sm px-4 md:px-8 py-4">
        <div className="max-w-5xl mx-auto flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by area, MRT, property name..."
              className="pl-9 h-12 rounded-full"
            />
          </div>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90 h-12 px-6 rounded-full">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick filters */}
        <div className="max-w-5xl mx-auto mt-3 flex gap-2 overflow-x-auto pb-1">
          {quickFilters.map((f) => (
            <button
              key={f.label}
              onClick={() => {
                if (f.type === "tx") { setTxFilter(txFilter === f.value ? "" : f.value); setTypeFilter(""); }
                else { setTypeFilter(typeFilter === f.value ? "" : f.value); setTxFilter(""); }
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-body font-medium whitespace-nowrap transition-colors ${
                (typeFilter === f.value || txFilter === f.value || (!typeFilter && !txFilter && f.value === ""))
                  ? "bg-accent text-accent-foreground"
                  : "bg-card text-foreground border border-border hover:border-accent/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Featured */}
        {featured.length > 0 && (
          <section className="mb-10">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-xs font-body text-accent uppercase tracking-wider font-semibold">Curated Selection</p>
                <h2 className="font-heading text-2xl font-bold text-foreground">Featured Properties</h2>
              </div>
            </div>
            <div className="space-y-4">
              {featured.map((l) => <PropertyCard key={l.id} listing={l} />)}
            </div>
          </section>
        )}

        {/* All */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-body text-accent uppercase tracking-wider font-semibold">All Listings</p>
              <p className="text-sm text-muted-foreground font-body">{filtered.length} properties available</p>
            </div>
          </div>

          {loading && listings.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          ) : allListings.length === 0 ? (
            <div className="text-center py-20">
              <MapPin className="w-12 h-12 text-accent mx-auto mb-3" />
              <p className="font-heading text-lg text-foreground">No properties found</p>
              <p className="text-sm text-muted-foreground font-body mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allListings.map((l) => <PropertyCard key={l.id} listing={l} />)}
            </div>
          )}

          {hasMore && !loading && (
            <div className="text-center mt-8">
              <Button variant="outline" onClick={() => loadListings(false)}>Load More Properties</Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
