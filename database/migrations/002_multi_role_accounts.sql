-- ============================================================
--  MedTrack | migration 002
--  Allows one login (one auth.users row / one email) to hold
--  BOTH a patient and a doctor identity. user_profiles' primary
--  key becomes (id, role) instead of just id, so a second
--  "POST /api/account/add-role" call can insert a second row
--  for the same login without a second Supabase signup (which
--  would fail — Supabase auth emails are globally unique).
-- ============================================================

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_pkey;
ALTER TABLE user_profiles ADD PRIMARY KEY (id, role);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  )
  ON CONFLICT (id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
