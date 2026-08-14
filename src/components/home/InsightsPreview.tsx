import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { buildInsightHref, fetchMarketInsights, formatInsightDate, type MarketInsight } from "@/lib/marketInsights";
import { ArrowRight, CalendarDays, FileText, TrendingUp } from "lucide-react";

export function InsightsPreview() {
  const [articles, setArticles] = useState<MarketInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await fetchMarketInsights({ publishedOnly: true });
      if (!mounted) return;
      setArticles((data ?? []).slice(0, 3) as MarketInsight[]);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="py-20 bg-cream-dark">
      <div className="container">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
              Market Insights
            </h2>
            <p className="font-body text-muted-foreground mt-2">
              Expert analysis from our team
            </p>
          </div>
          <Link
            to="/insights"
            className="hidden md:inline-flex font-body text-sm font-medium text-gold hover:text-gold-dark transition-colors items-center"
          >
            View All Insights <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-96 rounded-lg" />)
          ) : articles.length ? (
            articles.map((article) => (
              <Link
                key={article.id}
                to={buildInsightHref(article.id, article.title)}
                className="group bg-card rounded-lg overflow-hidden shadow-card hover:shadow-elevated transition-all duration-300"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {article.cover_url ? (
                    <img
                      src={article.cover_url}
                      alt={article.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-gold/20">
                      <TrendingUp className="h-10 w-10 text-gold" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-body font-semibold uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1 text-gold">
                      <FileText className="h-3.5 w-3.5" />
                      {article.category ?? "Market Insight"}
                    </span>
                    {article.is_featured && (
                      <span className="rounded-full bg-gold/10 px-2.5 py-1 text-gold">Featured</span>
                    )}
                    {article.read_time && <span className="text-muted-foreground normal-case tracking-normal">{article.read_time}</span>}
                  </div>
                  <h3 className="font-heading text-lg font-bold text-foreground mt-2 mb-2 line-clamp-2 group-hover:text-gold transition-colors">
                    {article.title}
                  </h3>
                  <p className="font-body text-sm text-muted-foreground line-clamp-2 mb-3">
                    {article.description || "A market update from the Heng Fatt team."}
                  </p>
                  <p className="text-xs font-body text-muted-foreground inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatInsightDate(article.published_at)}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="md:col-span-3 rounded-lg border border-dashed border-border/70 bg-card p-8 text-center">
              <p className="font-body text-sm text-muted-foreground">No market insights have been published yet.</p>
            </div>
          )}
        </div>

        <div className="md:hidden text-center mt-8">
          <Link
            to="/insights"
            className="font-body text-sm font-medium text-gold hover:text-gold-dark transition-colors inline-flex items-center"
          >
            View All Insights <ArrowRight className="ml-1 inline h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
