import { pack as realEstatePack } from "./packs/real-estate.ts";
import { pack as emptyPack } from "./packs/_empty.ts";
import type { IntentPack } from "./packs/real-estate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Static map of every pack this deployment knows about. Deno can't safely
// dynamic-import() a filename built from an env var, and there are only
// ever a handful of packs, so a plain lookup table is the right amount of
// machinery here — no filesystem globbing needed.
const PACKS: Record<string, IntentPack> = {
  "real-estate": realEstatePack,
  "_empty": emptyPack,
};

function getActivePack(): IntentPack {
  const name = Deno.env.get("ACTIVE_INTENT_PACK") || "real-estate";
  const activePack = PACKS[name];
  if (!activePack) {
    throw new Error(`Unknown intent pack: "${name}"`);
  }
  return activePack;
}

// Cached per function instance — recomputed fresh on the next cold start,
// so this can never silently desync from whatever's currently in the
// active pack's phrase lists.
let exampleEmbeddings: Record<string, number[][]> | null = null;
let cachedForPack: string | null = null;

async function embed(texts: string[]): Promise<number[][]> {
  const apiKey = Deno.env.get("OPENAI_EMBEDDING_API_KEY");
  if (!apiKey) throw new Error("OPENAI_EMBEDDING_API_KEY is not configured");

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
      dimensions: 512,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Embedding request failed: ${resp.status} ${t}`);
  }

  const data = await resp.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function getExampleEmbeddings(activePack: IntentPack): Promise<Record<string, number[][]>> {
  if (exampleEmbeddings && cachedForPack === activePack.name) return exampleEmbeddings;

  const intentIds = Object.keys(activePack.intents);
  if (intentIds.length === 0) {
    exampleEmbeddings = {};
    cachedForPack = activePack.name;
    return exampleEmbeddings;
  }

  const allPhrases = intentIds.flatMap((id) => activePack.intents[id].examples);
  const allVectors = await embed(allPhrases);

  const result: Record<string, number[][]> = {};
  let cursor = 0;
  for (const id of intentIds) {
    const count = activePack.intents[id].examples.length;
    result[id] = allVectors.slice(cursor, cursor + count);
    cursor += count;
  }

  exampleEmbeddings = result;
  cachedForPack = activePack.name;
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const activePack = getActivePack();

    if (Object.keys(activePack.intents).length === 0) {
      // Empty pack (e.g. the "_empty" sanity-check pack) — nothing to
      // match against, no point calling the embedding API at all.
      return new Response(
        JSON.stringify({ intent: null, confidence: 0, threshold: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const examples = await getExampleEmbeddings(activePack);
    const [messageVector] = await embed([text]);

    let bestIntent: string | null = null;
    let bestScore = 0;

    for (const [intentId, vectors] of Object.entries(examples)) {
      const score = Math.max(...vectors.map((v) => cosineSimilarity(messageVector, v)));
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intentId;
      }
    }

    const threshold = bestIntent ? activePack.intents[bestIntent].threshold : null;

    return new Response(
      JSON.stringify({ intent: bestIntent, confidence: bestScore, threshold }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("classify-intent error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
