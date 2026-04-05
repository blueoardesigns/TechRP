-- Add superuser to app_role check
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_app_role_check;
ALTER TABLE users ADD CONSTRAINT users_app_role_check
  CHECK (app_role IN ('individual', 'company_admin', 'coach', 'superuser'));
