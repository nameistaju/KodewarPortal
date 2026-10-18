-- ============================================================================
-- VERIFY STAGE B2 DATABASE TABLES IN SUPABASE SQL EDITOR
-- File: backend/src/db/migrations/000_verify_stage_b2_tables.sql
-- ============================================================================

-- 1. Check all required tables exist
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) AS column_count
FROM (
  VALUES
    ('hr_emails'),
    ('hr_mailbox_sync_state'),
    ('hr_candidates'),
    ('hr_candidate_emails'),
    ('hr_candidate_audit_logs'),
    ('hr_jobs'),
    ('hr_applications'),
    ('hr_application_audit_logs'),
    ('hr_document_verifications')
) AS t(table_name)
LEFT JOIN information_schema.tables ist
  ON ist.table_schema = 'public' AND ist.table_name = t.table_name
ORDER BY table_name;

-- 2. Check classification columns on public.hr_emails
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hr_emails'
  AND column_name IN ('category', 'classification_confidence', 'classification_reason', 'manual_category_override', 'classified_at');

-- 3. Check Row Level Security (RLS) status
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'hr_candidates',
    'hr_candidate_emails',
    'hr_candidate_audit_logs',
    'hr_jobs',
    'hr_applications',
    'hr_application_audit_logs',
    'hr_document_verifications'
  )
ORDER BY tablename;
