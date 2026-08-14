import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { folder_name, agent_id, category } = await req.json();

    if (agent_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all files in this folder
    const { data: files, error: filesError } = await supabase
      .from("agent_files")
      .select("*")
      .eq("agent_id", agent_id)
      .eq("folder_name", folder_name);

    if (filesError) {
      return new Response(JSON.stringify({ success: false, error: filesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text from notes
    const notes = (files || []).filter((f: any) => f.file_type === "note");
    const combinedText = notes
      .map((n: any) => n.aria_extracted?.raw_text || "")
      .filter(Boolean)
      .join("\n\n");

    if (!combinedText.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No notes found in this folder to analyse. Add a note with property details first.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to use Anthropic API for extraction, fall back to simple parsing
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    let extracted: any = {};

    if (anthropicKey) {
      try {
        const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: `Extract Singapore real estate listing details from the following text. Return ONLY a JSON object with these fields (use null if not found):
{
  "property_name": string,
  "unit_number": string,
  "address": string,
  "postal_code": string,
  "district": number,
  "property_type": string (one of: HDB, Condo, Landed, Commercial, Industrial, Conservation Shophouse),
  "transaction_type": string (sale or rent),
  "size_sqft": number,
  "bedrooms": number,
  "bathrooms": number,
  "tenure": string (Freehold, 99-year, 999-year, or Leasehold),
  "price": number,
  "description_en": string (generate a professional listing description if enough info),
  "confidence": number (0-100, how confident you are in the extraction)
}

Text:
${combinedText}`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.content?.[0]?.text || "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            extracted = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (e) {
        console.error("AI extraction failed, using simple parsing:", e);
      }
    }

    // Simple fallback parsing if AI didn't work
    if (!extracted.property_name) {
      const lines = combinedText.split("\n").map((l: string) => l.trim()).filter(Boolean);
      extracted.property_name = lines[0] || null;

      const districtMatch = combinedText.match(/[Dd]istrict\s*(\d+)/);
      if (districtMatch) extracted.district = parseInt(districtMatch[1]);

      const sqftMatch = combinedText.match(/([\d,]+)\s*sqft/i);
      if (sqftMatch) extracted.size_sqft = parseInt(sqftMatch[1].replace(/,/g, ""));

      const priceMatch = combinedText.match(/\$\s*([\d,]+(?:\.\d+)?)/);
      if (priceMatch) extracted.price = parseFloat(priceMatch[1].replace(/,/g, ""));

      const tenureMatch = combinedText.match(/(freehold|99-year|999-year|leasehold)/i);
      if (tenureMatch) extracted.tenure = tenureMatch[1];

      const bedMatch = combinedText.match(/(\d+)\s*(?:bed|bedroom)/i);
      if (bedMatch) extracted.bedrooms = parseInt(bedMatch[1]);

      extracted.confidence = 40;
    }

    // Save extracted data back to all files in the folder
    await supabase
      .from("agent_files")
      .update({ aria_extracted: extracted, processing_status: "embedded" })
      .eq("agent_id", agent_id)
      .eq("folder_name", folder_name);

    // Insert into rag_documents for ARIA knowledge search
    if (extracted.description_en) {
      await supabase.from("rag_documents").upsert({
        agent_id,
        source_type: "file_analysis",
        source_id: folder_name,
        content: extracted.description_en,
        is_public: false,
        metadata: {
          folder_name,
          property_name: extracted.property_name,
          source: "file_analysis",
        },
        updated_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ success: true, extracted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("analyse-agent-files error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
