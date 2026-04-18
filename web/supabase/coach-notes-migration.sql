-- Coach Notes Migration
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS coach_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  coach_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     text        NOT NULL DEFAULT '',
  is_shared   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_notes_session ON coach_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_coach   ON coach_notes(coach_id);

-- Service role bypass (same pattern as other tables)
ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_notes: service role bypass" ON coach_notes;
CREATE POLICY "coach_notes: service role bypass"
  ON coach_notes FOR ALL
  USING (auth.role() = 'service_role');
