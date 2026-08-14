import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMarketInsights, buildInsightHref, formatInsightDate, type MarketInsight } from "@/lib/marketInsights";
import { ArrowRight, CalendarDays, FileText, TrendingUp } from "lucide-react";

export default function InsightsPage() {
  const [insights, setInsights] = useState<MarketInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await fetchMarketInsights({ publishedOnly: true });
      if (!mounted) return;
      if (!error) setInsights((data ?? []) as MarketInsight[]);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-cream/50 to-background">
      <section className="container py-16 md:py-20">
        <div className="max-w-3xl space-y-4">
          <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Market Insights</Badge>
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground">
            Trends, updates, and market intelligence
          </h1>
          <p className="font-body text-muted-foreground text-lg">
            Browse the latest market insights, company updates, and industry commentary curated for buyers, sellers, and agents.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-96 rounded-2xl" />)
          ) : insights.length ? (
            insights.map((insight) => (
              <Link
                key={insight.id}
                to={buildInsightHref(insight.id, insight.title)}
                className="group block overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {insight.cover_url ? (
                    <img
                      src={insight.cover_url}
                      alt={insight.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-gold/20">
                      <TrendingUp className="h-10 w-10 text-gold" />
                    </div>
                  )}
                </div>
                <Card className="border-0 shadow-none">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-body text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-gold font-semibold uppercase tracking-wider">
                        <FileText className="h-3.5 w-3.5" />
                        {insight.category ?? "Insight"}
                      </span>
                      {insight.is_featured && (
                        <span className="rounded-full bg-gold/10 px-2.5 py-1 text-gold font-semibold uppercase tracking-wider">
                          Featured
                        </span>
                      )}
                      {insight.period && <span>{insight.period}</span>}
                      {insight.read_time && <span>{insight.read_time}</span>}
                    </div>
                    <h2 className="font-heading text-xl font-bold text-foreground group-hover:text-gold transition-colors">
                      {insight.title}
                    </h2>
                    <p className="line-clamp-3 font-body text-sm text-muted-foreground">
                      {insight.description || "A market update from the Heng Fatt team."}
                    </p>
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <span className="inline-flex items-center gap-1 text-xs font-body text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatInsightDate(insight.published_at)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-body font-medium text-gold">
                        Read more
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center">
              <p className="font-heading text-2xl font-bold text-foreground">No market insights yet</p>
              <p className="mt-2 font-body text-sm text-muted-foreground">
                We will post company and industry updates here once the admin team adds them.
              </p>
              <Button asChild className="mt-6 bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
                <Link to="/contact">Contact Us</Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
