-- Seed script for TechRP
-- Run this AFTER creating the schema and setting up Supabase Auth
-- This creates a test organization and users for development

-- IMPORTANT: Before running this script:
-- 1. Create the schema using shared/schema.sql
-- 2. Set up Supabase Auth users in the Dashboard or via your app
-- 3. Replace the UUIDs below with actual auth.uid() values from your Supabase Auth users
-- 4. Or use the function below to create auth users first

-- Option 1: Create auth users first (run this in Supabase SQL Editor with service role)
-- You'll need to replace these with actual auth user IDs after creating them in Supabase Auth
-- For now, we'll use placeholder UUIDs that you'll replace

-- Step 1: Create a test organization
INSERT INTO organizations (id, name)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Test Company')
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create test users
-- NOTE: Replace these UUIDs with actual auth.uid() values from Supabase Auth
-- You can get these by creating users in Supabase Dashboard > Authentication > Users
-- Or by signing up users through your app and copying their IDs

-- Manager user (replace MANAGER_AUTH_UID with actual auth user ID)
-- Example: If manager signs up with email manager@test.com, copy their auth.uid()
INSERT INTO users (id, email, name, role, organization_id)
VALUES 
  (
    'MANAGER_AUTH_UID',  -- REPLACE THIS with actual auth.uid() from Supabase Auth
    'manager@test.com',
    'Test Manager',
    'manager',
    '00000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role;

-- Technician user (replace TECHNICIAN_AUTH_UID with actual auth user ID)
INSERT INTO users (id, email, name, role, organization_id)
VALUES 
  (
    'TECHNICIAN_AUTH_UID',  -- REPLACE THIS with actual auth.uid() from Supabase Auth
    'technician@test.com',
    'Test Technician',
    'technician',
    '00000000-0000-0000-0000-000000000001'
  )
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role;

-- Step 3: Create a sample playbook (optional)
-- This will only work if you've created the manager user above
INSERT INTO playbooks (organization_id, name, content, uploaded_by)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  'Sample Objection Handling Playbook',
  'OBJECTION: "I need to think about it"
RESPONSE: "I completely understand. Can I ask what specifically you''d like to think about? Often, homeowners are concerned about cost or timing. If it''s cost, we can discuss payment options. If it''s timing, we can work around your schedule."

OBJECTION: "I want to get other quotes"
RESPONSE: "That''s a smart approach. While you''re gathering quotes, I''d like to highlight that our equipment is available immediately, which can be crucial for preventing further damage. Many of our customers choose us because we can start the drying process today, potentially saving thousands in additional damage."

OBJECTION: "This seems expensive"
RESPONSE: "I understand cost is a concern. Let me break down what you''re getting: professional-grade equipment, 24/7 monitoring, and rapid response. The cost of waiting can often exceed the cost of immediate action. We also offer flexible payment options. What budget range were you thinking?"',
  id
FROM users
WHERE email = 'manager@test.com' AND role = 'manager'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Verification queries (run these to check your seed data)
-- SELECT * FROM organizations;
-- SELECT * FROM users;
-- SELECT * FROM playbooks;




