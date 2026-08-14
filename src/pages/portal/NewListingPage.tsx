import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { districtOptions, propertyTypes, formatSGD, calcPSF } from "@/lib/listingHelpers";
import {
  ArrowLeft, Check, ChevronRight, Camera, X, Eye, Star, Upload,
  Plus, Minus, Loader2,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PhotoItem {
  file?: File;
  url: string;
  is_cover: boolean;
  preview?: string;
}

interface OwnerAgent {
  id: string;
  agent_type: string | null;
  is_published: boolean | null;
  display_order: number | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    is_active: boolean | null;
  } | null;
}

const defaultForm = {
  transaction_type: "sale",
  property_type: "",
  property_name: "",
  unit_number: "",
  address: "",
  postal_code: "",
  district: "",
  mrt_nearest: "",
  mrt_distance_m: "",
  title: "",
  title_zh: "",
  size_sqft: "",
  floor_level: "",
  total_units: "",
  bedrooms: 0,
  bathrooms: 0,
  car_parks: 0,
  tenure: "",
  top_year: "",
  facing: "",
  furnishing: "",
  availability_date: "",
  price: "",
  monthly_rental: "",
  price_on_enquiry: false,
  description_en: "",
  description_zh: "",
  virtual_tour_url: "",
  cobroke_enabled: false,
  cobroke_commission: "",
  owner_bottom_price: "",
  reason_for_selling: "",
  owner_urgency: "",
  private_notes: "",
};

