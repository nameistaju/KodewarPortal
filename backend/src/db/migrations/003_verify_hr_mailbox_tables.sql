-- Verification Script: 003_verify_hr_mailbox_tables.sql
-- Description: Diagnostic queries and repeatable smoke test for 003 HR mailbox migration.
-- Usage: Execute in Supabase SQL Editor as 'postgres' role.
-- Safety: Completely non-destructive. Uses isolated unique test IDs and cleans up automatically.

-- ============================================================================
-- 1. VERIFY TABLE EXISTENCE
-- ============================================================================
SELECT 
  table_schema, 
  table_name, 
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('hr_mailbox_sync_state', 'hr_emails')
ORDER BY table_name;

-- ============================================================================
-- 2. VERIFY ROW LEVEL SECURITY (RLS) STATUS
-- ============================================================================
SELECT 
  schemaname, 
  tablename, 
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('hr_mailbox_sync_state', 'hr_emails')
ORDER BY tablename;

-- ============================================================================
-- 3. VERIFY TABLE PRIVILEGES (anon, authenticated, service_role)
-- ============================================================================
-- Expected:
--   - anon: NO permissions
--   - authenticated: NO permissions
--   - service_role: SELECT, INSERT, UPDATE, DELETE
SELECT 
  grantee, 
  table_name, 
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name IN ('hr_mailbox_sync_state', 'hr_emails')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- ============================================================================
-- 4. VERIFY CONCURRENCY LOCK FUNCTIONS & PRIVILEGES
-- ============================================================================
SELECT 
  r.routine_name, 
  r.security_type,
  p.grantee, 
  p.privilege_type
FROM information_schema.routines r
JOIN information_schema.routine_privileges p 
  ON r.routine_schema = p.routine_schema 
 AND r.routine_name = p.routine_name
WHERE r.routine_schema = 'public'
  AND r.routine_name IN ('acquire_hr_mailbox_lock', 'renew_hr_mailbox_lock', 'release_hr_mailbox_lock')
  AND p.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY r.routine_name, p.grantee;

-- ============================================================================
-- 5. VERIFY UNIQUE CONSTRAINTS AND INDEXES
-- ============================================================================
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename IN ('hr_mailbox_sync_state', 'hr_emails')
ORDER BY tablename, indexname;

-- ============================================================================
-- 6. REPEATABLE, EXCEPTION-SAFE FUNCTIONAL SMOKE TEST
-- ============================================================================
DO $$
DECLARE
  v_test_mailbox VARCHAR(255);
  v_test_folder VARCHAR(100);
  v_token_a UUID;
  v_token_b UUID;
  v_renew_ok BOOLEAN;
  v_bad_renew BOOLEAN;
  v_bad_release BOOLEAN;
  v_release_ok BOOLEAN;
  v_final_status VARCHAR(50);
  v_final_last_uid BIGINT;
  v_final_synced_count INT;
  v_final_uidvalidity BIGINT;
