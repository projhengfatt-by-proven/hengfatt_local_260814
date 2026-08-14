-- Failure log for the n8n "Agent Invite" workflow.
-- Written by n8n (via the service-role key, which bypasses RLS) whenever a
-- downstream step of an agent invite fails after its retries are exhausted.
-- agent_id is nullable because the failure may occur before any user exists
-- (e.g. the initial invite call itself failing).
CREATE TABLE public.agent_invite_failures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid,
  email text,
  payload jsonb,
  failed_node text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_invite_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read invite failures"
  ON public.agent_invite_failures
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policy is defined on purpose: rows are written
-- only by the n8n workflow using the Supabase service-role key, which
-- bypasses RLS entirely (the same pattern used by the Edge Functions
-- elsewhere in this project).
