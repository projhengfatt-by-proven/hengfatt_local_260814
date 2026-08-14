import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatSGD, calcPSF, districtName, waLink, trackView } from "@/lib/listingHelpers";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Bed, Bath, Car, Maximize, ChevronRight, ChevronLeft,
  Phone, Mail, MessageCircle, X, Home,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function PropertyDetailPage() {
  const { slug } = useParams();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [mainImage, setMainImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [similar, setSimilar] = useState<any[]>([]);
  const [enquiry, setEnquiry] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (slug) loadProperty();
  }, [slug]);

  const loadProperty = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("properties")
      .select(`
        *,
        property_images(id, url, is_cover, display_order),
        property_floor_plans(url, label, display_order),
        agent_profiles!properties_agent_id_fkey(slug, cea_no, position, bio_en, profiles(full_name, avatar_url, phone, email))
      `)
      .eq("slug", slug)
      .eq("status", "active")
      .single();

    if (data) {
      setProperty(data);
      setEnquiry((e) => ({ ...e, message: `Hi, I'm interested in ${data.property_name || data.title}. Could you share more details?` }));
      trackView(data.id, supabase);

      // Load similar
      const { data: sim } = await supabase
        .from("properties")
        .select("id, title, property_name, slug, price, monthly_rental, price_on_enquiry, type, district, size_sqft, bedrooms, property_images(url, is_cover)")
        .eq("status", "active")
        .eq("type", data.type)
        .neq("id", data.id)
        .limit(3);
      setSimilar(sim || []);
    }
    setLoading(false);
  };

  const handleEnquiry = async () => {
    if (!enquiry.name || !enquiry.email || !property) return;
    setSending(true);
    await supabase.from("property_enquiries").insert({
      property_id: property.id,
      agent_id: property.agent_id,
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone,
      message: enquiry.message,
    });
    setSending(false);
    setSent(true);
    toast({ title: "Enquiry sent! Agent will contact you shortly." });
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Skeleton className="h-[480px] rounded-xl mb-6" />
      <Skeleton className="h-8 w-64 mb-4" />
      <Skeleton className="h-48" />
    </div>
  );

  if (!property) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">Property Not Found</h1>
        <Link to="/properties" className="text-accent font-body mt-2 inline-block">← Back to listings</Link>
      </div>
    </div>
  );

  const images = (property.property_images || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
  const floorPlans = (property.property_floor_plans || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
  const agent = property.agent_profiles?.profiles;
  const agentProfile = property.agent_profiles;
  const price = property.price || property.monthly_rental;
  const psf = property.price && property.size_sqft ? calcPSF(property.price, property.size_sqft) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-2">
        <nav className="flex items-center gap-1 text-sm font-body text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link to="/properties" className="hover:text-foreground">Properties</Link>
          <ChevronRight className="w-3 h-3" />
          {property.district && (
            <>
              <span>D{String(property.district).padStart(2, "0")} {districtName[property.district]}</span>
              <ChevronRight className="w-3 h-3" />
            </>
          )}
          <span className="text-foreground truncate max-w-[200px]">{property.property_name || property.title}</span>
        </nav>
      </div>

      {/* Gallery */}
      <div className="max-w-6xl mx-auto px-4">
        {images.length > 0 ? (
          <div>
            <div className="relative rounded-xl overflow-hidden h-[480px] cursor-pointer" onClick={() => setLightbox(true)}>
              <img src={images[mainImage]?.url} alt="" className="w-full h-full object-cover" />
              {property.virtual_tour_url && (
                <a href={property.virtual_tour_url} target="_blank" rel="noreferrer"
                  className="absolute bottom-4 right-4 bg-card/90 backdrop-blur px-4 py-2 rounded-lg text-sm font-body font-semibold text-foreground hover:bg-card">
                  🎬 Virtual Tour
                </a>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                {images.map((img: any, i: number) => (
                  <button key={img.id} onClick={() => setMainImage(i)}
                    className={`w-20 h-15 rounded-lg overflow-hidden flex-shrink-0 border-2 ${i === mainImage ? "border-accent" : "border-transparent"}`}>
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="h-[300px] bg-muted rounded-xl flex items-center justify-center">
            <Home className="w-16 h-16 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Left */}
        <div className="flex-1">
          <h1 className="font-heading text-3xl font-bold text-foreground">{property.property_name || property.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <MapPin className="w-4 h-4 text-accent" />
            <span className="text-sm font-body text-muted-foreground">
              {property.address} {property.district ? `· D${String(property.district).padStart(2, "0")} ${districtName[property.district] || ""}` : ""}
            </span>
          </div>

          {property.price_on_enquiry ? (
            <p className="text-xl italic text-accent font-body mt-3">Price on Enquiry</p>
          ) : (
            <div className="mt-3">
              <p className="font-heading text-2xl font-bold text-accent">
                {price ? formatSGD(price) : "—"}
                {property.monthly_rental ? <span className="text-base font-normal">/mo</span> : ""}
              </p>
              {psf > 0 && <p className="text-sm text-muted-foreground font-body">${psf.toLocaleString()} psf · {property.tenure || ""}</p>}
            </div>
          )}

          {/* Key stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { icon: Maximize, label: `${property.size_sqft?.toLocaleString() || "—"} sqft` },
              { icon: Bed, label: `${property.bedrooms || "—"} Bed` },
              { icon: Bath, label: `${property.bathrooms || "—"} Bath` },
              { icon: Car, label: `${property.car_parks || "—"} Park` },
            ].map((s, i) => (
              <div key={i} className="bg-card rounded-xl p-4 text-center border border-border">
                <s.icon className="w-5 h-5 mx-auto text-accent mb-1" />
                <span className="text-sm font-body font-semibold">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 border-b border-border">
            {["overview", "specifications", "location", ...(floorPlans.length > 0 ? ["floor-plans"] : [])].map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-body font-medium border-b-2 capitalize ${activeTab === t ? "border-accent text-accent" : "border-transparent text-muted-foreground"}`}>
                {t.replace("-", " ")}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {activeTab === "overview" && (
              <div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {property.furnishing && <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-body">{property.furnishing}</span>}
                  {property.facing && <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-body">{property.facing}</span>}
                  {property.tenure && <span className="text-xs bg-accent/10 text-accent px-2.5 py-1 rounded-full font-body">{property.tenure}</span>}
                </div>
                <p className="font-body text-foreground leading-relaxed whitespace-pre-line">{property.description_en || "No description provided."}</p>
              </div>
            )}

            {activeTab === "specifications" && (
              <div className="bg-card rounded-xl p-5">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ["Type", property.type],
                    ["Tenure", property.tenure],
                    ["TOP Year", property.top_year],
                    ["Size", property.size_sqft ? `${property.size_sqft.toLocaleString()} sqft` : "—"],
                    ["Floor", property.floor_level],
                    ["Facing", property.facing],
                    ["Furnishing", property.furnishing],
                    ["Bedrooms", property.bedrooms],
                    ["Bathrooms", property.bathrooms],
                    ["Car Parks", property.car_parks],
                    ["MRT", property.mrt_nearest],
                    ["MRT Distance", property.mrt_distance_m ? `${property.mrt_distance_m}m` : "—"],
                    ["District", property.district ? `D${property.district}` : "—"],
                    ["Postal Code", property.postal_code],
                  ].map(([l, v], i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground font-body">{l}</span>
                      <span className="text-sm font-body font-medium">{v || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "location" && property.postal_code && (
              <iframe
                src={`https://maps.google.com/maps?q=${property.postal_code}+Singapore&output=embed`}
                className="w-full h-[350px] rounded-xl border-0"
                loading="lazy"
                allowFullScreen
              />
            )}

            {activeTab === "floor-plans" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {floorPlans.map((fp: any, i: number) => (
                  <div key={i} className="cursor-pointer" onClick={() => { setMainImage(0); setLightbox(true); }}>
                    <img src={fp.url} alt={fp.label} className="w-full rounded-lg" />
                    {fp.label && <p className="text-sm font-body text-muted-foreground mt-1">{fp.label}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-[320px] flex-shrink-0">
          <div className="lg:sticky lg:top-24 space-y-4">
            {/* Agent card */}
            {agent && (
              <div className="bg-card rounded-xl shadow-md p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-muted overflow-hidden">
                    {agent.avatar_url ? (
                      <img src={agent.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-heading text-accent font-bold">
                        {agent.full_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-body font-semibold text-foreground">{agent.full_name}</p>
                    {agentProfile?.position && <p className="text-sm text-accent font-body">{agentProfile.position}</p>}
                    {agentProfile?.cea_no && <p className="text-xs text-muted-foreground font-body">CEA: {agentProfile.cea_no}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  {agent.phone && (
                    <a href={waLink(agent.phone, `Hi ${agent.full_name}, I'm interested in ${property.property_name || property.title}`)}
                      target="_blank" rel="noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-body font-semibold transition-colors">
                      <MessageCircle className="w-4 h-4" /> WhatsApp Agent
                    </a>
                  )}
                  {agent.phone && (
                    <a href={`tel:+65${agent.phone}`} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-body font-semibold">
                      <Phone className="w-4 h-4" /> Call
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Enquiry form */}
            <div className="bg-card rounded-xl shadow-md p-5">
              {sent ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-green-600 text-xl">✓</span>
                  </div>
                  <p className="font-body font-semibold text-foreground">Enquiry sent!</p>
                  <p className="text-sm text-muted-foreground font-body mt-1">Agent will contact you shortly.</p>
                </div>
              ) : (
                <>
                  <h3 className="font-body font-semibold text-foreground mb-3">📩 Request Viewing / More Info</h3>
                  <div className="space-y-3">
                    <Input placeholder="Your name *" value={enquiry.name} onChange={(e) => setEnquiry((p) => ({ ...p, name: e.target.value }))} />
                    <Input placeholder="Email *" type="email" value={enquiry.email} onChange={(e) => setEnquiry((p) => ({ ...p, email: e.target.value }))} />
                    <div className="flex gap-1">
                      <span className="flex items-center px-3 bg-muted rounded-l-md text-sm font-body text-muted-foreground border border-r-0 border-input">+65</span>
                      <Input placeholder="Phone" value={enquiry.phone} onChange={(e) => setEnquiry((p) => ({ ...p, phone: e.target.value }))} className="rounded-l-none" />
                    </div>
                    <Textarea rows={4} value={enquiry.message} onChange={(e) => setEnquiry((p) => ({ ...p, message: e.target.value }))} />
                    <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleEnquiry} disabled={sending || !enquiry.name || !enquiry.email}>
                      Send Enquiry
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Similar */}
      {similar.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-12">
          <h2 className="font-heading text-xl font-bold text-foreground mb-4">You May Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {similar.map((s: any) => {
              const cover = s.property_images?.find((i: any) => i.is_cover)?.url || s.property_images?.[0]?.url;
              return (
                <Link key={s.id} to={`/properties/${s.slug}`} className="bg-card rounded-xl shadow-sm overflow-hidden hover:shadow-elevated transition-all group">
                  <div className="aspect-[4/3] overflow-hidden">
                    {cover ? <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full bg-muted" />}
                  </div>
                  <div className="p-4">
                    <p className="font-body text-sm font-semibold text-foreground line-clamp-1">{s.property_name || s.title}</p>
                    <p className="text-sm text-accent font-body font-semibold mt-1">
                      {s.price_on_enquiry ? "Price on Enquiry" : s.price ? formatSGD(s.price) : s.monthly_rental ? `${formatSGD(s.monthly_rental)}/mo` : "—"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Lightbox */}
      <Dialog open={lightbox} onOpenChange={setLightbox}>
        <DialogContent className="max-w-5xl p-0 bg-black/95">
          <div className="relative">
            {images[mainImage] && <img src={images[mainImage].url} alt="" className="w-full max-h-[90vh] object-contain" />}
            <button onClick={() => setMainImage((p) => (p > 0 ? p - 1 : images.length - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-2">
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <button onClick={() => setMainImage((p) => (p < images.length - 1 ? p + 1 : 0))}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 rounded-full p-2">
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
