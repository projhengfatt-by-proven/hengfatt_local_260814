import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bed, Maximize, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatSGD } from "@/lib/listingHelpers";
import { Skeleton } from "@/components/ui/skeleton";

interface FeaturedListing {
  id: string;
  title: string;
  property_name: string | null;
  type: string;
  district: number | null;
  price: number;
  price_on_enquiry: boolean;
  size_sqft: number | null;
  bedrooms: number | null;
  slug: string | null;
  is_featured: boolean;
  property_images: { url: string; is_cover: boolean }[];
}

export function FeaturedListings() {
  const [listings, setListings] = useState<FeaturedListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("properties")
        .select("id, title, property_name, type, district, price, price_on_enquiry, size_sqft, bedrooms, slug, is_featured, property_images(url, is_cover)")
        .eq("status", "active")
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(4);

      setListings((data as any) || []);
      setLoading(false);
    };
    load();
  }, []);

  const getCover = (l: FeaturedListing) =>
    l.property_images?.find((i) => i.is_cover)?.url || l.property_images?.[0]?.url;

  if (!loading && listings.length === 0) return null;

  return (
    <section className="py-20 bg-background">
      <div className="container">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
              Featured Properties
            </h2>
            <p className="font-body text-muted-foreground mt-2">
              Hand-picked by our specialists
            </p>
          </div>
          <Link
            to="/listings"
            className="hidden md:inline-flex font-body text-sm font-medium text-gold hover:text-gold-dark transition-colors"
          >
            View All Listings →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-72 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {listings.map((listing) => {
              const cover = getCover(listing);
              return (
                <Link
                  key={listing.id}
                  to={`/properties/${listing.slug}`}
                  className="group bg-card rounded-lg overflow-hidden shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {cover ? (
                      <img
                        src={cover}
                        alt={listing.property_name || listing.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <MapPin className="w-8 h-8 text-accent" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bg-gold text-primary text-xs font-body font-semibold px-2.5 py-1 rounded-full">
                      FEATURED
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin size={12} className="text-gold" />
                      <span className="text-xs font-body text-muted-foreground">
                        {listing.district ? `District ${listing.district}` : "Singapore"}
                      </span>
                    </div>
                    {(listing.price_on_enquiry || listing.price > 0) && (
                      <p className="font-heading text-xl font-bold text-gold mb-1">
                        {listing.price_on_enquiry ? "Price on Enquiry" : formatSGD(listing.price)}
                      </p>
                    )}
                    <h3 className="font-body text-sm font-semibold text-foreground mb-2 line-clamp-1">
                      {listing.property_name || listing.title}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-body">
                      {listing.bedrooms && (
                        <span className="flex items-center gap-1">
                          <Bed size={13} /> {listing.bedrooms} Bed
                        </span>
                      )}
                      {listing.size_sqft && (
                        <span className="flex items-center gap-1">
                          <Maximize size={13} /> {listing.size_sqft.toLocaleString()} sqft
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="md:hidden text-center mt-8">
          <Link
            to="/listings"
            className="font-body text-sm font-medium text-gold hover:text-gold-dark transition-colors"
          >
            View All Listings →
          </Link>
        </div>
      </div>
    </section>
  );
}
