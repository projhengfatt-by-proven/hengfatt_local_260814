
-- Create the agent-uploads storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-uploads', 'agent-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Agents can upload files to their own folder
CREATE POLICY "Agents upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agent-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Agents can view their own files
CREATE POLICY "Agents view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'agent-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Agents can delete their own files
CREATE POLICY "Agents delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'agent-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
