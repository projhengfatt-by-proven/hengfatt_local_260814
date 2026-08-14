import { supabase } from "@/integrations/supabase/client";

// TODO: remove the `as any` casts here once `supabase gen types typescript` has been
// re-run against the live DB after supabase/migrations/20260810000000_lead_reassignment.sql
// lands — `lead_shares` and `accept_lead_share` don't exist in src/integrations/supabase/types.ts
// yet since this project has no linked Supabase CLI in this environment to regenerate it.

export async function shareLead(fromAgentId: string, leadId: string, toAgentId: string, message?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("lead_shares").insert({
    lead_id: leadId,
    from_agent_id: fromAgentId,
    to_agent_id: toAgentId,
    message: message || null,
  });
  return { error };
}

export async function acceptLeadShare(shareId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("accept_lead_share", { p_share_id: shareId });
  return { error };
}

export async function declineLeadShare(shareId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("lead_shares")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", shareId);
  return { error };
}

export async function revokeLeadShare(shareId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("lead_shares")
    .update({ status: "revoked", responded_at: new Date().toISOString() })
    .eq("id", shareId);
  return { error };
}
