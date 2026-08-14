import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  buildInsightHref,
  emptyMarketInsightForm,
  fetchMarketInsights,
  formatInsightDate,
  marketInsightToForm,
  saveMarketInsight,
  type MarketInsight,
  type MarketInsightForm,
} from "@/lib/marketInsights";
import { buildMarketInsightCopilotContext, generateMarketInsightDraft, type MarketInsightCopilotDraft } from "@/lib/marketInsightCopilot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Edit3, Eye, FileText, Plus, Save, Search, Pin, Sparkles } from "lucide-react";

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
  is_featured: true,
  display_order: 1,
  period: "14 Aug 2026",
  read_time: "7 min read",
  published: false,
};

type InsightFilter = "all" | "published" | "draft" | "featured";

export default function MarketInsightsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<MarketInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InsightFilter>("all");
  const [form, setForm] = useState<MarketInsightForm>(emptyMarketInsightForm);
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotDraft, setCopilotDraft] = useState<MarketInsightCopilotDraft | null>(null);
  const [copilotNotes, setCopilotNotes] = useState("");
  const [copilotGenerating, setCopilotGenerating] = useState(false);
  const [copilotToken, setCopilotToken] = useState<string | null>(null);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setCopilotToken(session?.access_token ?? null);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || loading) return;
    const insight = items.find((item) => item.id === editId);
    if (insight) {
      startEdit(insight);
    }
  }, [items, loading, searchParams, startEdit]);

  const stats = useMemo(
    () => ({
      total: items.length,
      published: items.filter((item) => item.published_at).length,
      draft: items.filter((item) => !item.published_at).length,
    }),
    [items]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === "published" && !item.published_at) return false;
      if (filter === "draft" && item.published_at) return false;
      if (filter === "featured" && !item.is_featured) return false;

      if (!search.trim()) return true;
      const haystack = [
        item.category,
        item.title,
        item.description,
        item.period,
        item.read_time,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [filter, items, search]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyMarketInsightForm);
    setShowForm(false);
    setCopilotDraft(null);
    setCopilotNotes("");
    setSearchParams({});
  }

  function startCreate(template = false) {
    setEditingId(null);
    setForm(template ? { ...SINGAPORE_LUXURY_MARKET_TEMPLATE, is_featured: true, display_order: 1, published: false } : emptyMarketInsightForm);
    setShowForm(true);
    setCopilotDraft(null);
    setCopilotNotes("");
    setSearchParams({});
  }

  const startEdit = useCallback((item: MarketInsight) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      category: item.category ?? "MARKET OUTLOOK",
      description: item.description ?? "",
      body: item.body ?? "",
      file_url: item.file_url ?? "",
      cover_url: item.cover_url ?? "",
      is_featured: item.is_featured ?? false,
      display_order: item.display_order ?? 100,
      period: item.period ?? "",
      read_time: item.read_time ?? "7 min read",
      published: !!item.published_at,
    });
    setShowForm(true);
    setCopilotDraft(null);
    setCopilotNotes("");
    setSearchParams({ edit: item.id });
  }, [setSearchParams]);

  async function generateCopilotDraft() {
    const prompt = copilotPrompt.trim();
    if (!prompt) {
      toast({ title: "Add a brief first", description: "Paste the source notes or the article idea before generating a draft.", variant: "destructive" });
      return;
    }

    if (!copilotToken) {
      toast({ title: "Copilot not ready", description: "Please sign in again and try once the session is restored.", variant: "destructive" });
      return;
    }

    setCopilotGenerating(true);
    const context = buildMarketInsightCopilotContext(
      items.map((item) => ({
        title: item.title,
        category: item.category,
        published_at: item.published_at,
        is_featured: item.is_featured,
        display_order: item.display_order,
      }))
    );

    const { data, error, rawText } = await generateMarketInsightDraft({
      prompt,
      authToken: copilotToken,
      context,
    });
    setCopilotGenerating(false);

    if (error || !data) {
      toast({
        title: "Copilot draft failed",
        description: error || rawText || "The copilot could not build a draft from that brief.",
        variant: "destructive",
      });
      return;
    }

    setCopilotDraft(data);
    setCopilotNotes(data.sourceNotes);
    toast({ title: "Copilot draft ready", description: "Review the draft, then apply it to the form for the final approval step." });
  }

  function applyCopilotDraft() {
    if (!copilotDraft) return;
    setEditingId(null);
    setForm({
      title: copilotDraft.title,
      category: copilotDraft.category,
      description: copilotDraft.description,
      body: copilotDraft.body,
      file_url: copilotDraft.file_url,
      cover_url: copilotDraft.cover_url,
      is_featured: copilotDraft.is_featured,
      display_order: copilotDraft.display_order,
      period: copilotDraft.period,
      read_time: copilotDraft.read_time,
      published: false,
    });
    setShowForm(true);
    setSearchParams({});
    toast({ title: "Draft applied", description: "The form is now filled. Review it, then save as draft or publish." });
  }

  function clearCopilotDraft() {
    setCopilotPrompt("");
    setCopilotDraft(null);
    setCopilotNotes("");
  }

  function openInsight(item: MarketInsight) {
    navigate(`/admin/insights/${item.id}`);
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

    setEditingId(null);
    setShowForm(false);
    setForm(emptyMarketInsightForm);
    setSearchParams({});
  }

  async function togglePublished(item: MarketInsight, published: boolean) {
    setSaving(true);
    const { error } = await saveMarketInsight(item.id, { ...marketInsightToForm(item), published });
    setSaving(false);
    if (error) {
      toast({ title: "Could not update publish state", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, published_at: published ? new Date().toISOString() : null } : row)));
    toast({ title: published ? "Insight published" : "Insight moved to draft" });
  }

  async function toggleFeatured(item: MarketInsight, featured: boolean) {
    setSaving(true);
    const { error } = await saveMarketInsight(item.id, { ...marketInsightToForm(item), is_featured: featured });
    setSaving(false);
    if (error) {
      toast({ title: "Could not update featured state", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, is_featured: featured } : row)));
    toast({ title: featured ? "Insight featured" : "Insight unfeatured" });
  }

  async function updateOrder(item: MarketInsight, displayOrder: number) {
    setSaving(true);
    const { error } = await saveMarketInsight(item.id, { ...marketInsightToForm(item), display_order: displayOrder });
    setSaving(false);
    if (error) {
      toast({ title: "Could not update order", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, display_order: displayOrder } : row)));
    toast({ title: "Insight order updated" });
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Market insight control</Badge>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Market Insights</h1>
          <p className="mt-2 max-w-2xl font-body text-muted-foreground">
            Browse all created insights first, filter them, open one for detail, or create a new one from the same page.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => startCreate()} className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
            <Plus className="mr-2 h-4 w-4" />
            Add Insight
          </Button>
          <Button onClick={() => startCreate(true)} variant="outline" className="font-body font-semibold">
            Load Singapore Example
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Published" value={stats.published} />
        <StatCard label="Draft" value={stats.draft} />
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="font-heading text-xl">Copilot draft</CardTitle>
              <CardDescription className="font-body">
                Paste the brief, let the copilot fill the form, then approve the draft before it is saved or published.
              </CardDescription>
            </div>
            <Badge className="bg-gold/10 text-gold border-gold/30 font-body">Phase 1 of 4</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <Label htmlFor="copilot-brief">Admin brief</Label>
              <Textarea
                id="copilot-brief"
                value={copilotPrompt}
                onChange={(e) => setCopilotPrompt(e.target.value)}
                rows={8}
                placeholder="Paste the market notes, research points, or article outline here. The copilot will turn this into a draft."
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void generateCopilotDraft()} disabled={copilotGenerating} className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {copilotGenerating ? "Drafting..." : "Generate draft"}
                </Button>
                <Button variant="outline" onClick={() => setCopilotPrompt(SINGAPORE_LUXURY_MARKET_TEMPLATE.body)}>
                  Load example brief
                </Button>
                <Button variant="ghost" onClick={clearCopilotDraft}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 space-y-3">
              <p className="font-body text-sm font-semibold text-foreground">Approval steps</p>
              <ol className="space-y-2 text-sm font-body text-muted-foreground">
                <li>1. Generate a draft from your source notes.</li>
                <li>2. Review the preview and apply it to the form.</li>
                <li>3. Save as draft or publish from the form itself.</li>
              </ol>
              {copilotDraft && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
                  <p className="font-body text-xs uppercase tracking-wide text-gold">Draft ready</p>
                  <p className="mt-1 font-body text-sm font-semibold text-foreground">{copilotDraft.title}</p>
                  <p className="mt-1 font-body text-sm text-muted-foreground">{copilotDraft.category}</p>
                  {copilotDraft.sourceNotes && (
                    <p className="mt-2 font-body text-sm text-muted-foreground whitespace-pre-wrap">{copilotDraft.sourceNotes}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={applyCopilotDraft} className="bg-gold hover:bg-gold-dark text-primary font-body font-semibold">
                      Apply to form
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setCopilotDraft(null); setCopilotNotes(""); }}>
                      Discard
                    </Button>
                  </div>
                </div>
              )}
              {!copilotDraft && (
                <p className="font-body text-sm text-muted-foreground">
                  The draft preview will appear here after generation.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search insights by title, category, period, or read time"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "published", "draft", "featured"] as InsightFilter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-body font-medium capitalize transition-colors ${
                  filter === item ? "bg-gold text-primary" : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="font-heading text-xl">
              {editingId ? "Edit market insight" : "Create market insight"}
            </CardTitle>
            <CardDescription className="font-body">
              Fill in the card summary and the full article body here. Saving will update the public insights page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {copilotNotes && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
                  <p className="font-body text-sm font-semibold text-foreground">Copilot draft notes</p>
                  <p className="mt-1 whitespace-pre-wrap font-body text-sm text-muted-foreground">
                    {copilotNotes}
                  </p>
                  <p className="mt-2 font-body text-xs text-muted-foreground">
                    Review this draft first, then confirm the next phase by saving as draft or publishing.
                  </p>
                </div>
              )}
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
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Insight list</CardTitle>
          <CardDescription className="font-body">
            Click an insight to open its detail page. Use Edit to switch the same form into edit mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)
          ) : filteredItems.length ? (
            filteredItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/70 p-4 space-y-4">
                <button
                  type="button"
                  onClick={() => openInsight(item)}
                  className="w-full text-left space-y-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-body">
                      {item.category ?? "MARKET OUTLOOK"}
                    </Badge>
                    {item.is_featured && (
                      <Badge className="bg-gold/10 text-gold border-gold/30 font-body">
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                        Featured
                      </Badge>
                    )}
                    <Badge variant="outline" className="font-body capitalize">
                      {item.published_at ? "Published" : "Draft"}
                    </Badge>
                    <span className="inline-flex items-center gap-1 font-body text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatInsightDate(item.published_at)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-body font-semibold text-foreground">{item.title}</p>
                    {item.read_time && <span className="font-body text-xs text-muted-foreground">{item.read_time}</span>}
                  </div>
                  <p className="font-body text-sm text-muted-foreground line-clamp-2">
                    {item.description || "No description yet."}
                  </p>
                </button>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => startEdit(item)}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={buildInsightHref(item.id, item.title)} target="_blank" rel="noreferrer">
                      <Eye className="mr-2 h-4 w-4" />
                      Public page
                    </a>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => togglePublished(item, !item.published_at)} disabled={saving}>
                    <FileText className="mr-2 h-4 w-4" />
                    {item.published_at ? "Move to draft" : "Publish"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleFeatured(item, !item.is_featured)} disabled={saving}>
                    <Pin className="mr-2 h-4 w-4" />
                    {item.is_featured ? "Unfeature" : "Feature"}
                  </Button>
                  <div className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-1.5">
                    <span className="font-body text-xs text-muted-foreground">Order</span>
                    <Input
                      type="number"
                      min={0}
                      value={item.display_order}
                      className="h-8 w-20"
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, display_order: next } : row)));
                      }}
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        if (!Number.isNaN(next) && next !== item.display_order) {
                          void updateOrder(item, next);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
              <p className="font-body text-sm text-muted-foreground">No market insights match the current filters.</p>
            </div>
          )}
        </CardContent>
      </Card>
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
    is_featured: form.is_featured,
    display_order: form.display_order,
    period: form.period.trim() || null,
    read_time: form.read_time.trim() || null,
    published_at: form.published ? new Date().toISOString() : null,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
}
