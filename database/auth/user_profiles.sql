-- ============================================================
--  MedTrack | database/auth/user_profiles.sql
--  Links Supabase auth users to roles in our system
--  Run this in Supabase SQL Editor AFTER enabling Auth
-- ============================================================

CREATE TABLE user_profiles (
    id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name    VARCHAR(100) NOT NULL,
    role         VARCHAR(10)  NOT NULL DEFAULT 'patient'
                              CHECK (role IN ('admin','doctor','patient')),
    linked_id    INT,         -- patient_id or doctor_id depending on role
    created_at   TIMESTAMP    DEFAULT NOW()
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();