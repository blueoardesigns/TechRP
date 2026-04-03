-- ============================================================
-- Auth Migration — TechRP Module 1
-- Run this in the Supabase SQL editor
-- ============================================================

-- 1. Add auth columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS full_name      TEXT,
  ADD COLUMN IF NOT EXISTS email          TEXT,
  ADD COLUMN IF NOT EXISTS app_role       TEXT NOT NULL DEFAULT 'individual'
    CHECK (app_role IN ('individual', 'company_admin')),
  ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS scenario_access TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;

-- 2. Index for fast auth_user_id lookups (used on every page load)
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_idx ON users(auth_user_id);

-- 3. RLS — allow users to read their own row; service role can do everything
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth_user_id = auth.uid());

CREATE POLICY "Service role has full access"
  ON users FOR ALL
  USING (auth.role() = 'service_role');

-- Note: Supabase dashboard → Auth → Email → disable "Confirm email"
-- so users land on /pending immediately after signup without needing
-- to click a confirmation link first.
