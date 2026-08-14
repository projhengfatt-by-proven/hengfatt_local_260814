
-- Agent Command Center tables

-- aria_conversations: stores chat history between agent and ARIA
CREATE TABLE public.aria_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  screen_command jsonb,
  data_action jsonb,
  input_mode text DEFAULT 'text' CHECK (input_mode IN ('text', 'voice_memo', 'voice_chat')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aria_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own conversations"
  ON public.aria_conversations FOR ALL
  USING (auth.uid() = agent_id);

CREATE INDEX idx_aria_conversations_agent ON public.aria_conversations(agent_id, created_at DESC);

-- agent_memory: persistent memory for ARIA per agent
CREATE TABLE public.agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, key)
);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own memory"
  ON public.agent_memory FOR ALL
  USING (auth.uid() = agent_id);

-- agent_tasks: tasks for agents
CREATE TABLE public.agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz,
  lead_id uuid REFERENCES public.leads(id),
  property_id uuid REFERENCES public.properties(id),
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own tasks"
  ON public.agent_tasks FOR ALL
  USING (auth.uid() = agent_id);

-- content_posts: social media content drafts
CREATE TABLE public.content_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id),
  platform text NOT NULL,
  caption text NOT NULL,
  image_url text,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own posts"
  ON public.content_posts FOR ALL
  USING (auth.uid() = agent_id);

-- message_templates: reusable message templates
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  content_en text,
  content_zh text,
  channels text[],
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read own or global templates"
  ON public.message_templates FOR SELECT
  USING (auth.uid() = agent_id OR is_global = true);

CREATE POLICY "Agents manage own templates"
  ON public.message_templates FOR INSERT
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents update own templates"
  ON public.message_templates FOR UPDATE
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents delete own templates"
  ON public.message_templates FOR DELETE
  USING (auth.uid() = agent_id);

-- documents_generated: AI-generated documents
CREATE TABLE public.documents_generated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  property_id uuid REFERENCES public.properties(id),
  lead_id uuid REFERENCES public.leads(id),
  content_json jsonb,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents_generated ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage own documents"
  ON public.documents_generated FOR ALL
  USING (auth.uid() = agent_id);
