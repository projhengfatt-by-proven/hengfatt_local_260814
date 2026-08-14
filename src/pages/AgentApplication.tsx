import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const SPECIALISATION_OPTIONS = [
  "HDB Resale",
  "Private Residential",
  "New Launches",
  "Landed Properties",
  "Commercial",
  "Investment Properties",
  "Rental",
];

export default function AgentApplication() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    cea_no: "",
    nric_last4: "",
    current_agency: "",
    years_of_experience: "",
    specialisations: [] as string[],
    portfolio_url: "",
    short_bio: "",
    message: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.from("agent_applications").insert({
      full_name: form.full_name,
      phone: form.phone,
      email: form.email,
      cea_no: form.cea_no || null,
      nric_last4: form.nric_last4 || null,
      current_agency: form.current_agency || null,
      years_of_experience: form.years_of_experience ? Number(form.years_of_experience) : null,
      specialisations: form.specialisations.length > 0 ? form.specialisations : null,
      portfolio_url: form.portfolio_url || null,
      short_bio: form.short_bio || null,
      message: form.message || null,
    });

    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: "Could not submit application. Please try again.", variant: "destructive" });
      return;
    }

    toast({ title: "Application Submitted", description: "Thank you! We'll review your application and get back to you shortly." });
    navigate("/");
  }

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSpecialisation(spec: string) {
    setForm((prev) => ({
      ...prev,
      specialisations: prev.specialisations.includes(spec)
        ? prev.specialisations.filter((s) => s !== spec)
        : [...prev.specialisations, spec],
    }));
  }

  return (
    <div className="min-h-[60vh] py-16">
      <div className="container max-w-xl">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
          Join Our Team
        </h1>
        <p className="font-body text-muted-foreground mb-8">
          Submit your application to become a Heng Fatt Property specialist.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input id="full_name" required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="As per NRIC" />
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+65 9123 4567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
            </div>
          </div>

          {/* CEA & NRIC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cea_no">CEA Reg. No.</Label>
              <Input id="cea_no" value={form.cea_no} onChange={(e) => update("cea_no", e.target.value)} placeholder="R012345A" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nric_last4">NRIC Last 4 Characters</Label>
              <Input id="nric_last4" value={form.nric_last4} onChange={(e) => update("nric_last4", e.target.value)} maxLength={4} placeholder="123A" />
            </div>
          </div>

          {/* Current Agency & Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_agency">Current Agency</Label>
              <Input id="current_agency" value={form.current_agency} onChange={(e) => update("current_agency", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="years_of_experience">Years of Experience</Label>
              <Input id="years_of_experience" type="number" min={0} value={form.years_of_experience} onChange={(e) => update("years_of_experience", e.target.value)} />
            </div>
          </div>

          {/* Specialisations */}
          <div className="space-y-3">
            <Label>Specialisations</Label>
            <div className="grid grid-cols-2 gap-2">
              {SPECIALISATION_OPTIONS.map((spec) => (
                <label key={spec} className="flex items-center gap-2 cursor-pointer text-sm font-body text-foreground">
                  <Checkbox
                    checked={form.specialisations.includes(spec)}
                    onCheckedChange={() => toggleSpecialisation(spec)}
                  />
                  {spec}
                </label>
              ))}
            </div>
          </div>

          {/* Portfolio URL */}
          <div className="space-y-2">
            <Label htmlFor="portfolio_url">Portfolio / Website URL</Label>
            <Input id="portfolio_url" type="url" value={form.portfolio_url} onChange={(e) => update("portfolio_url", e.target.value)} placeholder="https://your-site.com" />
          </div>

          {/* Short Bio */}
          <div className="space-y-2">
            <Label htmlFor="short_bio">Short Bio</Label>
            <Textarea id="short_bio" rows={3} value={form.short_bio} onChange={(e) => update("short_bio", e.target.value)} placeholder="Tell us about your specialisations and experience" />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Additional Message</Label>
            <Textarea id="message" rows={2} value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Anything else you'd like us to know?" />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#C6A75E] hover:bg-[#D4B46A] text-[#0B1C2D] font-body font-semibold text-base py-6 rounded-lg border-none shadow-[0_4px_14px_rgba(0,0,0,0.25)] hover:shadow-[0_6px_18px_rgba(198,167,94,0.35)] transition-all duration-300 ease-in-out"
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </Button>
        </form>
      </div>
    </div>
  );
}
