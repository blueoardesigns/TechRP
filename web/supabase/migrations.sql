-- ============================================================
-- TechRP Migration — Personas + Scenario Playbooks
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── 1. Personas table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  scenario_type     TEXT NOT NULL,
  name              TEXT NOT NULL,
  personality_type  TEXT NOT NULL,
  brief_description TEXT NOT NULL DEFAULT '',
  speaker_label     TEXT NOT NULL DEFAULT 'Contact',
  first_message     TEXT NOT NULL,
  system_prompt     TEXT NOT NULL,
  is_default        BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by scenario
CREATE INDEX IF NOT EXISTS idx_personas_scenario_type ON personas(scenario_type);
CREATE INDEX IF NOT EXISTS idx_personas_org ON personas(organization_id);

-- ── 2. Add scenario_type to playbooks ────────────────────────────────────────
-- Links a playbook to a specific training scenario so it can be used as
-- the assessment rubric when evaluating calls of that type.
ALTER TABLE playbooks
  ADD COLUMN IF NOT EXISTS scenario_type TEXT;

-- Index for fast playbook lookup by scenario
CREATE INDEX IF NOT EXISTS idx_playbooks_scenario_type ON playbooks(scenario_type);

-- ── 3. Add persona context columns to training_sessions ──────────────────────
-- Store which persona was used so insights API can filter/group by scenario.
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS persona_id          TEXT,
  ADD COLUMN IF NOT EXISTS persona_name        TEXT,
  ADD COLUMN IF NOT EXISTS persona_scenario_type TEXT;

-- ── 4. (Optional) Disable RLS on new table while auth is not yet built ───────
ALTER TABLE personas DISABLE ROW LEVEL SECURITY;
