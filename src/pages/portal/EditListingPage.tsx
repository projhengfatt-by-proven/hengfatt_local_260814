import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { districtOptions, propertyTypes, formatSGD, calcPSF } from "@/lib/listingHelpers";
import {
  ArrowLeft, Check, Camera, X, Eye, Star, Upload,
  Plus, Minus, Loader2, Trash2,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

interface PhotoItem {
  id?: string;
  file?: File;
  url: string;
  is_cover: boolean;
  preview?: string;
}

export default function EditListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [floorPlans, setFloorPlans] = useState<any[]>([]);
  const [privateNotes, setPrivateNotes] = useState<any>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const floorRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadProperty(); }, [id]);

  const loadProperty = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase
      .from("properties")
      .select("*, property_images(*), property_floor_plans(*)")
      .eq("id", id)
      .single();

    if (!data) { navigate("/portal/agent/listings"); return; }

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
    setFloorPlans(
      (data.property_floor_plans || []).map((fp: any) => ({ id: fp.id, url: fp.url, label: fp.label || "" }))
    );

    // Private notes
    const { data: pn } = await supabase.from("property_private_notes").select("*").eq("property_id", id).maybeSingle();
    if (pn) {
      setPrivateNotes(pn);
      setFormData((prev: any) => ({
        ...prev,
        owner_bottom_price: pn.owner_bottom_price ? String(pn.owner_bottom_price) : "",
        reason_for_selling: pn.reason_for_selling || "",
        owner_urgency: pn.owner_urgency || "",
        private_notes: pn.private_notes || "",
      }));
    }

    // Price history
    const { data: ph } = await supabase.from("property_price_history").select("*").eq("property_id", id).order("changed_at", { ascending: false });
    setPriceHistory(ph || []);

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
    if (photo.id) {
      await supabase.from("property_images").delete().eq("id", photo.id);
    }
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
    if (!session || !id) return;
    if (!isDraft && getRequired().length > 0) { setShowErrors(true); return; }
    setSaving(true);

    const oldPrice = formData.price ? parseFloat(formData.price) : null;

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
        price: formData.price_on_enquiry ? null : (parseFloat(formData.price) || null),
        monthly_rental: formData.price_on_enquiry ? null : (parseFloat(formData.monthly_rental) || null),
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
      .eq("id", id)
      .eq("agent_id", session.user.id);

    if (error) { toast({ title: "Failed to save", variant: "destructive" }); setSaving(false); return; }

    // Upload new photos
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (p.file) {
        const ext = p.file.name.split(".").pop();
        const path = `${id}/${Date.now()}-${i}.${ext}`;
        await supabase.storage.from("property-images").upload(path, p.file);
        const { data: pub } = supabase.storage.from("property-images").getPublicUrl(path);
        await supabase.from("property_images").insert({
          property_id: id, url: pub.publicUrl, is_cover: p.is_cover, display_order: i,
        });
      } else if (p.id) {
        await supabase.from("property_images").update({ is_cover: p.is_cover, display_order: i }).eq("id", p.id);
      }
    }

    // Upload new floor plans
    for (const fp of floorPlans) {
      if (fp.file) {
        const path = `${id}/floor-${Date.now()}.${fp.file.name.split(".").pop()}`;
        await supabase.storage.from("floor-plans").upload(path, fp.file);
        const { data: pub } = supabase.storage.from("floor-plans").getPublicUrl(path);
        await supabase.from("property_floor_plans").insert({ property_id: id, url: pub.publicUrl, label: fp.label });
      }
    }

    // Private notes
    if (privateNotes?.id) {
      await supabase.from("property_private_notes").update({
        owner_bottom_price: formData.owner_bottom_price ? parseFloat(formData.owner_bottom_price) : null,
        reason_for_selling: formData.reason_for_selling || null,
        owner_urgency: formData.owner_urgency || null,
        private_notes: formData.private_notes || null,
      }).eq("id", privateNotes.id);
    } else if (formData.owner_bottom_price || formData.private_notes) {
      await supabase.from("property_private_notes").insert({
        property_id: id,
        agent_id: session.user.id,
        owner_bottom_price: formData.owner_bottom_price ? parseFloat(formData.owner_bottom_price) : null,
        reason_for_selling: formData.reason_for_selling || null,
        owner_urgency: formData.owner_urgency || null,
        private_notes: formData.private_notes || null,
      });
    }

    setSaving(false);
    toast({ title: isDraft ? "Draft saved" : "🎉 Listing updated and live!" });
    navigate("/portal/agent/listings");
  };

  const handleDelete = async () => {
    if (!id) return;
    await supabase.from("property_images").delete().eq("property_id", id);
    await supabase.from("property_private_notes").delete().eq("property_id", id);
    await supabase.from("property_price_history").delete().eq("property_id", id);
    await supabase.from("property_floor_plans").delete().eq("property_id", id);
    await supabase.from("agent_files").update({ property_id: null }).eq("property_id", id);
    await supabase.from("properties").delete().eq("id", id);
    toast({ title: "Listing deleted" });
    navigate("/portal/agent/listings");
  };

  const toggleStatus = async () => {
    if (!id) return;
    const newStatus = formData.status === "active" ? "draft" : "active";
    await supabase.from("properties").update({ status: newStatus }).eq("id", id);
    set("status", newStatus);
    toast({ title: newStatus === "active" ? "Published!" : "Taken down" });
  };

  const stepNames = ["Property Info", "Details & Price", "Photos & Media", "Review & Publish"];

  const StepperInput = ({ label, value, onChange, ...props }: any) => (
    <div>
      <label className="text-sm font-body font-medium text-foreground mb-1 block">{label}</label>
      <Input value={value || ""} onChange={(e: any) => onChange(e.target.value)} {...props} />
    </div>
  );

  const NumStepper = ({ label, value, onChange, max = 20 }: any) => (
    <div>
      <label className="text-sm font-body font-medium text-foreground mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => onChange(Math.max(0, (value || 0) - 1))} className="h-9 w-9"><Minus className="w-3 h-3" /></Button>
        <span className="w-8 text-center font-body font-semibold">{value || 0}</span>
        <Button size="icon" variant="outline" onClick={() => onChange(Math.min(max, (value || 0) + 1))} className="h-9 w-9"><Plus className="w-3 h-3" /></Button>
      </div>
    </div>
  );

  if (loading) return <div className="p-8"><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate("/portal/agent/listings")} className="flex items-center gap-2 text-sm text-muted-foreground font-body hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> My Listings
        </button>
        <h1 className="font-heading text-xl font-bold text-foreground">Edit Listing</h1>
        <Button variant="outline" size="sm" onClick={() => handleSave(true)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Draft"}
        </Button>
      </div>

      {/* Status bar */}
      <div className="bg-card p-4 mx-4 mt-4 rounded-xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-body font-semibold ${formData.status === "active" ? "text-green-600" : "text-muted-foreground"}`}>
            {formData.status === "active" ? "● Live on Website" : "○ Draft — not visible"}
          </span>
        </div>
        <Button size="sm" variant={formData.status === "active" ? "destructive" : "default"} onClick={toggleStatus} className={formData.status !== "active" ? "bg-accent text-accent-foreground" : ""}>
          {formData.status === "active" ? "Take Down" : "Publish Now"}
        </Button>
      </div>

      {/* Steps */}
      <div className="bg-card p-4 mb-6 rounded-xl mx-4 mt-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {stepNames.map((name, i) => (
            <button
              key={i}
              onClick={() => setStep(i + 1)}
              className={`flex items-center gap-2 text-sm font-body ${step === i + 1 ? "text-accent font-semibold" : "text-muted-foreground"}`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === i + 1 ? "bg-accent text-accent-foreground" : "border-2 border-muted-foreground/30"
              }`}>{i + 1}</span>
              <span className="hidden sm:inline">{name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-32">
        {/* Step content — same structure as NewListingPage */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex rounded-xl overflow-hidden border border-border">
              {["sale", "rent"].map((t) => (
                <button key={t} onClick={() => set("transaction_type", t)}
                  className={`flex-1 py-3 text-sm font-body font-semibold transition-colors ${formData.transaction_type === t ? "bg-primary text-accent" : "bg-card text-muted-foreground"}`}>
                  {t === "sale" ? "🏷️ FOR SALE" : "🔑 FOR RENT"}
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-2 block">Property Type *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {propertyTypes.map((t) => (
                  <button key={t} onClick={() => set("property_type", t)}
                    className={`py-2.5 px-3 rounded-lg text-sm font-body font-medium border transition-colors ${formData.property_type === t ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border hover:border-accent/50"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StepperInput label="Property Name" value={formData.property_name} onChange={(v: string) => set("property_name", v)} />
              <StepperInput label="Unit Number" value={formData.unit_number} onChange={(v: string) => set("unit_number", v)} />
              <StepperInput label="Address *" value={formData.address} onChange={(v: string) => set("address", v)} />
              <StepperInput label="Postal Code" value={formData.postal_code} onChange={(v: string) => set("postal_code", v)} maxLength={6} />
              <div>
                <label className="text-sm font-body font-medium text-foreground mb-1 block">District *</label>
                <Select value={formData.district} onValueChange={(v) => set("district", v)}>
                  <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                  <SelectContent>{districtOptions.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <StepperInput label="MRT Station" value={formData.mrt_nearest} onChange={(v: string) => set("mrt_nearest", v)} />
            </div>
            <div>
              <label className="text-sm font-body font-medium text-foreground mb-1 block">Listing Title * ({(formData.title || "").length}/120)</label>
              <Input value={formData.title || ""} onChange={(e) => set("title", e.target.value.slice(0, 120))} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StepperInput label="Size sqft *" value={formData.size_sqft} onChange={(v: string) => set("size_sqft", v)} type="number" />
              <StepperInput label="Floor Level" value={formData.floor_level} onChange={(v: string) => set("floor_level", v)} />
              <StepperInput label="TOP Year" value={formData.top_year} onChange={(v: string) => set("top_year", v)} type="number" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumStepper label="Bedrooms" value={formData.bedrooms} onChange={(v: number) => set("bedrooms", v)} />
              <NumStepper label="Bathrooms" value={formData.bathrooms} onChange={(v: number) => set("bathrooms", v)} />
              <NumStepper label="Car Parks" value={formData.car_parks} onChange={(v: number) => set("car_parks", v)} max={10} />
            </div>
            <div>
              <label className="text-sm font-body font-medium mb-2 block">Tenure</label>
              <div className="flex flex-wrap gap-2">
                {["Freehold", "99-year", "999-year", "Leasehold"].map((t) => (
                  <button key={t} onClick={() => set("tenure", t === formData.tenure ? "" : t)}
                    className={`px-4 py-2 rounded-lg text-sm font-body border ${formData.tenure === t ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-body font-medium mb-2 block">Furnishing</label>
              <div className="flex flex-wrap gap-2">
                {["Unfurnished", "Partial", "Fully Furnished"].map((f) => (
                  <button key={f} onClick={() => set("furnishing", f === formData.furnishing ? "" : f)}
                    className={`px-4 py-2 rounded-lg text-sm font-body border ${formData.furnishing === f ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border"}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-accent/5 rounded-xl p-5">
              <h3 className="font-body font-semibold mb-3">💰 Pricing</h3>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input type="checkbox" checked={formData.price_on_enquiry || false} onChange={(e) => set("price_on_enquiry", e.target.checked)} className="rounded" />
                <span className="text-sm font-body">Price on enquiry</span>
              </label>
              {!formData.price_on_enquiry && (
                formData.transaction_type === "sale" ? (
                  <StepperInput label="Asking Price (SGD)" value={formData.price} onChange={(v: string) => set("price", v)} type="number" />
                ) : (
                  <StepperInput label="Monthly Rental (SGD)" value={formData.monthly_rental} onChange={(v: string) => set("monthly_rental", v)} type="number" />
                )
              )}
              {priceHistory.length > 0 && (
                <Accordion type="single" collapsible className="mt-3">
                  <AccordionItem value="history">
                    <AccordionTrigger className="text-sm font-body">📊 Price History ({priceHistory.length})</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1">
                        {priceHistory.map((h: any) => (
                          <div key={h.id} className="flex justify-between text-xs font-body text-muted-foreground">
                            <span>{new Date(h.changed_at).toLocaleDateString()}</span>
                            <span>{h.old_price ? formatSGD(h.old_price) : "—"} → {h.new_price ? formatSGD(h.new_price) : "—"}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-body font-semibold mb-3">Photos ({photos.length})</h3>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-accent/40 rounded-xl bg-accent/5 h-[140px] flex flex-col items-center justify-center cursor-pointer">
                <Camera className="w-8 h-8 text-accent mb-2" />
                <p className="text-sm font-body text-muted-foreground">Drop photos or click to upload</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img src={p.preview || p.url} alt="" className="w-full h-full object-cover" />
                      {p.is_cover && <span className="absolute top-2 left-2 bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">⭐</span>}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={() => setLightboxUrl(p.preview || p.url)} className="text-white"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => removePhoto(i)} className="text-white"><X className="w-4 h-4" /></button>
                        {!p.is_cover && <button onClick={() => setCover(i)} className="text-white"><Star className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <Input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)} placeholder="Paste image URL..." className="text-sm" />
                <Button size="sm" variant="outline" onClick={() => { if (pasteUrl) { setPhotos(p => [...p, { url: pasteUrl, is_cover: false, preview: pasteUrl }]); setPasteUrl(""); } }}>Add</Button>
              </div>
            </div>
            <StepperInput label="Virtual Tour URL" value={formData.virtual_tour_url} onChange={(v: string) => set("virtual_tour_url", v)} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            {getRequired().length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-body font-semibold text-red-700 mb-2">❌ Cannot publish:</p>
                {getRequired().map((r) => (
                  <button key={r.label} onClick={() => setStep(r.step)} className="block text-sm text-red-600 hover:underline">• {r.label} Fix →</button>
                ))}
              </div>
            )}
            <div>
              <label className="text-sm font-body font-medium mb-1 block">
                📝 Description * <span className={`text-xs ${(formData.description_en || "").length >= 100 ? "text-green-600" : "text-red-500"}`}>({(formData.description_en || "").length}/100 min)</span>
              </label>
              <Textarea rows={8} value={formData.description_en || ""} onChange={(e) => set("description_en", e.target.value)} />
            </div>
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.cobroke_enabled || false} onChange={(e) => set("cobroke_enabled", e.target.checked)} className="rounded" />
                <span className="text-sm font-body font-medium">Open to co-broke</span>
              </label>
              {formData.cobroke_enabled && (
                <StepperInput label="Commission (%)" value={formData.cobroke_commission} onChange={(v: string) => set("cobroke_commission", v)} type="number" className="mt-2" />
              )}
            </div>
            <div className="bg-accent/5 rounded-xl p-4">
              <h3 className="font-body font-semibold mb-3">🔒 Private Notes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StepperInput label="Owner's bottom price" value={formData.owner_bottom_price} onChange={(v: string) => set("owner_bottom_price", v)} type="number" />
                <StepperInput label="Reason for selling" value={formData.reason_for_selling} onChange={(v: string) => set("reason_for_selling", v)} />
              </div>
              <div className="mt-3">
                <label className="text-sm font-body font-medium mb-1 block">Private remarks</label>
                <Textarea rows={3} value={formData.private_notes || ""} onChange={(e) => set("private_notes", e.target.value)} />
              </div>
            </div>

            {/* Delete zone */}
            <div className="border border-destructive/30 rounded-xl p-4">
              <p className="text-sm font-body text-destructive font-semibold">⚠️ Delete this listing permanently?</p>
              <Button variant="destructive" size="sm" className="mt-2" onClick={() => setShowDelete(true)}>Delete Listing</Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card shadow-[0_-4px_12px_rgba(0,0,0,0.08)] p-4 flex items-center justify-between z-50">
        <span className={`text-xs font-body ${getRequired().length === 0 ? "text-green-600" : "text-red-500"}`}>
          {getRequired().length === 0 ? "Ready ✓" : `${getRequired().length} fields needed`}
        </span>
        <div className="flex gap-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>← Back</Button>}
          {step < 4 ? (
            <Button className="bg-accent text-accent-foreground" onClick={() => setStep(step + 1)}>Next →</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>Save Draft</Button>
              <Button className="bg-accent text-accent-foreground" onClick={() => handleSave(false)} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} 🚀 Update & Publish
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
