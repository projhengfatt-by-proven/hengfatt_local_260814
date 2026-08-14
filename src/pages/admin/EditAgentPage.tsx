import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronRight, Loader2, Upload, X } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const SPECIALISATION_OPTIONS = ["HDB", "Condo", "Landed", "Commercial", "New Launch", "Investment"];
const LANGUAGE_OPTIONS = ["English", "Mandarin", "Malay", "Tamil", "Cantonese", "Hokkien", "Japanese"];
const CEA_REGEX = /^R\d{6}[A-Z]$/;

async function logActivity(
  action: string,
  targetId: string,
  targetName: string | null,
  changes: Record<string, unknown> | null
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("admin_activity_log").insert({
    admin_id: user.id,
    action,
    target_type: "agent",
    target_id: targetId,
    target_name: targetName,
    changes: changes as any,
  });
}

export default function EditAgentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phone, setPhone] = useState("");

  // Agent fields
  const [ceaNo, setCeaNo] = useState("");
  const [ceaError, setCeaError] = useState("");
  const [position, setPosition] = useState("");
  const [agentType, setAgentType] = useState<"internal" | "external">("external");
  const [yearsExp, setYearsExp] = useState<number | "">(0);
  const [specialisations, setSpecialisations] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [whatsappNo, setWhatsappNo] = useState("");
  const [emailDisplay, setEmailDisplay] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [bioEn, setBioEn] = useState("");
  const [bioZh, setBioZh] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<number | "">(99);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("*, profiles(full_name, avatar_url, phone)")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) {
        toast({ title: "Agent not found", variant: "destructive" });
        navigate("/admin/agents");
        return;
      }

      setFullName(data.profiles?.full_name ?? "");
      setAvatarUrl(data.profiles?.avatar_url ?? "");
      setPhone(data.profiles?.phone ?? "");
      setCeaNo(data.cea_no ?? "");
      setPosition(data.position ?? "");
      setAgentType((data.agent_type as any) ?? "external");
      setYearsExp(data.years_experience ?? 0);
      setSpecialisations(data.specialisations ?? []);
      setLanguages(data.languages ?? []);
      setWhatsappNo(data.whatsapp_no ?? "");
      setEmailDisplay(data.email_display ?? "");
      setLinkedinUrl(data.linkedin_url ?? "");
      setBioEn(data.bio_en ?? "");
      setBioZh(data.bio_zh ?? "");
      setIsPublished(data.is_published ?? false);
      setIsFeatured(data.is_featured ?? false);
      setDisplayOrder(data.display_order ?? 99);
      setLoading(false);
    }
    load();
  }, [id, navigate]);

  function togglePill(list: string[], value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function validateCea(value: string) {
    setCeaNo(value);
    if (value && !CEA_REGEX.test(value)) {
      setCeaError("Format: R followed by 6 digits and 1 letter (e.g. R012345A)");
    } else {
      setCeaError("");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (ceaNo && !CEA_REGEX.test(ceaNo)) {
      toast({ title: "Invalid CEA No.", variant: "destructive" });
      return;
    }

    setSaving(true);

    // Update profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), avatar_url: avatarUrl.trim() || null, phone: phone.trim() || null })
      .eq("id", id);

    if (profileError) {
      toast({ title: "Error updating profile", description: profileError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Update agent_profiles table
    const agentUpdate = {
      cea_no: ceaNo.trim() || "PENDING",
      position: position.trim() || null,
      agent_type: agentType,
      years_experience: yearsExp === "" ? 0 : Number(yearsExp),
      specialisations,
      languages,
      whatsapp_no: whatsappNo.trim() || null,
      email_display: emailDisplay.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      bio_en: bioEn.trim() || null,
      bio_zh: bioZh.trim() || null,
      is_published: isPublished,
      is_featured: agentType === "internal" ? isFeatured : false,
      display_order: displayOrder === "" ? 99 : Number(displayOrder),
    };

    const { error: agentError } = await supabase
      .from("agent_profiles")
      .update(agentUpdate)
      .eq("id", id);

    if (agentError) {
      toast({ title: "Error updating agent", description: agentError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    await logActivity("Agent profile updated", id, fullName, agentUpdate);

    toast({ title: "Agent updated successfully" });
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm font-body text-muted-foreground mb-6">
        <Link to="/admin" className="hover:text-foreground transition-colors">Admin</Link>
        <ChevronRight className="w-4 h-4" />
        <Link to="/admin/agents" className="hover:text-foreground transition-colors">Agents</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium">Edit</span>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <Link to="/admin/agents" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
          Edit Agent — {fullName}
        </h1>
      </div>

      <form onSubmit={handleSave} className="space-y-10">
        {/* Profile */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-2">Profile</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Avatar / Photo</Label>
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="bg-gold/10 text-gold text-lg font-semibold">
                    {fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !id) return;
                      const ext = file.name.split(".").pop();
                      const path = `${id}/avatar.${ext}`;
                      const { error } = await supabase.storage.from("agent-avatars").upload(path, file, { upsert: true });
                      if (error) {
                        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
                        return;
                      }
                      const { data: urlData } = supabase.storage.from("agent-avatars").getPublicUrl(path);
                      setAvatarUrl(urlData.publicUrl + "?t=" + Date.now());
                      toast({ title: "Photo uploaded" });
                    }} />
                    <button type="button" onClick={() => avatarInputRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-body font-medium hover:bg-muted transition-colors">
                      <Upload className="w-4 h-4" />
                      Choose Photo
                    </button>
                    {avatarUrl && (
                      <button type="button" onClick={() => setAvatarUrl("")} className="p-2 rounded-lg border border-border hover:bg-muted transition-colors">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Or paste image URL (https://...)" className="text-xs" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Agent Details */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-2">Agent Details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CEA No.</Label>
              <Input value={ceaNo} onChange={(e) => validateCea(e.target.value.toUpperCase())} className={cn(ceaError && "border-destructive")} />
              {ceaError && <p className="text-xs text-destructive">{ceaError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Senior Associate" />
            </div>
            <div className="space-y-2">
              <Label>Agent Type</Label>
              <div className="flex gap-2">
                {(["internal", "external"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setAgentType(t)}
                    className={cn("px-4 py-2 rounded-lg text-sm font-body font-medium transition-all border capitalize",
                      agentType === t ? "bg-gold text-primary border-gold" : "border-border text-muted-foreground hover:border-gold/50"
                    )}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Years of Experience</Label>
              <Input type="number" min={0} max={50} value={yearsExp} onChange={(e) => setYearsExp(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>

          {/* Specialisations */}
          <div className="space-y-2">
            <Label>Specialisations</Label>
            <div className="flex flex-wrap gap-2">
              {SPECIALISATION_OPTIONS.map((s) => (
                <button key={s} type="button" onClick={() => togglePill(specialisations, s, setSpecialisations)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all border",
                    specialisations.includes(s) ? "bg-gold text-primary border-gold shadow-sm" : "border-border text-muted-foreground hover:border-gold/50"
                  )}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div className="space-y-2">
            <Label>Languages</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((l) => (
                <button key={l} type="button" onClick={() => togglePill(languages, l, setLanguages)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all border",
                    languages.includes(l) ? "bg-gold text-primary border-gold shadow-sm" : "border-border text-muted-foreground hover:border-gold/50"
                  )}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <Input value={whatsappNo} onChange={(e) => setWhatsappNo(e.target.value)} placeholder="+65 9xxx xxxx" />
            </div>
            <div className="space-y-2">
              <Label>Display Email</Label>
              <Input value={emailDisplay} onChange={(e) => setEmailDisplay(e.target.value)} placeholder="john@agency.com" />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input type="number" min={0} value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>
        </section>

        {/* Bios */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-2">Biography</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Bio (English)</Label>
              <span className="text-xs text-muted-foreground">{bioEn.length}/500</span>
            </div>
            <Textarea value={bioEn} onChange={(e) => setBioEn(e.target.value.slice(0, 500))} rows={4} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Bio (中文)</Label>
              <span className="text-xs text-muted-foreground">{bioZh.length}/500</span>
            </div>
            <Textarea value={bioZh} onChange={(e) => setBioZh(e.target.value.slice(0, 500))} rows={4} />
          </div>
        </section>

        {/* Visibility */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-2">Visibility</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body font-medium text-foreground text-sm">Show on /team page</p>
                <p className="font-body text-xs text-muted-foreground">Agent will appear on the public team page</p>
              </div>
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body font-medium text-foreground text-sm">Show on Homepage</p>
                <p className="font-body text-xs text-muted-foreground">
                  {agentType === "internal" ? "Agent will appear in the homepage team section" : "Only available for internal agents"}
                </p>
              </div>
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} disabled={agentType !== "internal"} />
            </div>
          </div>
        </section>

        <Button type="submit" disabled={saving}
          className="w-full sm:w-auto bg-gold hover:bg-gold-dark text-primary font-body font-semibold text-base py-6 px-10 rounded-lg shadow-gold transition-all duration-300">
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /><span className="ml-2">Saving…</span></>
          ) : (
            "Save Changes"
          )}
        </Button>
      </form>
    </div>
  );
}