export default function NewListingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ ...defaultForm });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [floorPlans, setFloorPlans] = useState<{ file?: File; url: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [prefillFolder, setPrefillFolder] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const [ownerAgents, setOwnerAgents] = useState<OwnerAgent[]>([]);
  const [ownerId, setOwnerId] = useState(searchParams.get("owner_id") ?? "");
  const [loadingOwners, setLoadingOwners] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const floorRef = useRef<HTMLInputElement>(null);
  const isAdminMode = location.pathname.startsWith("/admin") || searchParams.get("admin") === "1";

  useEffect(() => {
    const raw = sessionStorage.getItem("aria_prefill");
    const folder = sessionStorage.getItem("aria_folder");
    if (raw) {
      try {
        const data = JSON.parse(raw);
        setFormData((prev) => ({ ...prev, ...data }));
        if (folder) setPrefillFolder(folder);
        sessionStorage.removeItem("aria_prefill");
        sessionStorage.removeItem("aria_folder");
        toast({ title: "ARIA has pre-filled the form. Review and publish when ready." });
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!isAdminMode) return;

    let mounted = true;
    (async () => {
      setLoadingOwners(true);
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("id, agent_type, is_published, display_order, profiles(full_name, email, is_active)")
        .order("display_order", { ascending: true });

      if (!mounted) return;

      if (error) {
        toast({ title: "Could not load agent owners", description: error.message, variant: "destructive" });
      } else {
        setOwnerAgents((data ?? []) as OwnerAgent[]);
      }
      setLoadingOwners(false);
    })();

    return () => {
      mounted = false;
    };
  }, [isAdminMode]);

  const set = (key: string, val: any) => setFormData((p) => ({ ...p, [key]: val }));

  const getRequired = () => {
    const m: { label: string; step: number }[] = [];
    if (photos.length === 0) m.push({ label: "At least 1 photo", step: 3 });
    if (!formData.property_type) m.push({ label: "Property type", step: 1 });
    if (!formData.district) m.push({ label: "District", step: 1 });
    if (!formData.size_sqft) m.push({ label: "Size (sqft)", step: 2 });
    if ((formData.description_en || "").length < 100) m.push({ label: "Description (min 100 chars)", step: 4 });
    return m;
  };

  const getSoft = () => {
    const s: string[] = [];
    const residential = ["HDB", "Condo", "Landed"].includes(formData.property_type);
    if (!formData.price && !formData.monthly_rental && !formData.price_on_enquiry) s.push("Price not set");
    if (!formData.tenure && formData.transaction_type === "sale") s.push("Tenure not specified");
    if (residential && !formData.bedrooms) s.push("Bedroom count missing");
    return s;
  };

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map((f, i) => ({
      file: f,
      url: "",
      is_cover: photos.length === 0 && i === 0,
      preview: URL.createObjectURL(f),
    }));
    setPhotos((p) => [...p, ...newPhotos]);
  };

  const removePhoto = (idx: number) => {
    const wasCover = photos[idx].is_cover;
    setPhotos((p) => {
      const next = p.filter((_, i) => i !== idx);
      if (wasCover && next.length > 0) next[0].is_cover = true;
      return next;
    });
  };

  const setCover = (idx: number) => {
    setPhotos((p) => p.map((ph, i) => ({ ...ph, is_cover: i === idx })));
  };

  const addPasteUrl = () => {
    if (!pasteUrl.trim()) return;
    setPhotos((p) => [...p, { url: pasteUrl.trim(), is_cover: p.length === 0, preview: pasteUrl.trim() }]);
    setPasteUrl("");
  };

  const handleSave = async (isDraft: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const primaryOwnerId = isAdminMode ? ownerId : session.user.id;
    if (!primaryOwnerId) {
      toast({ title: "Choose a primary owner", description: "Please select the agent who will own this listing.", variant: "destructive" });
      return;
    }
    if (!isDraft && getRequired().length > 0) { setShowErrors(true); return; }
    setSaving(true);

    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        agent_id: primaryOwnerId,
        title: formData.title || formData.property_name || "Untitled",
        property_name: formData.property_name || null,
        unit_number: formData.unit_number || null,
        address: formData.address || null,
        postal_code: formData.postal_code || null,
        district: formData.district ? parseInt(formData.district) : null,
        type: (formData.property_type || "Condo") as any,
        transaction_type: (formData.transaction_type || "sale") as any,
        price: formData.price_on_enquiry ? null : (parseFloat(formData.price) || null),
        monthly_rental: formData.price_on_enquiry ? null : (parseFloat(formData.monthly_rental) || null),
        price_on_enquiry: formData.price_on_enquiry,
        size_sqft: parseFloat(formData.size_sqft) || null,
        bedrooms: formData.bedrooms || null,
        bathrooms: formData.bathrooms || null,
        car_parks: formData.car_parks || 0,
        floor_level: formData.floor_level || null,
        tenure: formData.tenure ? (formData.tenure as any) : null,
        top_year: formData.top_year ? parseInt(formData.top_year) : null,
        facing: formData.facing || null,
        furnishing: formData.furnishing || null,
        mrt_nearest: formData.mrt_nearest || null,
        mrt_distance_m: formData.mrt_distance_m ? parseInt(formData.mrt_distance_m) : null,
        description_en: formData.description_en || null,
        description_zh: formData.description_zh || null,
        virtual_tour_url: formData.virtual_tour_url || null,
        cobroke_enabled: formData.cobroke_enabled,
        cobroke_commission: formData.cobroke_commission ? parseFloat(formData.cobroke_commission) : null,
        status: isDraft ? "draft" : "active",
        approval_status: "approved",
        is_featured: false,
        view_count: 0,
      } as any)
      .select()
      .single();

    if (error || !property) {
      toast({ title: "Failed to save", description: error?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Upload photos
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      let url = p.url;
      if (p.file) {
        const ext = p.file.name.split(".").pop();
        const path = `${property.id}/${Date.now()}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("property-images").upload(path, p.file);
        if (!upErr) {
          const { data: pub } = supabase.storage.from("property-images").getPublicUrl(path);
          url = pub.publicUrl;
        }
      }
      if (url) {
        await supabase.from("property_images").insert({
          property_id: property.id,
          url,
          is_cover: i === 0,
          display_order: i,
        });
      }
    }

    // Floor plans
    for (let i = 0; i < floorPlans.length; i++) {
      const fp = floorPlans[i];
      let url = fp.url;
      if (fp.file) {
        const path = `${property.id}/floor-${Date.now()}-${i}.${fp.file.name.split(".").pop()}`;
        const { error: upErr } = await supabase.storage.from("floor-plans").upload(path, fp.file);
        if (!upErr) {
          const { data: pub } = supabase.storage.from("floor-plans").getPublicUrl(path);
          url = pub.publicUrl;
        }
      }
      if (url) {
        await supabase.from("property_floor_plans").insert({
          property_id: property.id,
          url,
          label: fp.label || `Plan ${i + 1}`,
          display_order: i,
        });
      }
    }

    // Private notes
    if (formData.owner_bottom_price || formData.private_notes || formData.reason_for_selling) {
      await supabase.from("property_private_notes").insert({
        property_id: property.id,
        agent_id: session.user.id,
        owner_bottom_price: formData.owner_bottom_price ? parseFloat(formData.owner_bottom_price) : null,
        reason_for_selling: formData.reason_for_selling || null,
        owner_urgency: formData.owner_urgency || null,
        private_notes: formData.private_notes || null,
      });
    }

    // Link My Files folder
    if (prefillFolder) {
      await supabase.from("agent_files").update({ property_id: property.id }).eq("agent_id", session.user.id).eq("folder_name", prefillFolder);
    }

    setSaving(false);
    toast({ title: isDraft ? "Draft saved" : "🎉 Listing is now live!" });
    navigate(isAdminMode ? "/admin/listings" : "/portal/agent/listings");
  };

  const stepNames = ["Property Info", "Details & Price", "Photos & Media", "Review & Publish"];

  const Stepper = ({ n, label }: { n: number; label: string }) => (
    <button
      onClick={() => setStep(n)}
      className={`flex items-center gap-2 text-sm font-body ${step === n ? "text-accent font-semibold" : n < step ? "text-accent" : "text-muted-foreground"}`}
    >
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
        n < step ? "bg-accent text-accent-foreground" : step === n ? "bg-accent text-accent-foreground" : "border-2 border-muted-foreground/30 text-muted-foreground"
      }`}>
        {n < step ? <Check className="w-3.5 h-3.5" /> : n}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const StepperInput = ({ label, value, onChange, ...props }: any) => (
    <div>
      <label className="text-sm font-body font-medium text-foreground mb-1 block">{label}</label>
      <Input value={value} onChange={(e: any) => onChange(e.target.value)} {...props} />
    </div>
  );

  const NumStepper = ({ label, value, onChange, max = 20 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) => (
    <div>
      <label className="text-sm font-body font-medium text-foreground mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => onChange(Math.max(0, value - 1))} className="h-9 w-9"><Minus className="w-3 h-3" /></Button>
        <span className="w-8 text-center font-body font-semibold">{value}</span>
        <Button size="icon" variant="outline" onClick={() => onChange(Math.min(max, value + 1))} className="h-9 w-9"><Plus className="w-3 h-3" /></Button>
      </div>
    </div>
  );

  const ownerOptions = ownerAgents;
  const selectedOwner = ownerAgents.find((agent) => agent.id === ownerId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => navigate(isAdminMode ? "/admin/listings" : "/portal/agent/listings")}
          className="flex items-center gap-2 text-sm text-muted-foreground font-body hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> {isAdminMode ? "Admin Listings" : "My Listings"}
        </button>
        <h1 className="font-heading text-xl font-bold text-foreground">
          {isAdminMode ? "Admin Create Listing" : "New Listing"}
        </h1>
        <Button variant="outline" size="sm" onClick={() => handleSave(true)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Draft"}
        </Button>
      </div>

      {isAdminMode && (
        <div className="bg-card rounded-xl mx-4 mt-4 p-4 shadow-sm border border-border/70">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">Primary owner</h2>
              <p className="font-body text-sm text-muted-foreground">
                Choose the single agent who will own this listing. The listing still uses the same `properties.agent_id` field, so permissions stay simple.
              </p>
            </div>
            <div className="space-y-2">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingOwners ? "Loading agents..." : "Select primary owner"} />
                </SelectTrigger>
                <SelectContent>
                  {ownerOptions.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.profiles?.full_name ?? agent.profiles?.email ?? agent.id}
                      {agent.is_published ? " (published)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOwner && (
                <p className="font-body text-xs text-muted-foreground">
                  Selected owner: {selectedOwner.profiles?.full_name ?? selectedOwner.profiles?.email ?? selectedOwner.id}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step Progress */}
      <div className="bg-card p-4 mb-6 rounded-xl mx-4 mt-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          {stepNames.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <Stepper n={i + 1} label={name} />
              {i < 3 && <div className={`hidden sm:block w-8 h-[2px] ${i + 1 < step ? "bg-accent" : "bg-border"}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-32">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Transaction type */}
            <div className="flex rounded-xl overflow-hidden border border-border">
              {["sale", "rent"].map((t) => (
                <button
                  key={t}
                  onClick={() => set("transaction_type", t)}
                  className={`flex-1 py-3 text-sm font-body font-semibold transition-colors ${
                    formData.transaction_type === t ? "bg-primary text-accent" : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t === "sale" ? "🏷️ FOR SALE" : "🔑 FOR RENT"}
                </button>
              ))}
            </div>

            {/* Property type pills */}
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-2 block">Property Type *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {propertyTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => set("property_type", t)}
                    className={`py-2.5 px-3 rounded-lg text-sm font-body font-medium border transition-colors ${
                      formData.property_type === t ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border text-foreground hover:border-accent/50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StepperInput label="Property Name" value={formData.property_name} onChange={(v: string) => set("property_name", v)} placeholder="e.g. Oxley Residence" />
              <StepperInput label="Unit Number" value={formData.unit_number} onChange={(v: string) => set("unit_number", v)} placeholder="e.g. #08-01" />
              <StepperInput label="Block/Street Address *" value={formData.address} onChange={(v: string) => set("address", v)} placeholder="e.g. 123 Tanjong Pagar Road" />
              <StepperInput label="Postal Code" value={formData.postal_code} onChange={(v: string) => set("postal_code", v)} placeholder="6 digits" maxLength={6} />
              <div>
                <label className="text-sm font-body font-medium text-foreground mb-1 block">District *</label>
                <Select value={formData.district} onValueChange={(v) => set("district", v)}>
                  <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                  <SelectContent>
                    {districtOptions.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <StepperInput label="MRT Station" value={formData.mrt_nearest} onChange={(v: string) => set("mrt_nearest", v)} placeholder="e.g. Tanjong Pagar MRT" />
              <StepperInput label="Distance to MRT (m)" value={formData.mrt_distance_m} onChange={(v: string) => set("mrt_distance_m", v)} type="number" />
            </div>

            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1 block">
                Listing Title * <span className="text-muted-foreground text-xs">({(formData.title || "").length}/120)</span>
              </label>
              <Input value={formData.title} onChange={(e) => set("title", e.target.value.slice(0, 120))} placeholder='e.g. Restored Heritage Shophouse | Tanjong Pagar | Freehold' />
            </div>
            <StepperInput label="Listing Title Chinese (optional)" value={formData.title_zh} onChange={(v: string) => set("title_zh", v)} />
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StepperInput label="Size sqft *" value={formData.size_sqft} onChange={(v: string) => set("size_sqft", v)} type="number" />
              <StepperInput label="Floor Level" value={formData.floor_level} onChange={(v: string) => set("floor_level", v)} placeholder="e.g. High / Level 15" />
              <StepperInput label="Total Units" value={formData.total_units} onChange={(v: string) => set("total_units", v)} type="number" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumStepper label="Bedrooms" value={formData.bedrooms} onChange={(v) => set("bedrooms", v)} />
              <NumStepper label="Bathrooms" value={formData.bathrooms} onChange={(v) => set("bathrooms", v)} />
              <NumStepper label="Car Parks" value={formData.car_parks} onChange={(v) => set("car_parks", v)} max={10} />
            </div>

            {/* Tenure */}
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-2 block">Tenure</label>
              <div className="flex flex-wrap gap-2">
                {["Freehold", "99-year", "999-year", "Leasehold"].map((t) => (
                  <button
                    key={t}
                    onClick={() => set("tenure", t === formData.tenure ? "" : t)}
                    className={`px-4 py-2 rounded-lg text-sm font-body border transition-colors ${
                      formData.tenure === t ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:border-accent/50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StepperInput label="TOP Year" value={formData.top_year} onChange={(v: string) => set("top_year", v)} type="number" placeholder="e.g. 2025" />
              <StepperInput label="Facing" value={formData.facing} onChange={(v: string) => set("facing", v)} placeholder="e.g. North, City View" />
            </div>

            {/* Furnishing */}
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-2 block">Furnishing</label>
              <div className="flex flex-wrap gap-2">
                {["Unfurnished", "Partial", "Fully Furnished"].map((f) => (
                  <button
                    key={f}
                    onClick={() => set("furnishing", f === formData.furnishing ? "" : f)}
                    className={`px-4 py-2 rounded-lg text-sm font-body border transition-colors ${
                      formData.furnishing === f ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:border-accent/50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <StepperInput label="Available From" value={formData.availability_date} onChange={(v: string) => set("availability_date", v)} type="date" />

            {/* Pricing */}
            <div className="bg-accent/5 rounded-xl p-5">
              <h3 className="font-body font-semibold text-foreground mb-3">💰 Pricing</h3>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input type="checkbox" checked={formData.price_on_enquiry} onChange={(e) => set("price_on_enquiry", e.target.checked)} className="rounded" />
                <span className="text-sm font-body">Price on enquiry</span>
              </label>
              {!formData.price_on_enquiry && (
                formData.transaction_type === "sale" ? (
                  <div>
                    <StepperInput label="Asking Price (SGD)" value={formData.price} onChange={(v: string) => set("price", v)} type="number" placeholder="e.g. 2800000" />
                    {formData.price && formData.size_sqft && (
                      <p className="text-sm text-accent font-body mt-1">= ${calcPSF(parseFloat(formData.price), parseFloat(formData.size_sqft)).toLocaleString()} psf</p>
                    )}
                  </div>
                ) : (
                  <StepperInput label="Monthly Rental (SGD)" value={formData.monthly_rental} onChange={(v: string) => set("monthly_rental", v)} type="number" />
                )
              )}
              {!formData.price && !formData.monthly_rental && !formData.price_on_enquiry && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 font-body">
                  ⚠️ No price set. Tick "Price on enquiry" or enter a price.
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-body font-semibold text-foreground mb-3">Photos {photos.length > 0 && `(${photos.length})`}</h3>
              {/* Upload zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-accent/40 rounded-xl bg-accent/5 h-[180px] flex flex-col items-center justify-center cursor-pointer hover:border-accent/60 transition-colors"
              >
                <Camera className="w-10 h-10 text-accent mb-2" />
                <p className="text-sm font-body text-muted-foreground">Drag & drop photos here, or click to select</p>
                <p className="text-xs font-body text-muted-foreground mt-1">JPG, PNG, WebP · Max 10MB · Up to 30 photos</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />

              {/* Grid */}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img src={p.preview || p.url} alt="" className="w-full h-full object-cover" />
                      {p.is_cover && (
                        <span className="absolute top-2 left-2 bg-accent text-accent-foreground text-[10px] font-body font-bold px-1.5 py-0.5 rounded-full">⭐ Cover</span>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={() => setLightboxUrl(p.preview || p.url)} className="text-white"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => removePhoto(i)} className="text-white"><X className="w-4 h-4" /></button>
                        {!p.is_cover && (
                          <button onClick={() => setCover(i)} className="text-white"><Star className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {photos.length > 0 && photos.length < 3 && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 font-body">
                  💡 Listings with 3+ photos receive significantly more enquiries.
                </div>
              )}

              {/* URL paste */}
              <div className="flex gap-2 mt-3">
                <Input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="Or paste image URL..." className="text-sm" />
                <Button size="sm" variant="outline" onClick={addPasteUrl}>Add</Button>
              </div>
            </div>

            {/* Floor plans */}
            <div>
              <h3 className="font-body font-semibold text-foreground mb-3">Floor Plans</h3>
              <div
                onClick={() => floorRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl bg-muted/50 h-[80px] flex items-center justify-center cursor-pointer hover:border-accent/40 transition-colors"
              >
                <Upload className="w-5 h-5 text-muted-foreground mr-2" />
                <span className="text-sm font-body text-muted-foreground">Upload floor plan (PDF or image)</span>
              </div>
              <input ref={floorRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFloorPlans((p) => [...p, { file: f, url: URL.createObjectURL(f), label: "" }]);
              }} />
              {floorPlans.map((fp, i) => (
                <div key={i} className="flex items-center gap-3 mt-2 bg-card rounded-lg p-2">
                  <img src={fp.url} alt="" className="w-16 h-12 object-cover rounded" />
                  <Input value={fp.label} onChange={(e) => setFloorPlans((p) => p.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" className="flex-1 text-sm" />
                  <Button size="icon" variant="ghost" onClick={() => setFloorPlans((p) => p.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>

            {/* Virtual tour */}
            <StepperInput label="Virtual Tour URL" value={formData.virtual_tour_url} onChange={(v: string) => set("virtual_tour_url", v)} placeholder="e.g. Matterport or YouTube 360° link" />
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="space-y-6">
            {/* Required check */}
            {getRequired().length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-body font-semibold text-red-700 mb-2">❌ Cannot publish — please complete:</p>
                {getRequired().map((r) => (
                  <button key={r.label} onClick={() => setStep(r.step)} className="block text-sm font-body text-red-600 hover:underline">
                    • {r.label} <span className="text-red-400">Fix →</span>
                  </button>
                ))}
              </div>
            )}

            {/* Soft warnings */}
            {getSoft().length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-body font-semibold text-amber-700">⚠️ Recommended: {getSoft().join(", ")}</p>
              </div>
            )}

            {/* Preview */}
            {getRequired().length === 0 && (
              <div className="bg-card rounded-xl p-5 shadow-sm">
                <h3 className="font-body font-semibold mb-3">Listing Preview</h3>
                <div className="flex gap-4">
                  {photos[0] && (
                    <img src={photos[0].preview || photos[0].url} alt="" className="w-40 h-28 rounded-lg object-cover" />
                  )}
                  <div>
                    <p className="font-heading text-lg text-foreground">{formData.property_name || formData.title}</p>
                    <div className="flex gap-2 mt-1">
                      {formData.property_type && <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-body">{formData.property_type}</span>}
                      {formData.tenure && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-body">{formData.tenure}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground font-body mt-1">{formData.address} · D{formData.district}</p>
                    <p className="text-base font-semibold text-accent font-body mt-1">
                      {formData.price_on_enquiry ? "Price on Enquiry" : formData.price ? formatSGD(parseFloat(formData.price)) : formData.monthly_rental ? `${formatSGD(parseFloat(formData.monthly_rental))}/mo` : "—"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-body mt-2">
                  {photos.length} photos · Floor plans: {floorPlans.length > 0 ? "Yes" : "No"} · Virtual tour: {formData.virtual_tour_url ? "Yes" : "No"}
                </p>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1 block">
                📝 Property Description * <span className={`text-xs ${(formData.description_en || "").length >= 100 ? "text-green-600" : "text-red-500"}`}>({(formData.description_en || "").length}/100 min)</span>
              </label>
              <Textarea rows={8} value={formData.description_en} onChange={(e) => set("description_en", e.target.value)} placeholder="Describe the property..." />
            </div>

            {/* Co-broke */}
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.cobroke_enabled} onChange={(e) => set("cobroke_enabled", e.target.checked)} className="rounded" />
                <span className="text-sm font-body font-medium">Open to co-broke with other CEA agents</span>
              </label>
              {formData.cobroke_enabled && (
                <div className="mt-3">
                  <StepperInput label="Commission offered (%)" value={formData.cobroke_commission} onChange={(v: string) => set("cobroke_commission", v)} type="number" step="0.25" />
                </div>
              )}
            </div>

            {/* Private notes */}
            <div className="bg-accent/5 rounded-xl p-4">
              <h3 className="font-body font-semibold text-foreground mb-3">🔒 Private Notes — only you can see this</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StepperInput label="Owner's bottom price" value={formData.owner_bottom_price} onChange={(v: string) => set("owner_bottom_price", v)} type="number" />
                <StepperInput label="Reason for selling" value={formData.reason_for_selling} onChange={(v: string) => set("reason_for_selling", v)} />
                <StepperInput label="Owner urgency" value={formData.owner_urgency} onChange={(v: string) => set("owner_urgency", v)} />
              </div>
              <div className="mt-3">
                <label className="text-sm font-body font-medium text-foreground mb-1 block">Private remarks</label>
                <Textarea rows={3} value={formData.private_notes} onChange={(e) => set("private_notes", e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card shadow-[0_-4px_12px_rgba(0,0,0,0.08)] p-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          {/* Progress dots */}
          <div className="flex gap-1">
            {[photos.length > 0, !!formData.property_type, !!formData.district, !!formData.size_sqft, (formData.description_en || "").length >= 100].map((ok, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full ${ok ? "bg-accent" : "bg-muted-foreground/30"}`} />
            ))}
          </div>
          <span className={`text-xs font-body ${getRequired().length === 0 ? "text-green-600" : "text-red-500"}`}>
            {getRequired().length === 0 ? "Ready to publish ✓" : `${getRequired().length} fields needed`}
          </span>
        </div>
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>← Back</Button>
          )}
          {step < 4 ? (
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setStep(step + 1)}>
              Next: {stepNames[step]} →
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>Save as Draft</Button>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                🚀 Publish Listing
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/90">
          {lightboxUrl && <img src={lightboxUrl} alt="" className="w-full h-auto max-h-[90vh] object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
