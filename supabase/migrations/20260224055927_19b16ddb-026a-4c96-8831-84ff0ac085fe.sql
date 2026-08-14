
-- 1. Create file_activity_log table
CREATE TABLE public.file_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL,
  folder_name text,
  file_id uuid REFERENCES public.agent_files(id),
  old_value jsonb,
  new_value jsonb,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.file_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read own file activity"
  ON public.file_activity_log
  FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "Agents insert own file activity"
  ON public.file_activity_log
  FOR INSERT
  WITH CHECK (agent_id = auth.uid());

-- 2. Add folder_description to agent_files
ALTER TABLE public.agent_files ADD COLUMN folder_description text;

-- 3. Add is_archived to agent_files
ALTER TABLE public.agent_files ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
