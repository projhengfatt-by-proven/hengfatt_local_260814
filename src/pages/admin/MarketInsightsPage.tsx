import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  buildInsightHref,
  emptyMarketInsightForm,
  fetchMarketInsights,
  formatInsightDate,
  saveMarketInsight,
  type MarketInsight,
  type MarketInsightForm,
} from "@/lib/marketInsights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Edit3, ExternalLink, Plus, Save } from "lucide-react";

const SINGAPORE_LUXURY_MARKET_TEMPLATE: MarketInsightForm = {
  title: "Singapore Luxury Property Market 2026: Why the Prime Market Is Regaining Momentum",
  category: "MARKET OUTLOOK",
  description:
    "Singapore's luxury residential market is showing renewed strength in 2026, with prime Core Central Region properties outperforming the wider private housing market.",
  body:
    "Singapore's luxury residential market is entering a more interesting phase in 2026.\n\n" +
    "The headline Singapore property market remains relatively moderate, but the numbers become considerably more interesting when the market is separated by location and property type.\n\n" +
    "In Q2 2026, Singapore's overall private residential price index increased 0.5% quarter-on-quarter, following a 0.9% increase in Q1. That brought price growth for the first half of 2026 to 1.4%.\n\n" +
    "But the prime market performed considerably better.\n\n" +
    "Non-landed properties in the Core Central Region (CCR) increased 1.8% in Q2, compared with declines of 1.2% in the RCR and 0.1% in the OCR.\n\n" +
    "That divergence is important.\n\n" +
    "Prime property is outperforming\n\n" +
    "The CCR has effectively moved from being one of the weaker segments after the 2023 cooling measures to becoming one of the more resilient parts of the market.\n\n" +
    "According to CBRE, CCR prices rose 1.8% in Q2, supported by firm pricing at existing projects and buyers recognising the narrowing price gap between prime and non-prime markets.\n\n" +
    "For high-net-worth buyers, this creates an interesting environment:\n\n" +
    "- prime locations remain scarce\n" +
    "- the price gap with some RCR/OCR properties has narrowed\n" +
    "- new supply is still relatively limited in the luxury segment\n" +
    "- Singapore continues to attract international wealth\n" +
    "- the highest-quality properties increasingly trade according to scarcity rather than broad market sentiment\n\n" +
    "What does this mean for buyers?\n\n" +
    'The luxury market should not be viewed simply as "Singapore property prices are rising." Instead, the market is becoming increasingly selective.\n\n' +
    "A well-located freehold residence in District 9 or 10 with excellent views, large floor area, privacy and strong developer pedigree can behave very differently from a generic condominium elsewhere.\n\n" +
    "Our view: 2026 is increasingly a market where quality matters more than market direction.\n\n" +
    "There will be photos for that insight which to be created in a card list view and detail view.",
  file_url: "",
  cover_url: "",
  period: "14 Aug 2026",
  read_time: "7 min read",
  published: true,
};

