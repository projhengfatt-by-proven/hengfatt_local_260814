-- Allow admins to insert into activity log
CREATE POLICY "admins_insert_activity_log"
ON public.admin_activity_log
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);