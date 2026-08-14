import { useState, useEffect, useRef } from "react";
import { useCommand } from "../CommandContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { districtOptions, propertyTypes, formatSGD } from "@/lib/listingHelpers";
import {
  ArrowLeft, Check, Camera, X, Eye, Star,
  Plus, Minus, Loader2, Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

interface PhotoItem {
  id?: string;
  file?: File;
  url: string;
  is_cover: boolean;
  preview?: string;
}

function StepperInput({ label, value, onChange, ...props }: any) {
  return (
    <div>
      <label className="text-xs font-body font-medium text-foreground mb-1 block">{label}</label>
      <Input value={value || ""} onChange={(e: any) => onChange(e.target.value)} className="h-9 text-sm" {...props} />
    </div>
  );
}

function NumStepper({ label, value, onChange, max = 20 }: any) {
  return (
    <div>
      <label className="text-xs font-body font-medium text-foreground mb-1 block">{label}</label>
      <div className="flex items-center gap-1.5">
        <Button size="icon" variant="outline" onClick={() => onChange(Math.max(0, (value || 0) - 1))} className="h-8 w-8"><Minus className="w-3 h-3" /></Button>
        <span className="w-6 text-center font-body font-semibold text-sm">{value || 0}</span>
        <Button size="icon" variant="outline" onClick={() => onChange(Math.min(max, (value || 0) + 1))} className="h-8 w-8"><Plus className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

export function ListingFormScene() {
  const { state, dispatch } = useCommand();
  const [listingId, setListingId] = useState<string | undefined>(state.sceneParams?.listing_id);
  const prefill = state.sceneParams?.prefill;
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const skipLoadRef = useRef(false);

  useEffect(() => {
    if (listingId) {
      if (skipLoadRef.current) {
        // After prefill/blank creation, load property data but preserve photos
        skipLoadRef.current = false;
        loadPropertyKeepPhotos();
      } else {
        loadProperty();
      }
    } else if (prefill) {
      createFromPrefill();
    } else {
      createBlankListing();
    }
  }, [listingId]);

  const createFromPrefill = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data, error } = await supabase.from("properties").insert({
      agent_id: session.user.id,
      title: prefill.title || prefill.property_name || "Untitled",
      property_name: prefill.property_name || null,
      unit_number: prefill.unit_number || null,
      address: prefill.address || null,
      postal_code: prefill.postal_code || null,
      district: prefill.district ? parseInt(prefill.district) : null,
      type: (prefill.property_type || "Condo") as any,
      transaction_type: (prefill.transaction_type || "sale") as any,
      price: parseFloat(prefill.price) || 0,
      monthly_rental: parseFloat(prefill.monthly_rental) || null,
      size_sqft: parseFloat(prefill.size_sqft) || null,
      bedrooms: prefill.bedrooms || null,
      bathrooms: prefill.bathrooms || null,
      floor_level: prefill.floor_level || null,
      tenure: prefill.tenure ? (prefill.tenure as any) : null,
      top_year: prefill.top_year ? parseInt(prefill.top_year) : null,
      facing: prefill.facing || null,
      furnishing: prefill.furnishing || null,
      mrt_nearest: prefill.mrt_nearest || null,
      description_en: prefill.description_en || null,
      status: "draft" as any,
      approval_status: "pending",
    } as any).select().single();

    if (data) {
      // Load folder photos into the photos state
      if (prefill.photos && Array.isArray(prefill.photos)) {
        setPhotos(prefill.photos.map((url: string, i: number) => ({
          url,
          preview: url,
          is_cover: i === 0,
        })));
      }

      // Link all folder files to this new property to prevent duplicate creation
      if (prefill._folderName && session) {
        await supabase
          .from("agent_files")
          .update({ property_id: data.id })
          .eq("agent_id", session.user.id)
          .eq("folder_name", prefill._folderName)
          .eq("category", prefill._folderCategory || "listing");
      }

      skipLoadRef.current = true;
      setListingId(data.id);
    } else {
      toast({ title: "Failed to create listing", variant: "destructive" });
      setLoading(false);
    }
  };

  const createBlankListing = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data } = await supabase.from("properties").insert({
      agent_id: session.user.id,
      title: "Untitled",
      type: "Condo" as any,
      transaction_type: "sale" as any,
      price: 0,
      status: "draft" as any,
      approval_status: "pending",
    } as any).select().single();

    if (data) {
      skipLoadRef.current = true;
      setListingId(data.id);
    } else {
      toast({ title: "Failed to create listing", variant: "destructive" });
      setLoading(false);
    }
  };

  const loadPropertyKeepPhotos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("properties")
      .select("*, property_images(*)")
      .eq("id", listingId)
      .single();

    if (!data) { setLoading(false); return; }

    setFormData({
      ...data,
      district: data.district ? String(data.district) : "",
      size_sqft: data.size_sqft ? String(data.size_sqft) : "",
      price: data.price ? String(data.price) : "",
      monthly_rental: data.monthly_rental ? String(data.monthly_rental) : "",
      mrt_distance_m: data.mrt_distance_m ? String(data.mrt_distance_m) : "",
      top_year: data.top_year ? String(data.top_year) : "",
      property_type: data.type || "",
      cobroke_commission: data.cobroke_commission ? String(data.cobroke_commission) : "",
    });

    // Don't overwrite photos — they were set from prefill
    setLoading(false);
  };

  const loadProperty = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("properties")
      .select("*, property_images(*)")
      .eq("id", listingId)
      .single();

    if (!data) { setLoading(false); return; }

    setFormData({
      ...data,
      district: data.district ? String(data.district) : "",
      size_sqft: data.size_sqft ? String(data.size_sqft) : "",
      price: data.price ? String(data.price) : "",
      monthly_rental: data.monthly_rental ? String(data.monthly_rental) : "",
      mrt_distance_m: data.mrt_distance_m ? String(data.mrt_distance_m) : "",
      top_year: data.top_year ? String(data.top_year) : "",
      property_type: data.type || "",
      cobroke_commission: data.cobroke_commission ? String(data.cobroke_commission) : "",
    });

    setPhotos(
      (data.property_images || [])
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        .map((img: any) => ({ id: img.id, url: img.url, is_cover: img.is_cover, preview: img.url }))
    );

    // Load private notes
    const { data: pn } = await supabase.from("property_private_notes").select("*").eq("property_id", listingId).maybeSingle();
    if (pn) {
      setFormData((prev: any) => ({
        ...prev,
        _privateNoteId: pn.id,
        owner_bottom_price: pn.owner_bottom_price ? String(pn.owner_bottom_price) : "",
        reason_for_selling: pn.reason_for_selling || "",
        owner_urgency: pn.owner_urgency || "",
        private_notes: pn.private_notes || "",
      }));
    }

    setLoading(false);
  };

  const set = (key: string, val: any) => setFormData((p: any) => ({ ...p, [key]: val }));

  const getRequired = () => {
    const m: { label: string; step: number }[] = [];
    if (photos.length === 0) m.push({ label: "At least 1 photo", step: 3 });
    if (!formData.property_type) m.push({ label: "Property type", step: 1 });
    if (!formData.district) m.push({ label: "District", step: 1 });
    if (!formData.size_sqft) m.push({ label: "Size (sqft)", step: 2 });
    if ((formData.description_en || "").length < 100) m.push({ label: "Description (min 100 chars)", step: 4 });
    return m;
  };

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map((f) => ({ file: f, url: "", is_cover: false, preview: URL.createObjectURL(f) }));
    setPhotos((p) => [...p, ...newPhotos]);
  };

  const removePhoto = async (idx: number) => {
    const photo = photos[idx];
    if (photo.id) await supabase.from("property_images").delete().eq("id", photo.id);
    const wasCover = photo.is_cover;
    setPhotos((p) => {
      const next = p.filter((_, i) => i !== idx);
      if (wasCover && next.length > 0) next[0].is_cover = true;
      return next;
    });
  };

  const setCover = (idx: number) => {
    setPhotos((p) => p.map((ph, i) => ({ ...ph, is_cover: i === idx })));
  };

  const handleSave = async (isDraft: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !listingId) return;
    if (!isDraft && getRequired().length > 0) { setShowErrors(true); return; }
    setSaving(true);

    const { error } = await supabase
      .from("properties")
      .update({
        title: formData.title || formData.property_name || "Untitled",
        property_name: formData.property_name || null,
        unit_number: formData.unit_number || null,
        address: formData.address || null,
        postal_code: formData.postal_code || null,
        district: formData.district ? parseInt(formData.district) : null,
        type: (formData.property_type || "Condo") as any,
        transaction_type: (formData.transaction_type || "sale") as any,
        price: formData.price_on_enquiry ? 0 : (parseFloat(formData.price) || 0),
        monthly_rental: formData.price_on_enquiry ? null : (parseFloat(formData.monthly_rental) || null),
        is_featured: formData.is_featured || false,
        price_on_enquiry: formData.price_on_enquiry || false,
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
        cobroke_enabled: formData.cobroke_enabled || false,
        cobroke_commission: formData.cobroke_commission ? parseFloat(formData.cobroke_commission) : null,
        status: isDraft ? "draft" : "active",
        approval_status: "approved",
      } as any)
      .eq("id", listingId)
      .eq("agent_id", session.user.id);

    if (error) { toast({ title: "Failed to save", variant: "destructive" }); setSaving(false); return; }

    // Upload new photos
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (p.file) {
        const ext = p.file.name.split(".").pop();
        const path = `${listingId}/${Date.now()}-${i}.${ext}`;
        await supabase.storage.from("property-images").upload(path, p.file);
        const { data: pub } = supabase.storage.from("property-images").getPublicUrl(path);
        await supabase.from("property_images").insert({
          property_id: listingId, url: pub.publicUrl, is_cover: p.is_cover, display_order: i,
        });
      } else if (p.id) {
        await supabase.from("property_images").update({ is_cover: p.is_cover, display_order: i }).eq("id", p.id);
      } else if (p.url && !p.file) {
        // URL-based photo (e.g. from folder prefill) — fetch and re-upload to property-images
        try {
          const resp = await fetch(p.url);
          if (resp.ok) {
            const blob = await resp.blob();
            const ext = p.url.split(".").pop()?.split("?")[0] || "jpg";
            const path = `${listingId}/${Date.now()}-${i}.${ext}`;
            await supabase.storage.from("property-images").upload(path, blob);
            const { data: pub } = supabase.storage.from("property-images").getPublicUrl(path);
            await supabase.from("property_images").insert({
              property_id: listingId, url: pub.publicUrl, is_cover: p.is_cover, display_order: i,
            });
          }
        } catch (e) {
          console.error("Failed to copy photo:", e);
        }
      }
    }

    // Private notes
    if (formData._privateNoteId) {
      await supabase.from("property_private_notes").update({
        owner_bottom_price: formData.owner_bottom_price ? parseFloat(formData.owner_bottom_price) : null,
        reason_for_selling: formData.reason_for_selling || null,
        owner_urgency: formData.owner_urgency || null,
        private_notes: formData.private_notes || null,
      }).eq("id", formData._privateNoteId);
    } else if (formData.owner_bottom_price || formData.private_notes) {
      await supabase.from("property_private_notes").insert({
        property_id: listingId,
        agent_id: session.user.id,
        owner_bottom_price: formData.owner_bottom_price ? parseFloat(formData.owner_bottom_price) : null,
        reason_for_selling: formData.reason_for_selling || null,
        owner_urgency: formData.owner_urgency || null,
        private_notes: formData.private_notes || null,
      });
    }

    setSaving(false);
    toast({ title: isDraft ? "Draft saved" : "🎉 Listing updated and live!" });
    dispatch({ type: "NAVIGATE", scene: "listing_detail", params: { listing_id: listingId } });
  };

  const handleDelete = async () => {
    if (!listingId) return;
    await supabase.from("property_images").delete().eq("property_id", listingId);
    await supabase.from("property_private_notes").delete().eq("property_id", listingId);
    await supabase.from("property_price_history").delete().eq("property_id", listingId);
    await supabase.from("property_floor_plans").delete().eq("property_id", listingId);
    await supabase.from("agent_files").update({ property_id: null }).eq("property_id", listingId);
    await supabase.from("properties").delete().eq("id", listingId);
    toast({ title: "Listing deleted" });
    dispatch({ type: "NAVIGATE", scene: "listings" });
  };

  const toggleStatus = async () => {
    if (!listingId) return;
    const newStatus = formData.status === "active" ? "draft" : "active";
    await supabase.from("properties").update({ status: newStatus }).eq("id", listingId);
    set("status", newStatus);
    toast({ title: newStatus === "active" ? "Published!" : "Taken down" });
  };

  const stepNames = ["Property Info", "Details & Price", "Photos", "Review"];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!formData?.id) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground font-body">Listing not found.</p>
        <button onClick={() => dispatch({ type: "GO_BACK" })} className="text-sm text-gold hover:underline font-body">← Back</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => dispatch({ type: "GO_BACK" })} className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4 text-muted-foreground" /></button>
          <h2 className="font-heading text-lg text-navy font-bold truncate">{formData.status === "draft" && !formData.updated_at ? "New Listing" : "Edit Listing"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Draft"}
          </Button>
          <Button size="sm" variant={formData.status === "active" ? "destructive" : "default"} className="h-8 text-xs" onClick={() => handleSave(formData.status !== "active")} disabled={saving}>
            {formData.status === "active" ? "Take Down" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Step tabs */}
      <div className="px-4 py-2 flex items-center gap-1 border-b border-border shrink-0 overflow-x-auto">
        {stepNames.map((name, i) => (
          <button
            key={i}
            onClick={() => setStep(i + 1)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body transition-colors ${
              step === i + 1 ? "bg-navy text-cream" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i + 1 < step ? "bg-green-500 text-white" : step === i + 1 ? "bg-cream/20" : "border border-muted-foreground/30"
            }`}>
              {i + 1 < step ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            <span className="hidden sm:inline">{name}</span>
          </button>
        ))}
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto p-4">
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex rounded-lg overflow-hidden border border-border">
              {["sale", "rent"].map((t) => (
                <button key={t} onClick={() => set("transaction_type", t)}
                  className={`flex-1 py-2 text-xs font-body font-semibold transition-colors ${formData.transaction_type === t ? "bg-primary text-accent" : "bg-card text-muted-foreground"}`}>
                  {t === "sale" ? "🏷️ FOR SALE" : "🔑 FOR RENT"}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-body font-medium text-foreground mb-1.5 block">Property Type *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {propertyTypes.map((t) => (
                  <button key={t} onClick={() => set("property_type", t)}
                    className={`py-2 px-2 rounded-lg text-xs font-body font-medium border transition-colors ${formData.property_type === t ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:border-accent/50"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <StepperInput label="Property Name" value={formData.property_name} onChange={(v: string) => set("property_name", v)} />
              <StepperInput label="Unit Number" value={formData.unit_number} onChange={(v: string) => set("unit_number", v)} />
              <StepperInput label="Address *" value={formData.address} onChange={(v: string) => set("address", v)} />
              <StepperInput label="Postal Code" value={formData.postal_code} onChange={(v: string) => set("postal_code", v)} maxLength={6} />
              <div>
                <label className="text-xs font-body font-medium text-foreground mb-1 block">District *</label>
                <Select value={formData.district} onValueChange={(v) => set("district", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select district" /></SelectTrigger>
                  <SelectContent>{districtOptions.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <StepperInput label="MRT Station" value={formData.mrt_nearest} onChange={(v: string) => set("mrt_nearest", v)} />
            </div>
            <div>
              <label className="text-xs font-body font-medium text-foreground mb-1 block">Listing Title * ({(formData.title || "").length}/120)</label>
              <Input value={formData.title || ""} onChange={(e) => set("title", e.target.value.slice(0, 120))} className="h-9 text-sm" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StepperInput label="Size sqft *" value={formData.size_sqft} onChange={(v: string) => set("size_sqft", v)} type="number" />
              <StepperInput label="Floor Level" value={formData.floor_level} onChange={(v: string) => set("floor_level", v)} />
              <StepperInput label="TOP Year" value={formData.top_year} onChange={(v: string) => set("top_year", v)} type="number" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumStepper label="Bedrooms" value={formData.bedrooms} onChange={(v: number) => set("bedrooms", v)} />
              <NumStepper label="Bathrooms" value={formData.bathrooms} onChange={(v: number) => set("bathrooms", v)} />
              <NumStepper label="Parking" value={formData.car_parks} onChange={(v: number) => set("car_parks", v)} max={10} />
            </div>
            <div>
              <label className="text-xs font-body font-medium mb-1.5 block">Tenure</label>
              <div className="flex flex-wrap gap-1.5">
                {["Freehold", "99-year", "999-year", "Leasehold"].map((t) => (
                  <button key={t} onClick={() => set("tenure", t === formData.tenure ? "" : t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-body border ${formData.tenure === t ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-body font-medium mb-1.5 block">Furnishing</label>
              <div className="flex flex-wrap gap-1.5">
                {["Unfurnished", "Partial", "Fully Furnished"].map((f) => (
                  <button key={f} onClick={() => set("furnishing", f === formData.furnishing ? "" : f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-body border ${formData.furnishing === f ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border"}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-accent/5 rounded-lg p-4">
              <h3 className="font-body font-semibold text-sm mb-2">💰 Pricing</h3>
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input type="checkbox" checked={formData.price_on_enquiry || false} onChange={(e) => set("price_on_enquiry", e.target.checked)} className="rounded" />
                <span className="text-xs font-body">Price on enquiry</span>
              </label>
              {!formData.price_on_enquiry && (
                formData.transaction_type === "sale" ? (
                  <StepperInput label="Asking Price (SGD)" value={formData.price} onChange={(v: string) => set("price", v)} type="number" />
                ) : (
                  <StepperInput label="Monthly Rental (SGD)" value={formData.monthly_rental} onChange={(v: string) => set("monthly_rental", v)} type="number" />
                )
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-body font-semibold text-sm mb-2">Photos ({photos.length})</h3>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-accent/40 rounded-lg bg-accent/5 h-24 flex flex-col items-center justify-center cursor-pointer">
                <Camera className="w-6 h-6 text-accent mb-1" />
                <p className="text-xs font-body text-muted-foreground">Drop or click to upload</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                      <img src={p.preview || p.url} alt="" className="w-full h-full object-cover" />
                      {p.is_cover && <span className="absolute top-1 left-1 bg-accent text-accent-foreground text-[9px] font-bold px-1 py-0.5 rounded-full">⭐</span>}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <button onClick={() => setLightboxUrl(p.preview || p.url)} className="text-white"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => removePhoto(i)} className="text-white"><X className="w-3.5 h-3.5" /></button>
                        {!p.is_cover && <button onClick={() => setCover(i)} className="text-white"><Star className="w-3.5 h-3.5" /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <Input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="Paste image URL..." className="text-xs h-8" />
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { if (pasteUrl) { setPhotos(p => [...p, { url: pasteUrl, is_cover: false, preview: pasteUrl }]); setPasteUrl(""); } }}>Add</Button>
              </div>
            </div>
            <StepperInput label="Virtual Tour URL" value={formData.virtual_tour_url} onChange={(v: string) => set("virtual_tour_url", v)} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {getRequired().length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-body font-semibold text-red-700 mb-1">❌ Cannot publish:</p>
                {getRequired().map((r) => (
                  <button key={r.label} onClick={() => setStep(r.step)} className="block text-xs text-red-600 hover:underline">• {r.label}</button>
                ))}
              </div>
            )}
            <div>
              <label className="text-xs font-body font-medium mb-1 block">
                📝 Description * <span className={`${(formData.description_en || "").length >= 100 ? "text-green-600" : "text-red-500"}`}>({(formData.description_en || "").length}/100 min)</span>
              </label>
              <Textarea rows={6} value={formData.description_en || ""} onChange={(e) => set("description_en", e.target.value)} className="text-sm" />
            </div>
            {/* Display toggles */}
            <div className="bg-card rounded-lg p-3 border border-border space-y-3">
              <h3 className="font-body font-semibold text-sm">📢 Display Settings</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-body font-medium text-foreground">Show on Listings page</p>
                  <p className="text-[10px] font-body text-muted-foreground">Visible at /listings when published</p>
                </div>
                <Switch
                  checked={formData.status === "active"}
                  onCheckedChange={(checked) => set("status", checked ? "active" : "draft")}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-body font-medium text-foreground">Feature on Homepage</p>
                  <p className="text-[10px] font-body text-muted-foreground">Show in Featured Properties section</p>
                </div>
                <Switch
                  checked={formData.is_featured || false}
                  onCheckedChange={(checked) => set("is_featured", checked)}
                />
              </div>
            </div>
            <div className="bg-card rounded-lg p-3 border border-border">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.cobroke_enabled || false} onChange={(e) => set("cobroke_enabled", e.target.checked)} className="rounded" />
                <span className="text-xs font-body font-medium">Open to co-broke</span>
              </label>
              {formData.cobroke_enabled && (
                <StepperInput label="Commission (%)" value={formData.cobroke_commission} onChange={(v: string) => set("cobroke_commission", v)} type="number" className="mt-2" />
              )}
            </div>
            <div className="bg-accent/5 rounded-lg p-3">
              <h3 className="font-body font-semibold text-sm mb-2">🔒 Private Notes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <StepperInput label="Owner's bottom price" value={formData.owner_bottom_price} onChange={(v: string) => set("owner_bottom_price", v)} type="number" />
                <StepperInput label="Reason for selling" value={formData.reason_for_selling} onChange={(v: string) => set("reason_for_selling", v)} />
              </div>
              <div className="mt-2">
                <label className="text-xs font-body font-medium mb-1 block">Private remarks</label>
                <Textarea rows={2} value={formData.private_notes || ""} onChange={(e) => set("private_notes", e.target.value)} className="text-sm" />
              </div>
            </div>
            <div className="border border-destructive/30 rounded-lg p-3">
              <p className="text-xs font-body text-destructive font-semibold">⚠️ Delete this listing permanently?</p>
              <Button variant="destructive" size="sm" className="mt-1.5 h-7 text-xs" onClick={() => setShowDelete(true)}>
                <Trash2 className="w-3 h-3 mr-1" /> Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between shrink-0 bg-background">
        <span className={`text-[10px] font-body ${getRequired().length === 0 ? "text-green-600" : "text-red-500"}`}>
          {getRequired().length === 0 ? "Ready ✓" : `${getRequired().length} fields needed`}
        </span>
        <div className="flex gap-2">
          {step > 1 && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setStep(step - 1)}>← Back</Button>}
          {step < 4 ? (
            <Button size="sm" className="h-8 text-xs bg-accent text-accent-foreground" onClick={() => setStep(step + 1)}>Next →</Button>
          ) : (
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSave(true)} disabled={saving}>Save Draft</Button>
              <Button size="sm" className="h-8 text-xs bg-accent text-accent-foreground" onClick={() => handleSave(false)} disabled={saving}>
                {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />} 🚀 Publish
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete modal */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/90">
          {lightboxUrl && <img src={lightboxUrl} alt="" className="w-full max-h-[90vh] object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
