-- Field Recording Support Migration
-- Run this in the Supabase SQL editor

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'vapi_call',
  ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Update existing rows to mark them as vapi calls
UPDATE training_sessions
SET source = 'vapi_call'
WHERE source IS NULL;
