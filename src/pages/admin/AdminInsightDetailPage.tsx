import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { buildInsightHref, fetchMarketInsights, formatInsightDate, type MarketInsight } from "@/lib/marketInsights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CalendarDays, Edit3, ExternalLink, FileText } from "lucide-react";

function renderInsightBody(body: string | null) {
  if (!body) return null;

  const blocks = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const isBulletList = lines.length > 1 && lines.every((line) => line.startsWith("- "));

    if (isBulletList) {
      return (
        <ul key={index} className="space-y-2">
          {lines.map((line, bulletIndex) => (
            <li key={bulletIndex} className="flex gap-3 font-body text-base leading-7 text-foreground/80">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{line.replace(/^- /, "")}</span>
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={index} className="font-body text-base leading-7 text-foreground/80 whitespace-pre-line">
        {block}
      </p>
    );
  });
}

export default function AdminInsightDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [insight, setInsight] = useState<MarketInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await fetchMarketInsights();
      if (!mounted) return;
      if (error) {
        toast({ title: "Could not load market insight", description: error.message, variant: "destructive" });
      } else {
        const found = (data ?? []).find((item) => item.id === id) ?? null;
        setInsight(found as MarketInsight | null);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 sm:p-8 max-w-5xl">
        <Skeleton className="h-[70vh] rounded-3xl" />
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="p-6 sm:p-8 max-w-5xl">
        <Card className="border-border/70">
          <CardContent className="p-10 text-center space-y-4">
            <p className="font-heading text-2xl font-bold text-foreground">Insight not found</p>
            <p className="font-body text-muted-foreground">This insight may have been removed or is still missing from the database.</p>
            <Button asChild className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
              <Link to="/admin/insights">Back to list</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl space-y-6">
      <Button variant="ghost" asChild className="px-0 text-gold hover:text-gold-dark">
        <Link to="/admin/insights" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to list
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
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-gold/10 text-gold border-gold/30 font-body">
                {insight.category ?? "Market Insight"}
              </Badge>
              {insight.read_time && (
                <Badge variant="outline" className="font-body">
                  {insight.read_time}
                </Badge>
              )}
              <Badge variant="outline" className="font-body capitalize">
                {insight.published_at ? "Published" : "Draft"}
              </Badge>
            </div>
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
            {renderInsightBody(insight.body)}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
                <Link to={`/admin/insights?edit=${insight.id}`}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit insight
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={buildInsightHref(insight.id, insight.title)} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open public page
                </Link>
              </Button>
              {insight.file_url && (
                <Button variant="ghost" asChild>
                  <a href={insight.file_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open source
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => navigate("/admin/insights")}>
          Back to list
        </Button>
      </div>
    </div>
  );
}
