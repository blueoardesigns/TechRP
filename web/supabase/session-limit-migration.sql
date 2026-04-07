-- web/supabase/session-limit-migration.sql
-- Run in Supabase SQL Editor → New Query

-- 1. Add session tracking columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sessions_used INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_limit INT NULL; -- NULL = unlimited

-- 2. Extend status to include 'suspended'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

-- 3. RPC function for atomic sessions_used increment (bypasses RLS)
CREATE OR REPLACE FUNCTION increment_sessions_used(target_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users SET sessions_used = sessions_used + 1 WHERE id = target_user_id;
$$;
