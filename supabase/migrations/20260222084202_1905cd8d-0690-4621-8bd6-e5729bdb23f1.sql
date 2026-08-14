
-- Allow authenticated admins to upload to agent-avatars bucket
CREATE POLICY "Admins can upload agent avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agent-avatars'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);

-- Allow admins to update/overwrite agent avatars
CREATE POLICY "Admins can update agent avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'agent-avatars'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);
