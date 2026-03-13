-- Storage Buckets Setup
-- Run this after creating the tables in schema.sql
-- These commands need to be run in Supabase Dashboard > Storage

-- Note: Storage buckets are typically created via the Supabase Dashboard or API
-- This file documents what buckets you need to create

-- Required Storage Buckets:
-- 1. 'recordings' - for training session audio recordings
-- 2. 'playbooks' - for uploaded playbook PDF/text files

-- Storage Policies (run these in SQL Editor after creating buckets)

-- Recordings bucket policies
-- Allow authenticated users to upload recordings (technicians creating their own sessions)
CREATE POLICY "Technicians can upload recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'recordings' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to read recordings from their organization
CREATE POLICY "Users can read recordings from their organization"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'recordings' AND
    auth.uid() IS NOT NULL
    -- Note: You may want to add organization-based filtering here
    -- This is a basic policy - adjust based on your folder structure
  );

-- Playbooks bucket policies
-- Allow managers to upload playbooks
CREATE POLICY "Managers can upload playbooks"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'playbooks' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'manager'
    )
  );

-- Allow users to read playbooks from their organization
CREATE POLICY "Users can read playbooks from their organization"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'playbooks' AND
    auth.uid() IS NOT NULL
  );




