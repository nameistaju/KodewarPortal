-- ============================================================================
-- VERIFICATION SCRIPT FOR MIGRATION 006 (Stage B3.3 Hardened Verification)
-- Read-only verification query suite for Supabase SQL Editor / CLI
-- ============================================================================

-- 1. Check columns of public.hr_document_verifications
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'hr_document_verifications'
ORDER BY ordinal_position;

-- 2. Check check constraints on public.hr_document_verifications
SELECT conname, pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' 
  AND c.conrelid = 'public.hr_document_verifications'::regclass
  AND c.contype = 'c';

-- 3. Check columns of public.hr_document_audit_logs
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'hr_document_audit_logs'
ORDER BY ordinal_position;

-- 4. Check foreign keys on public.hr_document_audit_logs (confirms ON DELETE RESTRICT)
SELECT conname, pg_get_constraintdef(c.oid) AS foreign_key_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' 
  AND c.conrelid = 'public.hr_document_audit_logs'::regclass
  AND c.contype = 'f';

-- 5. Check indexes on public.hr_document_audit_logs
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'hr_document_audit_logs';

-- 6. Check audit immutability trigger
SELECT tgname, pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
WHERE tgrelid = 'public.hr_document_audit_logs'::regclass
  AND NOT tgisinternal;

-- 7. Check RLS status and security policies
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('hr_document_verifications', 'hr_document_audit_logs');

SELECT policyname, tablename, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('hr_document_verifications', 'hr_document_audit_logs');

-- 8. Check atomic RPC functions, ownership, security definer flag, and search_path configuration
SELECT 
  p.proname AS function_name,
  r.rolname AS owner,
  pg_get_function_arguments(p.oid) AS function_arguments,
  p.prosecdef AS is_security_definer,
  p.proconfig AS search_path_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'fn_review_hr_document_with_audit',
    'fn_link_hr_document_candidate_with_audit',
    'fn_prevent_hr_doc_audit_modification'
  );

-- 9. Check function execution privileges (ensures PUBLIC/anon revoked, service_role granted)
SELECT 
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'fn_review_hr_document_with_audit',
    'fn_link_hr_document_candidate_with_audit',
    'fn_prevent_hr_doc_audit_modification'
  )
ORDER BY routine_name, grantee;

-- 10. Check row counts for documents, audit logs, and mailbox state
SELECT 
  (SELECT count(*) FROM public.hr_document_verifications) AS document_count,
  (SELECT count(*) FROM public.hr_document_audit_logs) AS audit_log_count,
  (SELECT count(*) FROM public.hr_emails) AS stored_email_count;

-- 11. Confirm mailbox sync checkpoint remains unchanged at UID 198 (180 messages)
SELECT mailbox_address, folder, uidvalidity, last_synced_uid, total_messages_synced, status, lock_token
FROM public.hr_mailbox_sync_state
WHERE mailbox_address = 'hr@kodewar.com';
