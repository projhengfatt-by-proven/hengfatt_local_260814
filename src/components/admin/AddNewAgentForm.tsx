import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, ShieldCheck } from "lucide-react";

const SPECIALISATION_OPTIONS = ["HDB", "Condo", "Landed", "Commercial", "New Launch", "Investment"];
const LANGUAGE_OPTIONS = ["English", "Mandarin", "Malay", "Tamil", "Cantonese", "Hokkien", "Japanese"];

const CEA_REGEX = /^R\d{6}[A-Z]$/;

export default function AddNewAgentForm() {
  const [loading, setLoading] = useState(false);

  // Section A — profiles
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredLang, setPreferredLang] = useState<"en" | "zh">("en");

  // Section B — agent_profiles
  const [ceaNo, setCeaNo] = useState("");
  const [yearsExp, setYearsExp] = useState<number | "">("");
  const [agentType, setAgentType] = useState<"internal" | "external">("external");
  const [position, setPosition] = useState("");
  const [specialisations, setSpecialisations] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState<number | "">(99);

  // Section C — bios
  const [bioEn, setBioEn] = useState("");
  const [bioZh, setBioZh] = useState("");

  // Validation
  const [ceaError, setCeaError] = useState("");

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      toast({ title: "Missing fields", description: "Full Name, Email and Phone are required.", variant: "destructive" });
      return;
    }
    if (ceaNo && !CEA_REGEX.test(ceaNo)) {
      toast({ title: "Invalid CEA No.", description: "Please correct the CEA Registration Number.", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.functions.invoke("send-agent-invite", {
      body: {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        preferred_lang: preferredLang,
        cea_no: ceaNo.trim() || null,
        years_experience: yearsExp === "" ? null : Number(yearsExp),
        agent_type: agentType,
        position: position.trim() || null,
        specialisations,
        languages,
        linkedin_url: linkedinUrl.trim() || null,
        display_order: displayOrder === "" ? 99 : Number(displayOrder),
        bio_en: bioEn.trim() || null,
        bio_zh: bioZh.trim() || null,
      },
    });

    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    if (data?.error) {
      toast({ title: "Error", description: data.error, variant: "destructive" });
      return;
    }

    toast({ title: "Agent invited!", description: `An invite email has been sent to ${email}.` });

    // Reset form
    setFullName(""); setEmail(""); setPhone(""); setPreferredLang("en");
    setCeaNo(""); setYearsExp(""); setAgentType("external"); setPosition("");
    setSpecialisations([]); setLanguages(["English"]);
    setLinkedinUrl(""); setDisplayOrder(99); setBioEn(""); setBioZh("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* ── Section A: Profile ── */}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-2">
          A. Profile Details
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Tan" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agentEmail">Email *</Label>
            <Input id="agentEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@agency.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agentPhone">Phone *</Label>
            <Input id="agentPhone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+65 9123 4567" />
          </div>
          <div className="space-y-2">
            <Label>Preferred Language</Label>
            <div className="flex gap-2">
              {(["en", "zh"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setPreferredLang(lang)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-body font-medium transition-all border",
                    preferredLang === lang
                      ? "bg-gold text-primary border-gold"
                      : "border-border text-muted-foreground hover:border-gold/50"
                  )}
                >
                  {lang === "en" ? "English" : "中文"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section B: Agent Profile ── */}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-2">
          B. Agent Profile
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ceaNo">CEA Registration No.</Label>
            <Input
              id="ceaNo"
              value={ceaNo}
              onChange={(e) => validateCea(e.target.value.toUpperCase())}
              placeholder="R012345A"
              className={cn(ceaError && "border-destructive")}
            />
            {ceaError && <p className="text-xs text-destructive font-body">{ceaError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="yearsExp">Years of Experience</Label>
            <Input
              id="yearsExp"
              type="number"
              min={0}
              max={50}
              value={yearsExp}
              onChange={(e) => setYearsExp(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="5"
            />
          </div>
          <div className="space-y-2">
            <Label>Agent Type</Label>
            <div className="flex gap-2">
              {(["internal", "external"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAgentType(t)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-body font-medium transition-all border capitalize",
                    agentType === t
                      ? "bg-gold text-primary border-gold"
                      : "border-border text-muted-foreground hover:border-gold/50"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Input
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Senior Associate"
            />
          </div>
        </div>

        {/* Specialisations */}
        <div className="space-y-2">
          <Label>Specialisations</Label>
          <div className="flex flex-wrap gap-2">
            {SPECIALISATION_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => togglePill(specialisations, s, setSpecialisations)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all border",
                  specialisations.includes(s)
                    ? "bg-gold text-primary border-gold shadow-sm"
                    : "border-border text-muted-foreground hover:border-gold/50"
                )}
              >
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
              <button
                key={l}
                type="button"
                onClick={() => togglePill(languages, l, setLanguages)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all border",
                  languages.includes(l)
                    ? "bg-gold text-primary border-gold shadow-sm"
                    : "border-border text-muted-foreground hover:border-gold/50"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
            <Input
              id="linkedinUrl"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/johndoe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayOrder">Display Order</Label>
            <Input
              id="displayOrder"
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="99"
            />
          </div>
        </div>
      </section>

      {/* ── Section C: Bios ── */}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-2">
          C. Biography (Optional)
        </h2>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="bioEn">Bio (English)</Label>
            <span className="text-xs text-muted-foreground font-body">{bioEn.length}/500</span>
          </div>
          <Textarea
            id="bioEn"
            value={bioEn}
            onChange={(e) => setBioEn(e.target.value.slice(0, 500))}
            placeholder="A short professional bio…"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="bioZh">Bio (中文)</Label>
            <span className="text-xs text-muted-foreground font-body">{bioZh.length}/500</span>
          </div>
          <Textarea
            id="bioZh"
            value={bioZh}
            onChange={(e) => setBioZh(e.target.value.slice(0, 500))}
            placeholder="简短的专业简介…"
            rows={4}
          />
        </div>
      </section>

      {/* ── Section D: Role ── */}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-foreground border-b border-border pb-2">
          D. Role Assignment
        </h2>
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-gold" />
          <Badge variant="secondary" className="bg-gold/10 text-gold border-gold/30 font-body text-sm px-3 py-1">
            Agent
          </Badge>
          <span className="text-xs text-muted-foreground font-body">Automatically assigned — not editable</span>
        </div>
      </section>

      {/* Submit */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto bg-gold hover:bg-gold-dark text-primary font-body font-semibold text-base py-6 px-10 rounded-lg shadow-gold transition-all duration-300"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="ml-2">Creating…</span>
          </>
        ) : (
          "Create Agent & Send Invite"
        )}
      </Button>
    </form>
  );
}
