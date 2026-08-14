import { supabase } from "@/integrations/supabase/client";

const VALID_SOURCES = ["website", "whatsapp", "referral", "portal", "voice", "agent"] as const;
type LeadSource = (typeof VALID_SOURCES)[number];

export const LEAD_STATUSES = ["new", "contacted", "viewing", "offer", "closed", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface NewLeadInput {
  full_name: string;
  phone?: string;
  email?: string;
  notes?: string;
  source?: string;
}

// Shared by both the manual "Add Lead" dialog (LeadsScene.tsx) and ARIA's
// lead_create tool (AIChatPanel.tsx) — one operation, two entry points, so
// they can't drift apart the way the two listing-form implementations did.
export async function createLead(agentId: string, input: NewLeadInput) {
  const source: LeadSource = (VALID_SOURCES as readonly string[]).includes(input.source || "")
    ? (input.source as LeadSource)
    : "agent";

  const { data, error } = await supabase
    .from("leads")
    .insert({
      agent_id: agentId,
      full_name: input.full_name,
      phone: input.phone || null,
      email: input.email || null,
      notes: input.notes || null,
      source,
      status: "new",
    })
    .select()
    .single();

  return { data, error };
}

// Shared by the manual status control (LeadsScene card + LeadDetailScene)
// and ARIA's lead_update_status tool (AIChatPanel.tsx).
export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const { error } = await supabase
    .from("leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  return { error };
}

export interface LeadNotesUpdate {
  notes?: string;
  next_followup_at?: string | null;
}

// Shared by LeadDetailScene's inline-edit save — currently the only writer
// of these two fields (no ARIA tool for it yet, unlike the others above).
export async function updateLeadNotes(leadId: string, input: LeadNotesUpdate) {
  const { error } = await supabase
    .from("leads")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  return { error };
}
