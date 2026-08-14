import { supabase } from "@/integrations/supabase/client";

export interface NewTaskInput {
  title: string;
  dueAt?: string | null; // ISO
  leadId?: string | null;
  propertyId?: string | null;
}

// Shared by the manual "Add Task" dialog (CalendarScene) and ARIA's
// task_create action (AIChatPanel) — one insert path so the two can't drift.
// agent_tasks is a separate, lighter-weight table from `viewings` on purpose:
// it covers the agent's other personal-assistant activities (calls,
// follow-ups, admin reminders) that aren't a property viewing and don't need
// conflict/buffer checking — the Schedule page renders both side by side
// rather than forcing them into one shared table.
export async function createTask(
  agentId: string,
  input: NewTaskInput
): Promise<{ error: string | null; taskId?: string }> {
  if (!input.title?.trim()) {
    return { error: "A title is required." };
  }

  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: agentId,
      title: input.title.trim(),
      due_at: input.dueAt || null,
      lead_id: input.leadId || null,
      property_id: input.propertyId || null,
    })
    .select("id")
    .single();

  return { error: error?.message ?? null, taskId: data?.id };
}

// Shared by CalendarScene's task checkbox and ARIA's task_complete action.
export async function setTaskCompletion(
  agentId: string,
  taskId: string,
  isCompleted: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("agent_tasks")
    .update({ is_completed: isCompleted })
    .eq("id", taskId)
    .eq("agent_id", agentId);

  return { error: error?.message ?? null };
}
