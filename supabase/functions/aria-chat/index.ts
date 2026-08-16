import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSystemPrompt } from "./prompt.ts";
import { getToolsForAssistantRole } from "./tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AssistantRole = "agent" | "admin";

function formatAdminContext(context: Record<string, any>) {
  const counts = context.counts ?? {};
  const headline = context.headline ?? {};
  const pendingInvites = Array.isArray(context.pendingInvites) ? context.pendingInvites : [];
  const urgentApplications = Array.isArray(context.urgentApplications) ? context.urgentApplications : [];
  const draftListings = Array.isArray(context.draftListings) ? context.draftListings : [];
  const recentActivity = Array.isArray(context.recentActivity) ? context.recentActivity : [];

  return [
    "ADMIN OVERVIEW",
    `- Agents: ${headline.agents ?? `${counts.agentsPublished ?? 0}/${counts.agentsTotal ?? 0} published`}`,
    `- Listings: ${headline.listings ?? `${counts.listingsActive ?? 0}/${counts.listingsTotal ?? 0} active`}`,
    `- Applications: ${headline.applications ?? `${counts.applicationsPending ?? 0} pending`}`,
    `- Featured agents: ${counts.agentsFeatured ?? 0}`,
    `- Featured listings: ${counts.listingsFeatured ?? 0}`,
    `- Pending invites: ${pendingInvites.length}`,
    "",
    "URGENT APPLICATIONS",
    ...(urgentApplications.length > 0
      ? urgentApplications.map((item: any) => `- ${item.name} (${item.status}) ${item.agency ? `from ${item.agency}` : ""}`.trim())
      : ["- None"]),
    "",
    "DRAFT LISTINGS",
    ...(draftListings.length > 0
      ? draftListings.map((item: any) => `- ${item.title} (${item.views ?? 0} views, featured: ${item.featured ? "yes" : "no"})`)
      : ["- None"]),
    "",
    "RECENT ACTIVITY",
    ...(recentActivity.length > 0
      ? recentActivity.map((item: any) => `- ${item.action} on ${item.target ?? item.targetType} at ${item.at}`)
      : ["- None"]),
  ].join("\n");
}

function getAnonKey() {
  return Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

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

    const body = await req.json();
    const assistantRole = (body.assistantRole === "admin" ? "admin" : "agent") as AssistantRole;
    const messages = body.messages ?? [];
    const assistantContext = body.assistantContext ?? body.agentContext ?? null;

    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, getAnonKey());
      const { data: { user } } = await userClient.auth.getUser(token);
      if (user) userId = user.id;
    }

    if (assistantRole === "admin") {
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleRow) {
        return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Mirrors the admin check above — previously missing (see
    // docs/security/COPILOT_SECURITY_AUDIT.md). Without this, any caller —
    // authenticated as any role, or not authenticated at all — could
    // retrieve the full ARIA_TOOLS list and a streamed completion,
    // consuming the project's Anthropic API budget with no authorization
    // check at all. "Agent" is not a user_roles row in this schema (see
    // docs/admin/ROLE_INVENTORY.md) — it's inferred from having an
    // agent_profiles row, so this checks for either that or an admin role.
    if (assistantRole === "agent") {
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: agentRow } = await supabase
        .from("agent_profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (!agentRow) {
        const { data: adminRoleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        if (!adminRoleRow) {
          return new Response(JSON.stringify({ error: "Forbidden — agent or admin only" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    let memoryContext = "";
    if (assistantRole === "agent" && userId) {
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

    const nowInSingapore = new Date().toLocaleString("en-SG", {
      timeZone: "Asia/Singapore",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const contextBlock = assistantRole === "admin"
      ? (assistantContext ? `\n\nADMIN CONTEXT:\n${formatAdminContext(assistantContext)}` : "")
      : (assistantContext ? `\n\nCURRENT AGENT CONTEXT:\n- Active Listings: ${assistantContext.listingsCount || 0}
- Open Leads: ${assistantContext.leadsCount || 0}
- Today's Viewings: ${assistantContext.viewingsTodayCount || 0}
- Pipeline Value: $${assistantContext.pipelineValue || 0}` : "");

    const dynamicBlock =
      `Current date/time (Asia/Singapore): ${nowInSingapore}.` +
      (assistantRole === "admin"
        ? " Use this to explain time-sensitive admin work clearly and to describe any operational timing concerns."
        : " Use this to resolve relative dates like \"tomorrow\" or \"Friday at 3pm\" into an exact date before calling viewing_book.") +
      contextBlock +
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
            text: getSystemPrompt(assistantRole),
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: dynamicBlock,
          },
        ],
        tools: getToolsForAssistantRole(assistantRole),
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
