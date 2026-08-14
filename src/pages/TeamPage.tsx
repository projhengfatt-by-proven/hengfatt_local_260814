import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Phone } from "lucide-react";

type AgentDisplay = {
  id: string;
  position: string | null;
  agent_type: string | null;
  bio_en: string | null;
  specialisations: string[];
  languages: string[];
  whatsapp_no: string | null;
  email_display: string | null;
  cea_no: string;
  years_experience: number | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export default function TeamPage() {
  const [agents, setAgents] = useState<AgentDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("agent_profiles")
        .select("id, position, agent_type, bio_en, specialisations, languages, whatsapp_no, email_display, cea_no, years_experience, profiles(full_name, avatar_url)")
        .eq("is_published", true)
        .order("display_order", { ascending: true });
      setAgents((data as any) ?? []);
      setLoading(false);
    }
    fetch();
  }, []);

  const internal = agents.filter((a) => a.agent_type === "internal");
  const external = agents.filter((a) => a.agent_type !== "internal");

  const initials = (name: string | null) =>
    (name ?? "??").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  function AgentCard({ agent, index }: { agent: AgentDisplay; index: number }) {
    const isEven = index % 2 === 0;
    return (
      <div className={`flex flex-col md:flex-row ${!isEven ? "md:flex-row-reverse" : ""} gap-8 items-center py-10 border-b border-border last:border-b-0`}>
        {/* Photo */}
        <div className="w-48 h-48 md:w-56 md:h-56 shrink-0">
          <Avatar className="w-full h-full rounded-2xl">
            <AvatarImage src={agent.profiles?.avatar_url ?? undefined} className="object-cover" />
            <AvatarFallback className="rounded-2xl bg-gold/10 text-gold text-3xl font-heading font-bold">
              {initials(agent.profiles?.full_name ?? null)}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Info */}
        <div className={`flex-1 ${!isEven ? "md:text-right" : ""}`}>
          <h3 className="font-heading text-2xl font-bold text-foreground">
            {agent.profiles?.full_name ?? "—"}
          </h3>
          {agent.position && (
            <p className="font-body text-sm text-gold font-medium mt-1">{agent.position}</p>
          )}
          <p className="font-body text-xs text-muted-foreground mt-1">
            CEA: {agent.cea_no} {agent.years_experience ? `· ${agent.years_experience} years` : ""}
          </p>

          {agent.bio_en && (
            <p className="font-body text-sm text-muted-foreground mt-3 max-w-lg leading-relaxed">
              {agent.bio_en}
            </p>
          )}

          {agent.specialisations.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 mt-3 ${!isEven ? "md:justify-end" : ""}`}>
              {agent.specialisations.map((s) => (
                <Badge key={s} variant="outline" className="font-body text-xs bg-gold/10 text-gold-dark border-gold/20">
                  {s}
                </Badge>
              ))}
            </div>
          )}

          {agent.languages.length > 0 && (
            <p className="font-body text-xs text-muted-foreground mt-2">
              {agent.languages.join(" · ")}
            </p>
          )}

          {agent.whatsapp_no && (
            <a
              href={`https://wa.me/${agent.whatsapp_no.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 mt-3 text-sm font-body font-medium text-gold hover:text-gold-dark transition-colors ${!isEven ? "md:justify-end" : ""}`}
            >
              <Phone className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh]">
      {/* Hero */}
      <section className="py-16 text-center">
        <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground">Our Specialists</h1>
        <p className="font-body text-muted-foreground mt-3 max-w-lg mx-auto">
          Meet the team dedicated to helping you navigate Singapore's property market with confidence.
        </p>
      </section>

      <div className="container max-w-4xl pb-20">
        {loading && (
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-8 items-center">
                <Skeleton className="w-48 h-48 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && agents.length === 0 && (
          <div className="text-center py-20">
            <p className="font-body text-muted-foreground">Our team page is being updated. Check back soon!</p>
          </div>
        )}

        {!loading && internal.length > 0 && (
          <div className="mb-12">
            <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Our Team</h2>
            <p className="font-body text-sm text-muted-foreground mb-6">In-house specialists leading the way</p>
            {internal.map((agent, i) => (
              <AgentCard key={agent.id} agent={agent} index={i} />
            ))}
          </div>
        )}

        {!loading && external.length > 0 && (
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Associate Agents</h2>
            <p className="font-body text-sm text-muted-foreground mb-6">Trusted partners in our network</p>
            {external.map((agent, i) => (
              <AgentCard key={agent.id} agent={agent} index={i} />
            ))}
          </div>
        )}

        {/* Join CTA */}
        <div className="mt-16 text-center">
          <Link
            to="/apply"
            onClick={() => window.scrollTo(0, 0)}
            className="inline-block bg-gold hover:bg-gold-dark text-primary font-body font-semibold text-base px-8 py-3.5 rounded-lg shadow-gold hover:shadow-elevated transition-all duration-300"
          >
            Join Our Team
          </Link>
        </div>
      </div>
    </div>
  );
}
