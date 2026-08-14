
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_role      TEXT;
  v_full_name TEXT;
  v_slug      TEXT;
BEGIN
  v_role      := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name',
                           SPLIT_PART(NEW.email, '@', 1));

  -- profiles (Edge Function already upserted; this is the fallback)
  INSERT INTO public.profiles (id, email, full_name, is_active)
  VALUES (NEW.id, NEW.email, v_full_name, true)
  ON CONFLICT (id) DO NOTHING;

  -- user_roles (Edge Function already upserted; this is the fallback)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- agent_profiles skeleton (only if agent and not already created)
  IF v_role = 'agent' THEN
    v_slug := LOWER(REGEXP_REPLACE(
                REGEXP_REPLACE(v_full_name, '[^a-zA-Z0-9\s]', '', 'g'),
                '\s+', '-', 'g'))
              || '-' || SUBSTRING(NEW.id::TEXT, 1, 4);

    INSERT INTO public.agent_profiles (id, slug, cea_no, is_featured, display_order)
    VALUES (NEW.id, v_slug, 'PENDING-' || SUBSTRING(NEW.id::TEXT, 1, 8), false, 99)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
