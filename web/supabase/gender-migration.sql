-- Add gender column to personas table
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'female' CHECK (gender IN ('male', 'female'));
