-- Verification Script: 004_verify_hr_candidate_tables.sql
-- Description: Diagnostic verification for 004 HR Candidate tables, RLS, and constraints.
-- Usage: Execute in Supabase SQL Editor as 'postgres' role.

-- 1. Verify table existence
SELECT 
  table_schema, 
  table_name, 
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('hr_candidates', 'hr_candidate_emails', 'hr_candidate_audit_logs')
ORDER BY table_name;

-- 2. Verify RLS status
SELECT 
  schemaname, 
  tablename, 
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('hr_candidates', 'hr_candidate_emails', 'hr_candidate_audit_logs')
ORDER BY tablename;

-- 3. Verify permissions (service_role only)
SELECT 
  grantee, 
  table_name, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name IN ('hr_candidates', 'hr_candidate_emails', 'hr_candidate_audit_logs')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- 4. Check constraints
SELECT 
  conname, 
  conrelid::regclass AS table_name, 
  contype, 
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid::regclass::text IN ('public.hr_candidates', 'public.hr_candidate_emails', 'public.hr_candidate_audit_logs');
