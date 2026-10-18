-- Verification: 005_verify_hr_job_and_application_tables.sql
-- Run in Supabase SQL Editor to verify Stage B2 migration schema.

-- 1. Table existence check
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('hr_jobs', 'hr_applications', 'hr_application_audit_logs')
ORDER BY table_name;

-- 2. Foreign keys check
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name IN ('hr_jobs', 'hr_applications', 'hr_application_audit_logs');

-- 3. Unique index and constraints check
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('hr_jobs', 'hr_applications', 'hr_application_audit_logs')
ORDER BY tablename, indexname;

-- 4. RLS status check
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('hr_jobs', 'hr_applications', 'hr_application_audit_logs');