export default function MarketInsightsPage() {
  const [items, setItems] = useState<MarketInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MarketInsightForm>(emptyMarketInsightForm);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await fetchMarketInsights();
      if (!mounted) return;
      if (error) {
        toast({ title: "Could not load market insights", description: error.message, variant: "destructive" });
      } else {
        setItems((data ?? []) as MarketInsight[]);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.published_at).length,
    draft: items.filter((item) => !item.published_at).length,
  }), [items]);

  function startEdit(item: MarketInsight) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      category: item.category ?? "MARKET OUTLOOK",
      description: item.description ?? "",
      body: item.body ?? "",
      file_url: item.file_url ?? "",
      cover_url: item.cover_url ?? "",
      period: item.period ?? "",
      read_time: item.read_time ?? "7 min read",
      published: !!item.published_at,
    });
  }

  function loadTemplate() {
    setEditingId(null);
    setForm(SINGAPORE_LUXURY_MARKET_TEMPLATE);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyMarketInsightForm);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: "Title and body are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data, error } = await saveMarketInsight(editingId, form);
    setSaving(false);

    if (error) {
      toast({ title: "Could not save insight", description: error.message, variant: "destructive" });
      return;
    }

    const savedItem = data as MarketInsight | null;
    if (editingId) {
      setItems((prev) => prev.map((item) => (item.id === editingId ? (savedItem ?? mapFormToItem(form, editingId, item)) : item)));
      toast({ title: "Market insight updated" });
    } else {
      const createdItem = savedItem ?? mapFormToItem(form, crypto.randomUUID(), null);
      setItems((prev) => [createdItem, ...prev]);
      toast({ title: "Market insight created" });
    }
    resetForm();
  }

  async function togglePublished(item: MarketInsight, published: boolean) {
    setSaving(true);
    const { error } = await saveMarketInsight(item.id, {
      title: item.title,
      category: item.category ?? "MARKET OUTLOOK",
      description: item.description ?? "",
      body: item.body ?? "",
      file_url: item.file_url ?? "",
      cover_url: item.cover_url ?? "",
      period: item.period ?? "",
      read_time: item.read_time ?? "7 min read",
      published,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not update publish state", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, published_at: published ? new Date().toISOString() : null } : row)));
    toast({ title: published ? "Insight published" : "Insight moved to draft" });
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Market insight control</Badge>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Market Insights</h1>
          <p className="mt-2 max-w-2xl font-body text-muted-foreground">
            Create the public insight cards, edit the content, and decide what appears on the website.
          </p>
        </div>

        <Button onClick={resetForm} className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
          <Plus className="mr-2 h-4 w-4" />
          New Insight
        </Button>
        <Button onClick={loadTemplate} variant="outline" className="font-body font-semibold">
          Load Singapore Example
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Published" value={stats.published} />
        <StatCard label="Draft" value={stats.draft} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              {editingId ? "Edit market insight" : "Create market insight"}
            </CardTitle>
            <CardDescription className="font-body">
              Use a public report or article link for the public site. This keeps the same content source for both the homepage preview and the full insights page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="MARKET OUTLOOK" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Singapore Property Market Outlook 2026" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Card excerpt</Label>
                <Textarea id="description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Short summary for the public site card." rows={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Detail page content</Label>
                <Textarea id="body" value={form.body} onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))} placeholder="Full article content for the detail page." rows={12} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Input id="period" value={form.period} onChange={(e) => setForm((prev) => ({ ...prev, period: e.target.value }))} placeholder="Q3 2026" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="read_time">Read time</Label>
                <Input id="read_time" value={form.read_time} onChange={(e) => setForm((prev) => ({ ...prev, read_time: e.target.value }))} placeholder="7 min read" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover_url">Cover image URL</Label>
                <Input id="cover_url" value={form.cover_url} onChange={(e) => setForm((prev) => ({ ...prev, cover_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file_url">Source link or PDF URL optional</Label>
                <Input id="file_url" value={form.file_url} onChange={(e) => setForm((prev) => ({ ...prev, file_url: e.target.value }))} placeholder="https://... or leave blank" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3">
                <div>
                  <p className="font-body font-semibold text-foreground">Publish now</p>
                  <p className="font-body text-sm text-muted-foreground">Turn off to save as draft.</p>
                </div>
                <Switch checked={form.published} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, published: checked }))} />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving} className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
                  <Save className="mr-2 h-4 w-4" />
                  {editingId ? "Update Insight" : "Create Insight"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Insight list</CardTitle>
            <CardDescription className="font-body">
              Edit the existing cards, switch published status, or open the public page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)
            ) : items.length ? (
              items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border/70 p-4 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="font-body">
                          {item.category ?? "MARKET OUTLOOK"}
                        </Badge>
                        <p className="font-body font-semibold text-foreground">{item.title}</p>
                        <Badge variant="outline" className="font-body capitalize">
                          {item.published_at ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <p className="font-body text-sm text-muted-foreground line-clamp-2">
                        {item.description || "No description yet."}
                      </p>
                      <p className="font-body text-xs text-muted-foreground">
                        {item.read_time ?? "7 min read"}
                      </p>
                      <p className="inline-flex items-center gap-1 font-body text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatInsightDate(item.published_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(item)}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={buildInsightHref(item.id, item.title)} target="_blank">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5">
                      <span className="font-body text-xs text-muted-foreground">Published</span>
                      <Switch
                        checked={!!item.published_at}
                        onCheckedChange={(checked) => void togglePublished(item, checked)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
                <p className="font-body text-sm text-muted-foreground">No market insights yet. Create the first one on the left.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <CardDescription className="font-body">{label}</CardDescription>
        <CardTitle className="font-heading text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function mapFormToItem(form: MarketInsightForm, id: string, existing: MarketInsight | null): MarketInsight {
  return {
    id,
    title: form.title.trim(),
    category: form.category.trim() || null,
    description: form.description.trim() || null,
    body: form.body.trim() || null,
    file_url: form.file_url.trim() || null,
    cover_url: form.cover_url.trim() || null,
    period: form.period.trim() || null,
    read_time: form.read_time.trim() || null,
    published_at: form.published ? new Date().toISOString() : null,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
}
