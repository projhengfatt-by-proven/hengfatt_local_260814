import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ARIA_STATIC_SYSTEM_PROMPT } from "./prompt.ts";
import { ARIA_TOOLS } from "./tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY)
      throw new Error("ANTHROPIC_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user (unchanged — soft: proceeds anonymously if this
    // doesn't resolve, since verify_jwt is false for this function.
    // Known gap, tracked separately: the client currently authenticates
    // with the anon key rather than the agent's real session token, so
    // this rarely resolves for real users today — see BUILD_GUIDE.md.)
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || supabaseKey;
      const userClient = createClient(supabaseUrl, anonKey);
      const { data: { user } } = await userClient.auth.getUser(token);
      if (user) userId = user.id;
    }

    const { messages, agentContext } = await req.json();

    // Load agent memory if we have a user (unchanged — read-only)
    let memoryContext = "";
    if (userId) {
      const { data: memory } = await supabase
        .from("agent_memory")
        .select("key, value")
        .eq("agent_id", userId)
        .limit(50);
      if (memory && memory.length > 0) {
        memoryContext = "\n\nAGENT MEMORY:\n" +
          memory.map((m: any) => `- ${m.key}: ${m.value}`).join("\n");
      }
    }

    // ─── Dynamic block — rebuilt fresh every request, never cached ───
    const nowInSingapore = new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const dynamicBlock =
      `Current date/time (Asia/Singapore): ${nowInSingapore}. Use this to resolve relative dates like "tomorrow" or "Friday at 3pm" into an exact date before calling viewing_book.` +
      (agentContext ? `\n\nCURRENT AGENT CONTEXT:
- Active Listings: ${agentContext.listingsCount || 0}
- Open Leads: ${agentContext.leadsCount || 0}
- Today's Viewings: ${agentContext.viewingsTodayCount || 0}
- Pipeline Value: $${agentContext.pipelineValue || 0}` : "") +
      memoryContext;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        system: [
          {
            type: "text",
            text: ARIA_STATIC_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: dynamicBlock,
          },
        ],
        tools: ARIA_TOOLS,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: "AI authentication failed. Check the ANTHROPIC_API_KEY secret." }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 529) {
        return new Response(
          JSON.stringify({ error: "The AI is temporarily overloaded. Please try again in a moment." }),
          { status: 529, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pure pass-through — this function never buffers, parses, or writes
    // to the database. The raw Anthropic SSE stream is piped straight to
    // the browser, which parses the native event shape directly
    // (see src/lib/ariaClient.ts).
    //
    // Cache-Control/X-Accel-Buffering/Connection below are deliberate, not
    // decorative: without them, an intermediate proxy layer in front of
    // this edge function can buffer the whole response instead of
    // forwarding it chunk-by-chunk — the invocation still logs a clean 200
    // server-side, but the browser either gets nothing until a buffer
    // flush/timeout or the connection gets cut before that happens. Added
    // 2026-08-11 chasing exactly that symptom (server logs 200, client
    // sees "connection closed unexpectedly" with no data ever arriving).
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    console.error("aria-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