BEGIN
  -- 1. Generate unique mailbox and folder to guarantee zero collision across runs
  v_test_mailbox := 'smoke-' || pg_catalog.substr(pg_catalog.gen_random_uuid()::text, 1, 8) || '@kodewar.com';
  v_test_folder  := 'TEST-' || pg_catalog.substr(pg_catalog.gen_random_uuid()::text, 1, 8);

  -- 2. Execute test steps inside guarded block to guarantee cleanup on any assertion failure
  BEGIN
    -- Step A: Worker A acquires lock (120s lease)
    v_token_a := public.acquire_hr_mailbox_lock(
      p_mailbox_address => v_test_mailbox,
      p_folder          => v_test_folder,
      p_lease_seconds   => 120
    );
    IF v_token_a IS NULL THEN
      RAISE EXCEPTION 'TEST STEP A FAILED: Worker A could not acquire lock';
    END IF;

    -- Step B: Worker B concurrent acquisition must fail (return NULL) while Worker A holds active lease
    v_token_b := public.acquire_hr_mailbox_lock(
      p_mailbox_address => v_test_mailbox,
      p_folder          => v_test_folder,
      p_lease_seconds   => 120
    );
    IF v_token_b IS NOT NULL THEN
      RAISE EXCEPTION 'TEST STEP B FAILED: Concurrent acquire should have returned NULL, got %', v_token_b;
    END IF;

    -- Step C: Worker A renews lease and advances progress checkpoint
    v_renew_ok := public.renew_hr_mailbox_lock(
      p_mailbox_address       => v_test_mailbox,
      p_folder                => v_test_folder,
      p_lock_token            => v_token_a,
      p_lease_seconds         => 120,
      p_last_synced_uid       => 50::bigint,
      p_messages_synced_delta => 10
    );
    IF NOT v_renew_ok THEN
      RAISE EXCEPTION 'TEST STEP C FAILED: Worker A valid renewal returned FALSE';
    END IF;

    -- Step D: Renewal with invalid token must fail (return FALSE)
    v_bad_renew := public.renew_hr_mailbox_lock(
      p_mailbox_address       => v_test_mailbox,
      p_folder                => v_test_folder,
      p_lock_token            => pg_catalog.gen_random_uuid(),
      p_lease_seconds         => 120,
      p_last_synced_uid       => NULL,
      p_messages_synced_delta => 0
    );
    IF v_bad_renew THEN
      RAISE EXCEPTION 'TEST STEP D FAILED: Renewal with invalid token unexpectedly returned TRUE';
    END IF;

    -- Step E: Simulate lease expiration for Worker A
    UPDATE public.hr_mailbox_sync_state
    SET lock_expires_at = pg_catalog.now() - INTERVAL '5 seconds'
    WHERE mailbox_address = v_test_mailbox AND folder = v_test_folder;

    -- Step F: Expired Worker A renewal must fail (return FALSE)
    v_renew_ok := public.renew_hr_mailbox_lock(
      p_mailbox_address       => v_test_mailbox,
      p_folder                => v_test_folder,
      p_lock_token            => v_token_a,
      p_lease_seconds         => 120,
      p_last_synced_uid       => NULL,
      p_messages_synced_delta => 0
    );
    IF v_renew_ok THEN
      RAISE EXCEPTION 'TEST STEP F FAILED: Expired Worker A renewal unexpectedly returned TRUE';
    END IF;

    -- Step G: Expired Worker A release must fail (return FALSE)
    v_release_ok := public.release_hr_mailbox_lock(
      p_mailbox_address       => v_test_mailbox,
      p_folder                => v_test_folder,
      p_lock_token            => v_token_a,
      p_last_synced_uid       => 999::bigint,
      p_messages_synced_delta => 100,
      p_error_message         => NULL,
      p_uidvalidity           => NULL
    );
    IF v_release_ok THEN
      RAISE EXCEPTION 'TEST STEP G FAILED: Expired Worker A release unexpectedly returned TRUE';
    END IF;

    -- Step H: Worker B acquires lock over expired Worker A
    v_token_b := public.acquire_hr_mailbox_lock(
      p_mailbox_address => v_test_mailbox,
      p_folder          => v_test_folder,
      p_lease_seconds   => 120
    );
    IF v_token_b IS NULL OR v_token_b = v_token_a THEN
      RAISE EXCEPTION 'TEST STEP H FAILED: Worker B failed to take over expired lease';
    END IF;

    -- Step I: Worker A (with old token) attempts to release Worker B's lock -> must fail
    v_bad_release := public.release_hr_mailbox_lock(
      p_mailbox_address       => v_test_mailbox,
      p_folder                => v_test_folder,
      p_lock_token            => v_token_a,
      p_last_synced_uid       => 111::bigint,
      p_messages_synced_delta => 0,
      p_error_message         => NULL,
      p_uidvalidity           => NULL
    );
    IF v_bad_release THEN
      RAISE EXCEPTION 'TEST STEP I FAILED: Expired Worker A released newer Worker B lock';
    END IF;

    -- Step J: Worker B releases cleanly with valid token, committing checkpoints and uidvalidity
    v_release_ok := public.release_hr_mailbox_lock(
      p_mailbox_address       => v_test_mailbox,
      p_folder                => v_test_folder,
      p_lock_token            => v_token_b,
      p_last_synced_uid       => 60::bigint,
      p_messages_synced_delta => 10,
      p_error_message         => NULL,
      p_uidvalidity           => 20261014::bigint
    );
    IF NOT v_release_ok THEN
      RAISE EXCEPTION 'TEST STEP J FAILED: Worker B valid release returned FALSE';
    END IF;

    -- Step K: Verify final sync state is IDLE with correct checkpoints and uidvalidity
    SELECT status, last_synced_uid, total_messages_synced, uidvalidity
    INTO v_final_status, v_final_last_uid, v_final_synced_count, v_final_uidvalidity
    FROM public.hr_mailbox_sync_state 
    WHERE mailbox_address = v_test_mailbox AND folder = v_test_folder;

    IF v_final_status != 'IDLE' THEN
      RAISE EXCEPTION 'TEST STEP K FAILED: Expected status IDLE, found %', v_final_status;
    END IF;

    IF v_final_last_uid != 60 THEN
      RAISE EXCEPTION 'TEST STEP K FAILED: Expected last_synced_uid = 60, found %', v_final_last_uid;
    END IF;

    IF v_final_synced_count != 20 THEN
      RAISE EXCEPTION 'TEST STEP K FAILED: Expected total_messages_synced = 20, found %', v_final_synced_count;
    END IF;

    IF v_final_uidvalidity != 20261014 THEN
      RAISE EXCEPTION 'TEST STEP K FAILED: Expected uidvalidity = 20261014, found %', v_final_uidvalidity;
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      -- Guarantee cleanup on assertion failure
      DELETE FROM public.hr_mailbox_sync_state 
      WHERE mailbox_address = v_test_mailbox AND folder = v_test_folder;
      RAISE;
  END;

  -- Guarantee cleanup on success
  DELETE FROM public.hr_mailbox_sync_state 
  WHERE mailbox_address = v_test_mailbox AND folder = v_test_folder;

  RAISE NOTICE 'SUCCESS: All 003 HR mailbox migration verification checks passed perfectly!';
END $$;
