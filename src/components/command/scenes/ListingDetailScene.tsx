import { useEffect, useState } from "react";
import { useCommand } from "../CommandContext";
import { supabase } from "@/integrations/supabase/client";
import { formatSGD, districtName } from "@/lib/listingHelpers";
import { ArrowLeft, Eye, Bed, Bath, Car, Ruler, MapPin, Calendar, Edit, ExternalLink } from "lucide-react";

export function ListingDetailScene() {
  const { state, dispatch } = useCommand();
  const listingId = state.sceneParams?.listing_id || state.sceneParams?.id;
  const [listing, setListing] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (listingId) loadListing();
  }, [listingId]);

  async function loadListing() {
    setLoading(true);
    const [{ data: prop }, { data: imgs }] = await Promise.all([
      supabase.from("properties").select("*").eq("id", listingId).single(),
      supabase.from("property_images").select("*").eq("property_id", listingId).order("display_order"),
    ]);
    setListing(prop);
    setImages(imgs || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground font-body">Listing not found.</p>
        <button onClick={() => dispatch({ type: "GO_BACK" })} className="text-sm text-gold hover:underline font-body">
          ← Back to Listings
        </button>
      </div>
    );
  }

  const statusColor =
    listing.status === "active" ? "bg-green-100 text-green-700" :
    listing.status === "draft" ? "bg-yellow-100 text-yellow-700" :
    listing.status === "sold" ? "bg-blue-100 text-blue-700" :
    "bg-muted text-muted-foreground";

  const coverImage = images.find((i) => i.is_cover) || images[0];

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button
          onClick={() => dispatch({ type: "GO_BACK" })}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-xl text-navy font-bold truncate">{listing.title}</h2>
          <p className="text-xs text-muted-foreground font-mono truncate">ID: {listing.id}</p>
        </div>
        <span className={`capitalize px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {listing.status}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Cover image */}
        {coverImage && (
          <div className="rounded-lg overflow-hidden h-48 bg-muted">
            <img src={coverImage.url} alt={listing.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Price & key info */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="font-heading text-2xl font-bold text-navy">{formatSGD(listing.price)}</span>
            {listing.price_psf && (
              <span className="text-xs text-muted-foreground font-body">{formatSGD(listing.price_psf)} psf</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm font-body">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span>D{listing.district} {districtName[listing.district] || ""}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              <span>{listing.view_count || 0} views</span>
            </div>
          </div>
        </div>

        {/* Property specs */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-body font-semibold text-foreground text-sm mb-3">Specifications</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm font-body">
            <Spec icon={<Ruler className="w-3.5 h-3.5" />} label="Size" value={listing.size_sqft ? `${Number(listing.size_sqft).toLocaleString()} sqft` : "—"} />
            <Spec icon={<Bed className="w-3.5 h-3.5" />} label="Beds" value={listing.bedrooms ?? "—"} />
            <Spec icon={<Bath className="w-3.5 h-3.5" />} label="Baths" value={listing.bathrooms ?? "—"} />
            <Spec icon={<Car className="w-3.5 h-3.5" />} label="Parking" value={listing.car_parks ?? "—"} />
            <Spec label="Type" value={listing.type || "—"} />
            <Spec label="Tenure" value={listing.tenure || "—"} />
            <Spec label="Furnishing" value={listing.furnishing || "—"} />
            <Spec label="Floor" value={listing.floor_level || "—"} />
            <Spec label="Facing" value={listing.facing || "—"} />
            <Spec label="TOP Year" value={listing.top_year || "—"} />
            <Spec label="Transaction" value={listing.transaction_type || "—"} />
            <Spec label="Approval" value={listing.approval_status || "—"} />
          </div>
        </div>

        {/* Location */}
        {(listing.address || listing.postal_code || listing.mrt_nearest) && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-body font-semibold text-foreground text-sm mb-3">Location</h3>
            <div className="space-y-1.5 text-sm font-body text-muted-foreground">
              {listing.property_name && <p className="text-foreground font-medium">{listing.property_name}</p>}
              {listing.address && <p>{listing.address}{listing.unit_number ? `, #${listing.unit_number}` : ""}</p>}
              {listing.postal_code && <p>Singapore {listing.postal_code}</p>}
              {listing.mrt_nearest && <p>Nearest MRT: {listing.mrt_nearest}{listing.mrt_distance_m ? ` (${listing.mrt_distance_m}m)` : ""}</p>}
              {listing.school_nearest && <p>Nearest School: {listing.school_nearest}</p>}
            </div>
          </div>
        )}

        {/* Description */}
        {listing.description_en && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-body font-semibold text-foreground text-sm mb-2">Description</h3>
            <p className="text-sm text-muted-foreground font-body whitespace-pre-wrap leading-relaxed">
              {listing.description_en}
            </p>
          </div>
        )}

        {/* Additional images */}
        {images.length > 1 && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-body font-semibold text-foreground text-sm mb-3">Photos ({images.length})</h3>
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <div key={img.id} className="rounded-md overflow-hidden h-20 bg-muted">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-body font-semibold text-foreground text-sm mb-3">Details</h3>
          <div className="space-y-1.5 text-xs font-body text-muted-foreground">
            <div className="flex justify-between">
              <span>Created</span>
              <span>{listing.created_at ? new Date(listing.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span>{listing.updated_at ? new Date(listing.updated_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
            </div>
            {listing.availability_date && (
              <div className="flex justify-between">
                <span>Available</span>
                <span>{new Date(listing.availability_date).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Co-broke</span>
              <span>{listing.cobroke_enabled ? `Yes (${listing.cobroke_commission}%)` : "No"}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pb-4">
          <button
            onClick={() => dispatch({ type: "NAVIGATE", scene: "listing_form", params: { listing_id: listing.id } })}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-navy text-cream rounded-lg text-sm font-body font-medium hover:bg-navy/90 transition-colors"
          >
            <Edit className="w-4 h-4" /> Edit Listing
          </button>
          {listing.slug && (
            <button
              onClick={() => window.open(`/properties/${listing.slug}`, "_blank")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-body font-medium hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> View
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Spec({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
