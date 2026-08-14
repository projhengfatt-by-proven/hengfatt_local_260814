import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildInsightHref, extractInsightId, fetchMarketInsights, formatInsightDate, type MarketInsight } from "@/lib/marketInsights";
import { ArrowLeft, CalendarDays, ExternalLink, FileText } from "lucide-react";

export default function InsightDetailPage() {
  const { slug } = useParams();
  const insightId = extractInsightId(slug);
  const [insight, setInsight] = useState<MarketInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await fetchMarketInsights({ publishedOnly: true });
      if (!mounted) return;
      if (!error) {
        const found = (data ?? []).find((item) => item.id === insightId) ?? null;
        setInsight(found as MarketInsight | null);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [insightId]);

  if (loading) {
    return (
      <div className="container py-16">
        <Skeleton className="h-[70vh] rounded-3xl" />
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="container py-16">
        <Card className="border-border/70">
          <CardContent className="p-10 text-center space-y-4">
            <p className="font-heading text-2xl font-bold text-foreground">Insight not found</p>
            <p className="font-body text-muted-foreground">This market insight may have been removed or is still in draft.</p>
            <Button asChild className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
              <Link to="/insights">Back to Insights</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10 md:py-16">
      <Button variant="ghost" asChild className="mb-6 px-0 text-gold hover:text-gold-dark">
        <Link to="/insights" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Insights
        </Link>
      </Button>

      <Card className="overflow-hidden border-border/70 shadow-card">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="min-h-[280px] bg-muted">
            {insight.cover_url ? (
              <img src={insight.cover_url} alt={insight.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center bg-gradient-to-br from-primary/10 to-gold/20">
                <FileText className="h-16 w-16 text-gold" />
              </div>
            )}
          </div>

          <CardContent className="space-y-5 p-6 md:p-8">
            <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Market Insight</Badge>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
              {insight.title}
            </h1>
            <div className="flex flex-wrap gap-3 text-sm font-body text-muted-foreground">
              {insight.period && <span>{insight.period}</span>}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                {formatInsightDate(insight.published_at)}
              </span>
            </div>
            <p className="font-body text-base leading-7 text-foreground/80">
              {insight.description || "A market update from the Heng Fatt team."}
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
                <a href={insight.file_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open report
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link to={buildInsightHref(insight.id, insight.title)}>
                  Share link
                </Link>
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}

