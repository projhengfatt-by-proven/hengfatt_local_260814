import { supabase } from "@/integrations/supabase/client";

export type MarketInsight = {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  cover_url: string | null;
  period: string | null;
  published_at: string | null;
  created_at: string | null;
};

export type MarketInsightForm = {
  title: string;
  description: string;
  file_url: string;
  cover_url: string;
  period: string;
  published: boolean;
};

export const emptyMarketInsightForm: MarketInsightForm = {
  title: "",
  description: "",
  file_url: "",
  cover_url: "",
  period: "",
  published: true,
};

export function slugifyInsightTitle(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildInsightHref(id: string, title: string) {
  return `/insights/${id}--${slugifyInsightTitle(title)}`;
}

export function extractInsightId(param: string | undefined) {
  if (!param) return "";
  return param.split("--")[0] || param;
}

export function formatInsightDate(value: string | null | undefined) {
  if (!value) return "Unpublished";
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export async function fetchMarketInsights({ publishedOnly = false }: { publishedOnly?: boolean } = {}) {
  let query = supabase
    .from("market_reports")
    .select("id, title, description, file_url, cover_url, period, published_at, created_at")
    .order("created_at", { ascending: false });

  if (publishedOnly) {
    query = query.not("published_at", "is", null).lte("published_at", new Date().toISOString());
  }

  return query;
}

export async function saveMarketInsight(id: string | null, form: MarketInsightForm) {
  const payload = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    file_url: form.file_url.trim(),
    cover_url: form.cover_url.trim() || null,
    period: form.period.trim() || null,
    published_at: form.published ? new Date().toISOString() : null,
  };

  if (id) {
    return supabase.from("market_reports").update(payload).eq("id", id).select("id, title, description, file_url, cover_url, period, published_at, created_at").single();
  }

  return supabase.from("market_reports").insert(payload).select("id, title, description, file_url, cover_url, period, published_at, created_at").single();
}
