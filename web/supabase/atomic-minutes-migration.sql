-- web/supabase/atomic-minutes-migration.sql
--
-- Makes per-call minute deduction atomic. Previously the API route in
-- web/app/api/calls/record-usage/route.ts did a read-modify-write
-- (SELECT minutes_pool → compute → UPDATE) which loses updates when two
-- calls end concurrently. This function performs the org-pool decrement,
-- the user counter increment, and the audit-log insert in a single
-- statement-atomic transaction and returns the resulting users.minutes_used
-- so the caller can apply the trial cutoff.
--
-- Behaviour is identical to the prior route logic:
--   • org pool floored at 0 (GREATEST(0, pool - minutes))
--   • org update only applies when p_org_id is non-null
--   • minute_transactions row recorded with delta = -minutes, type 'call_usage'

CREATE OR REPLACE FUNCTION record_call_usage(
  p_user_id    uuid,
  p_org_id     uuid,
  p_minutes    integer,
  p_session_id uuid
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_minutes_used integer;
BEGIN
  -- Deduct from org pool for company users (never below zero).
  IF p_org_id IS NOT NULL THEN
    UPDATE organizations
      SET minutes_pool = GREATEST(0, COALESCE(minutes_pool, 0) - p_minutes)
      WHERE id = p_org_id;
  END IF;

  -- Increment the user's used-minutes counter.
  UPDATE users
    SET minutes_used = COALESCE(minutes_used, 0) + p_minutes
    WHERE id = p_user_id
    RETURNING minutes_used INTO v_new_minutes_used;

  -- Audit log.
  INSERT INTO minute_transactions (user_id, org_id, type, delta, session_id)
    VALUES (p_user_id, p_org_id, 'call_usage', -p_minutes, p_session_id);

  RETURN v_new_minutes_used;
END;
$$;
