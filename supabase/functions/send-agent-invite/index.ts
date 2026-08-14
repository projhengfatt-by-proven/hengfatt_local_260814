import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: verify caller is admin ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;

    // Check admin role using service client
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleRow } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Forward to the n8n "Agent Invite" workflow ---
    // This function is now just the authenticated trust boundary between the
    // browser and the webhook. All the actual work — inviting the auth user,
    // creating the profile/role/agent_profiles rows, retrying failed steps,
    // and logging unrecoverable failures — happens inside n8n.
    const body = await req.json();

    const n8nUrl = Deno.env.get("N8N_INVITE_WEBHOOK_URL");
    const n8nSecret = Deno.env.get("N8N_INVITE_WEBHOOK_SECRET");
    if (!n8nUrl || !n8nSecret) {
      throw new Error("N8N_INVITE_WEBHOOK_URL / N8N_INVITE_WEBHOOK_SECRET is not configured");
    }

    let n8nResponse: Response;
    try {
      n8nResponse = await fetch(n8nUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-N8N-Webhook-Secret": n8nSecret,
        },
        body: JSON.stringify({ ...body, requested_by: callerId }),
        signal: AbortSignal.timeout(20000),
      });
    } catch (fetchError) {
      console.error("send-agent-invite: n8n webhook unreachable or timed out:", fetchError);
      return new Response(
        JSON.stringify({
          error:
            "Invite workflow timed out — check the Agents list before retrying, the invite may have partially succeeded.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultText = await n8nResponse.text();
    return new Response(resultText, {
      status: n8nResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-agent-invite error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
