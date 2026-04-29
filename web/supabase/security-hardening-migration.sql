-- ============================================================
-- Security Hardening Migration
-- Follow-up to rls-billing-orgs-migration.sql
--
-- 1. Tighten increment_sessions_used so users can only bump
--    their own counter (was: any UUID accepted).
-- 2. Drop _demo_seed_sessions from public (seeding helper, not
--    needed on prod and exposed via PostgREST).
-- 3. Add per-coach RLS policies to coach_notes (was: only
--    service-role bypass, blocked direct supabase-js reads).
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- ── 1. increment_sessions_used: bind to caller ────────────────────────────────

CREATE OR REPLACE FUNCTION increment_sessions_used(target_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users
     SET sessions_used = sessions_used + 1
   WHERE id = target_user_id
     AND auth_user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION increment_sessions_used(UUID) FROM anon;
-- service_role and authenticated retain EXECUTE; the WHERE clause
-- now constrains effect to the caller's own row.

-- ── 2. Drop demo-seed helper from public ─────────────────────────────────────

DROP FUNCTION IF EXISTS _demo_seed_sessions(UUID, UUID, INT, INT, INT);

-- ── 3. coach_notes RLS policies ──────────────────────────────────────────────

DROP POLICY IF EXISTS "coach_notes: select"  ON coach_notes;
DROP POLICY IF EXISTS "coach_notes: insert"  ON coach_notes;
DROP POLICY IF EXISTS "coach_notes: update"  ON coach_notes;
DROP POLICY IF EXISTS "coach_notes: delete"  ON coach_notes;

-- Coach reads own notes; session owner reads only notes flagged is_shared
CREATE POLICY "coach_notes: select"
  ON coach_notes FOR SELECT
  USING (
    coach_id = _my_user_id()
    OR (
      is_shared = true
      AND session_id IN (
        SELECT id FROM training_sessions WHERE user_id = _my_user_id()
      )
    )
  );

-- Only coaches/superusers can create notes, and only as themselves
CREATE POLICY "coach_notes: insert"
  ON coach_notes FOR INSERT
  WITH CHECK (
    coach_id = _my_user_id()
    AND _my_role() IN ('coach', 'company_admin', 'superuser')
  );

-- Coach can update only their own notes
CREATE POLICY "coach_notes: update"
  ON coach_notes FOR UPDATE
  USING (coach_id = _my_user_id());

-- Coach can delete only their own notes
CREATE POLICY "coach_notes: delete"
  ON coach_notes FOR DELETE
  USING (coach_id = _my_user_id());
