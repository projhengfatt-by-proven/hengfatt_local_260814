import { supabase } from "@/integrations/supabase/client";

export const VIEWING_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;
export type ViewingStatus = (typeof VIEWING_STATUSES)[number];
export type ViewingSource = "manual" | "aria";

// Minimum gap enforced on either side of a booking so an agent can't
// double-book themselves back-to-back. There's no business_hours/
// blocked_slots/scheduling_settings table yet (deliberately deferred — see
// BUILD_GUIDE.md Part E) — this constant is where that config would live
// once one exists, matching how buffer/hours are currently hardcoded in the
// ARIA system prompt.
const BUFFER_MINS = 15;

// TODO: remove the `as any` casts here once `supabase gen types typescript` has
// been re-run against the live DB after
// supabase/migrations/20260812000000_schedule_module_extensions.sql lands —
// `source`, `cancellation_reason`, `original_viewing_id`, and the `no_show`
// enum value aren't in src/integrations/supabase/types.ts yet since this
// environment has no linked Supabase CLI to regenerate it.

export interface BookViewingInput {
  agentId: string;
  leadId: string;
  propertyId: string;
  scheduledAt: string; // ISO datetime
  durationMins?: number;
  notes?: string;
  source?: ViewingSource;
}

interface ConflictingViewing {
  id: string;
  scheduled_at: string;
  duration_mins: number | null;
}

// Finds an existing pending/confirmed viewing for this agent that overlaps
// the proposed [startsAt, startsAt + durationMins] window once BUFFER_MINS
// is applied on both sides. Widens the query window generously around the
// target day so an existing viewing that starts earlier but runs long
// enough to bleed into the new slot is still caught.
async function findConflict(
  agentId: string,
  startsAt: Date,
  durationMins: number,
  excludeViewingId?: string
): Promise<ConflictingViewing | undefined> {
  const newStart = startsAt.getTime();
  const newEnd = newStart + durationMins * 60_000;
  const bufferMs = BUFFER_MINS * 60_000;
  const windowStart = new Date(newStart - 24 * 60 * 60_000).toISOString();
  const windowEnd = new Date(newEnd + 24 * 60 * 60_000).toISOString();

  let query = supabase
    .from("viewings")
    .select("id, scheduled_at, duration_mins")
    .eq("agent_id", agentId)
    .in("status", ["pending", "confirmed"])
    .gte("scheduled_at", windowStart)
    .lte("scheduled_at", windowEnd);
  if (excludeViewingId) query = query.neq("id", excludeViewingId);

  const { data } = await query;
  return ((data as ConflictingViewing[]) || []).find((v) => {
    const eStart = new Date(v.scheduled_at).getTime();
    const eEnd = eStart + (v.duration_mins ?? 60) * 60_000;
    return newStart < eEnd + bufferMs && eStart < newEnd + bufferMs;
  });
}

function conflictMessage(conflict: ConflictingViewing) {
  return `That slot conflicts with another viewing at ${new Date(conflict.scheduled_at).toLocaleString("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  })} (needs at least ${BUFFER_MINS} min gap).`;
}

// Shared by the manual "Book Viewing" form (CalendarScene) and ARIA's
// viewing_book action (AIChatPanel) — one insert path so the two can't drift.
export async function bookViewing(input: BookViewingInput): Promise<{ error: string | null }> {
  if (!input.agentId || !input.leadId || !input.propertyId || !input.scheduledAt) {
    return { error: "Lead, property, and date/time are required." };
  }
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) {
    return { error: "That doesn't look like a valid date/time." };
  }
  const durationMins = input.durationMins ?? 60;

  const conflict = await findConflict(input.agentId, when, durationMins);
  if (conflict) {
    return { error: conflictMessage(conflict) };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("viewings").insert({
    agent_id: input.agentId,
    lead_id: input.leadId,
    property_id: input.propertyId,
    scheduled_at: when.toISOString(),
    duration_mins: durationMins,
    notes: input.notes || null,
    status: "pending",
    source: input.source ?? "manual",
  });

  return { error: error?.message ?? null };
}

export interface RescheduleViewingInput {
  agentId: string;
  viewingId: string;
  newScheduledAt: string;
  newDurationMins?: number;
}

// Shared by CalendarScene's Reschedule action and ARIA's viewing_reschedule
// action. Creates a new pending viewing linked back to the one it replaces
// (via original_viewing_id) rather than mutating scheduled_at in place, so
// the old booking isn't silently overwritten — a lightweight stand-in for a
// full viewing_history audit table (deliberately not built this round).
export async function rescheduleViewing(
  input: RescheduleViewingInput
): Promise<{ error: string | null; viewingId?: string }> {
  const when = new Date(input.newScheduledAt);
  if (Number.isNaN(when.getTime())) {
    return { error: "That doesn't look like a valid date/time." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (supabase as any)
    .from("viewings")
    .select("lead_id, property_id, notes, duration_mins, source")
    .eq("id", input.viewingId)
    .eq("agent_id", input.agentId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: fetchError?.message || "Viewing not found." };
  }

  const durationMins = input.newDurationMins ?? existing.duration_mins ?? 60;
  const conflict = await findConflict(input.agentId, when, durationMins, input.viewingId);
  if (conflict) {
    return { error: conflictMessage(conflict) };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error: insertError } = await (supabase as any)
    .from("viewings")
    .insert({
      agent_id: input.agentId,
      lead_id: existing.lead_id,
      property_id: existing.property_id,
      scheduled_at: when.toISOString(),
      duration_mins: durationMins,
      notes: existing.notes,
      status: "pending",
      source: existing.source ?? "manual",
      original_viewing_id: input.viewingId,
    })
    .select("id")
    .single();

  if (insertError) {
    return { error: insertError.message };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("viewings")
    .update({ status: "cancelled", cancellation_reason: "Rescheduled" })
    .eq("id", input.viewingId)
    .eq("agent_id", input.agentId);

  return { error: null, viewingId: created?.id };
}

// Shared by CalendarScene's status buttons (Confirm/Complete/Cancel/No-show)
// and ARIA's viewing_update_status action. `reason` is only persisted when
// transitioning to "cancelled".
export async function updateViewingStatus(
  agentId: string,
  viewingId: string,
  status: ViewingStatus,
  reason?: string
): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = { status };
  if (status === "cancelled" && reason) update.cancellation_reason = reason;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("viewings")
    .update(update)
    .eq("id", viewingId)
    .eq("agent_id", agentId);

  return { error: error?.message ?? null };
}
