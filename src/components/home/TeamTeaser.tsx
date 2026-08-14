import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type FeaturedAgent = {
  id: string;
  specialisations: string[];
  languages: string[];
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function TeamTeaser() {
  const [agents, setAgents] = useState<FeaturedAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("agent_profiles")
        .select("id, specialisations, languages, profiles(full_name, avatar_url)")
        .eq("is_featured", true)
        .eq("is_published", true)
        .order("display_order", { ascending: true })
        .limit(6);
      setAgents((data as any) ?? []);
      setLoading(false);
    }
    fetch();
  }, []);

  return (
    <section className="py-20 bg-background">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
            Our Specialists
          </h2>
          <p className="font-body text-muted-foreground mt-2">
            Experience meets personal touch
          </p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="w-32 h-32 mx-auto rounded-full mb-4" />
                <Skeleton className="h-5 w-24 mx-auto mb-2" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* No featured agents */}
        {!loading && agents.length === 0 && (
          <div className="text-center py-8">
            <p className="font-body text-muted-foreground">Meet our growing team of specialists.</p>
          </div>
        )}

        {/* Featured agents from DB */}
        {!loading && agents.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {agents.slice(0, 3).map((agent) => (
              <div key={agent.id} className="text-center group">
                <div className="w-32 h-32 mx-auto rounded-full overflow-hidden mb-4 ring-2 ring-gold/20 group-hover:ring-gold/60 transition-all">
                  {agent.profiles?.avatar_url ? (
                    <img
                      src={agent.profiles.avatar_url}
                      alt={agent.profiles.full_name ?? "Agent"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gold/10 flex items-center justify-center text-gold font-heading text-2xl font-bold">
                      {(agent.profiles?.full_name ?? "?")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                  )}
                </div>
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {agent.profiles?.full_name ?? "—"}
                </h3>
                <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                  {(agent.specialisations ?? []).map((s) => (
                    <span
                      key={s}
                      className="text-xs font-body bg-gold/10 text-gold-dark px-2 py-0.5 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="text-xs font-body text-muted-foreground mt-2">
                  {(agent.languages ?? []).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            to="/team"
            className="font-body text-sm font-medium text-gold hover:text-gold-dark transition-colors"
          >
            Meet the Full Team →
          </Link>
        </div>

        <div className="mt-6 max-w-md mx-auto">
          <Link
            to="/apply"
            onClick={() => window.scrollTo(0, 0)}
            className="block w-full text-center bg-gold hover:bg-gold-dark text-primary font-body font-semibold text-base px-8 py-3.5 rounded-lg shadow-gold hover:shadow-elevated transition-all duration-300"
          >
            Join Us
          </Link>
        </div>
      </div>
    </section>
  );
}
