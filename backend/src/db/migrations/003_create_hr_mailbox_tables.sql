-- Migration: 003_create_hr_mailbox_tables.sql
-- Description: Production-hardened additive tables and atomic lease-locked functions for HR mailbox sync.
-- Architecture: Supabase PostgreSQL (Accessed strictly via backend service-role client).
-- Security:
--   1. RLS enabled on all tables; explicit REVOKE from 'PUBLIC', 'anon', and 'authenticated'.
--   2. Only 'service_role' possesses table DML and function EXECUTE permissions.
--   3. Strict compound deduplication on (mailbox_address, folder, uidvalidity, uid).
--   4. Token-protected atomic sync lock acquisition, renewal, and release with lease expiration.
--   5. SECURITY DEFINER search_path pinned to 'pg_catalog' only (excluding public and pg_temp).
--   6. Standard SQL COALESCE syntax and regular PostgreSQL function calls (btrim, strpos, substr).
--   7. Attachment metadata only (filename, contentType, size); no binary blobs or passwords stored.

-- ============================================================================
-- 1. TABLE: public.hr_mailbox_sync_state
-- ============================================================================
-- Tracks synchronization checkpoints, IMAP UIDVALIDITY epochs, and lease locks.
CREATE TABLE IF NOT EXISTS public.hr_mailbox_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_address VARCHAR(255) NOT NULL,
  folder VARCHAR(100) NOT NULL DEFAULT 'INBOX',
  uidvalidity BIGINT NOT NULL DEFAULT 0,
  last_synced_uid BIGINT NOT NULL DEFAULT 0,
  highest_modseq BIGINT DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'IDLE',
  lock_token UUID,
  lock_acquired_at TIMESTAMPTZ,
  lock_expires_at TIMESTAMPTZ,
  last_sync_started_at TIMESTAMPTZ,
  last_sync_completed_at TIMESTAMPTZ,
  total_messages_synced INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_sync_state_mailbox_folder_key UNIQUE (mailbox_address, folder),
  CONSTRAINT hr_sync_state_status_check CHECK (status IN ('IDLE', 'SYNCING', 'ERROR'))
);

-- ============================================================================
-- 2. TABLE: public.hr_emails
-- ============================================================================
-- Stores ingested email metadata, textual bodies, and attachment summaries for HR workspace.
CREATE TABLE IF NOT EXISTS public.hr_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_address VARCHAR(255) NOT NULL,
  folder VARCHAR(100) NOT NULL DEFAULT 'INBOX',
  uidvalidity BIGINT NOT NULL,
  uid BIGINT NOT NULL,
  message_id VARCHAR(500),
  from_address VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_addresses JSONB DEFAULT '[]'::jsonb,
  bcc_addresses JSONB DEFAULT '[]'::jsonb,
  reply_to VARCHAR(255),
  subject TEXT,
  sent_at TIMESTAMPTZ,
  body_text TEXT,
  body_html TEXT,
  snippet VARCHAR(500),
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  processing_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_emails_mailbox_folder_uid_key UNIQUE (mailbox_address, folder, uidvalidity, uid),
  CONSTRAINT hr_emails_processing_status_check CHECK (processing_status IN ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED'))
);

-- ============================================================================
-- 3. SCHEMA MIGRATION SAFETY & COMPATIBILITY CHECKS
-- ============================================================================
-- Ensures columns exist if tables were created by an earlier prototype draft.
DO $$
BEGIN
  -- Re-run safety for hr_mailbox_sync_state columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_mailbox_sync_state') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hr_mailbox_sync_state' AND column_name = 'lock_token') THEN
      ALTER TABLE public.hr_mailbox_sync_state ADD COLUMN lock_token UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hr_mailbox_sync_state' AND column_name = 'highest_modseq') THEN
      ALTER TABLE public.hr_mailbox_sync_state ADD COLUMN highest_modseq BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hr_mailbox_sync_state' AND column_name = 'total_messages_synced') THEN
      ALTER TABLE public.hr_mailbox_sync_state ADD COLUMN total_messages_synced INT NOT NULL DEFAULT 0;
    END IF;
  END IF;

  -- Re-run safety for hr_emails columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_emails') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hr_emails' AND column_name = 'processing_status') THEN
      ALTER TABLE public.hr_emails ADD COLUMN processing_status VARCHAR(50) NOT NULL DEFAULT 'PENDING';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hr_emails' AND column_name = 'has_attachments') THEN
      ALTER TABLE public.hr_emails ADD COLUMN has_attachments BOOLEAN NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'hr_emails' AND column_name = 'attachments') THEN
      ALTER TABLE public.hr_emails ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE public.hr_mailbox_sync_state IS 'Maintains IMAP UID checkpoints, lease locks, and status for HR mail sync.';
COMMENT ON COLUMN public.hr_mailbox_sync_state.uidvalidity IS 'IMAP folder UIDVALIDITY. If changed by the server, client checkpoint resets.';
COMMENT ON COLUMN public.hr_mailbox_sync_state.lock_token IS 'Cryptographically unique UUID assigned to the active sync leaseholder.';
COMMENT ON COLUMN public.hr_mailbox_sync_state.lock_expires_at IS 'Lease expiration timestamp for atomic concurrency recovery.';

COMMENT ON TABLE public.hr_emails IS 'Ingested emails for HR recruitment and communications.';
COMMENT ON COLUMN public.hr_emails.uid IS 'RFC 3501 message UID, unique only within (mailbox_address, folder, uidvalidity).';
COMMENT ON COLUMN public.hr_emails.message_id IS 'RFC 822 Message-ID header (optional, not guaranteed unique across internet senders).';
COMMENT ON COLUMN public.hr_emails.attachments IS 'Metadata array of attachments ([{filename, contentType, size}]) without binary data.';

-- ============================================================================
-- 4. INDEXES FOR INBOX QUERIES (NON-REDUNDANT)
-- ============================================================================
-- Note: A separate index on (mailbox_address, folder, uidvalidity, uid) is omitted
-- because CONSTRAINT hr_emails_mailbox_folder_uid_key already creates a unique B-Tree index.

-- Fast inbox list ordered by sent date
CREATE INDEX IF NOT EXISTS idx_hr_emails_folder_sent 
  ON public.hr_emails(folder, sent_at DESC);

-- Fast sender lookup for candidate timeline aggregation
CREATE INDEX IF NOT EXISTS idx_hr_emails_from_address 
  ON public.hr_emails(from_address);

-- Sparse index for RFC 822 Message-ID deduplication lookup (only when message_id exists)
CREATE INDEX IF NOT EXISTS idx_hr_emails_message_id 
  ON public.hr_emails(message_id) 
  WHERE message_id IS NOT NULL;

-- Filter for unread or pending processing emails
CREATE INDEX IF NOT EXISTS idx_hr_emails_status 
  ON public.hr_emails(folder, is_read, processing_status);

-- ============================================================================
-- 5. ATOMIC CONCURRENCY FUNCTIONS (TOKEN & LEASE-BASED LOCKING)
-- ============================================================================

-- Clean up older function signatures if present to prevent parameter/return type conflicts
DROP FUNCTION IF EXISTS public.acquire_hr_mailbox_lock(VARCHAR, VARCHAR, INT);
DROP FUNCTION IF EXISTS public.renew_hr_mailbox_lock(VARCHAR, VARCHAR, UUID, INT);
DROP FUNCTION IF EXISTS public.renew_hr_mailbox_lock(VARCHAR, VARCHAR, UUID, INT, BIGINT, INT);
DROP FUNCTION IF EXISTS public.release_hr_mailbox_lock(VARCHAR, VARCHAR, BIGINT, INT, TEXT);
DROP FUNCTION IF EXISTS public.release_hr_mailbox_lock(VARCHAR, VARCHAR, UUID, BIGINT, INT, TEXT);
DROP FUNCTION IF EXISTS public.release_hr_mailbox_lock(VARCHAR, VARCHAR, UUID, BIGINT, INT, TEXT, BIGINT);

-- Function: acquire_hr_mailbox_lock
-- Atomically acquires a timed lease and returns a unique UUID lock token.
-- Returns NULL if the lock is currently held by an active, unexpired worker.
CREATE OR REPLACE FUNCTION public.acquire_hr_mailbox_lock(
  p_mailbox_address VARCHAR(255),
  p_folder VARCHAR(100),
  p_lease_seconds INT DEFAULT 300
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_new_token UUID;
  v_updated INT;
  v_clean_mailbox VARCHAR(255);
  v_clean_folder VARCHAR(100);
BEGIN
  -- 1. Input Validation
  IF p_mailbox_address IS NULL OR pg_catalog.btrim(p_mailbox_address) = '' OR pg_catalog.strpos(p_mailbox_address, '@') = 0 THEN
    RAISE EXCEPTION 'Invalid mailbox address: %', p_mailbox_address USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_folder IS NULL OR pg_catalog.btrim(p_folder) = '' THEN
    RAISE EXCEPTION 'Invalid folder name: %', p_folder USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_lease_seconds IS NULL OR p_lease_seconds < 10 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'Lease duration must be between 10 and 3600 seconds: %', p_lease_seconds USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_clean_mailbox := pg_catalog.btrim(p_mailbox_address);
  v_clean_folder := pg_catalog.btrim(p_folder);

  -- 2. Ensure row exists for this mailbox and folder
  INSERT INTO public.hr_mailbox_sync_state (mailbox_address, folder, status)
  VALUES (v_clean_mailbox, v_clean_folder, 'IDLE')
  ON CONFLICT (mailbox_address, folder) DO NOTHING;

  -- 3. Generate unique lock token
  v_new_token := pg_catalog.gen_random_uuid();

  -- 4. Atomically acquire lock only if IDLE, ERROR, or previous lease has expired
  UPDATE public.hr_mailbox_sync_state
  SET
    status = 'SYNCING',
    lock_token = v_new_token,
    lock_acquired_at = pg_catalog.now(),
    lock_expires_at = pg_catalog.now() + (p_lease_seconds || ' seconds')::INTERVAL,
    last_sync_started_at = pg_catalog.now(),
    error_message = NULL,
    updated_at = pg_catalog.now()
  WHERE mailbox_address = v_clean_mailbox
    AND folder = v_clean_folder
    AND (
      status != 'SYNCING'
      OR lock_expires_at IS NULL
      OR lock_expires_at < pg_catalog.now()
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    RETURN v_new_token;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Function: renew_hr_mailbox_lock
-- Extends the lease of an actively running worker and optionally advances checkpoints.
-- Fails (returns FALSE) if the token does not match or if the lease has already expired.
CREATE OR REPLACE FUNCTION public.renew_hr_mailbox_lock(
  p_mailbox_address VARCHAR(255),
  p_folder VARCHAR(100),
  p_lock_token UUID,
  p_lease_seconds INT DEFAULT 300,
  p_last_synced_uid BIGINT DEFAULT NULL,
  p_messages_synced_delta INT DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_updated INT;
  v_clean_mailbox VARCHAR(255);
  v_clean_folder VARCHAR(100);
BEGIN
  -- 1. Input Validation
  IF p_mailbox_address IS NULL OR pg_catalog.btrim(p_mailbox_address) = '' THEN
    RAISE EXCEPTION 'Invalid mailbox address: %', p_mailbox_address USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_folder IS NULL OR pg_catalog.btrim(p_folder) = '' THEN
    RAISE EXCEPTION 'Invalid folder name: %', p_folder USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_lock_token IS NULL THEN
    RAISE EXCEPTION 'Lock token is required for renewal' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_lease_seconds IS NULL OR p_lease_seconds < 10 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'Lease duration must be between 10 and 3600 seconds: %', p_lease_seconds USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_last_synced_uid IS NOT NULL AND p_last_synced_uid < 0 THEN
    RAISE EXCEPTION 'last_synced_uid cannot be negative: %', p_last_synced_uid USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_messages_synced_delta IS NOT NULL AND p_messages_synced_delta < 0 THEN
    RAISE EXCEPTION 'messages_synced_delta cannot be negative: %', p_messages_synced_delta USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_clean_mailbox := pg_catalog.btrim(p_mailbox_address);
  v_clean_folder := pg_catalog.btrim(p_folder);

  -- 2. Renew lease only if token matches, status is SYNCING, and lock has not expired
  UPDATE public.hr_mailbox_sync_state
  SET
    lock_expires_at = pg_catalog.now() + (p_lease_seconds || ' seconds')::INTERVAL,
    last_synced_uid = COALESCE(p_last_synced_uid, last_synced_uid),
    total_messages_synced = total_messages_synced + COALESCE(p_messages_synced_delta, 0),
    updated_at = pg_catalog.now()
  WHERE mailbox_address = v_clean_mailbox
    AND folder = v_clean_folder
    AND lock_token = p_lock_token
    AND status = 'SYNCING'
    AND lock_expires_at >= pg_catalog.now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN (v_updated > 0);
END;
$$;

-- Function: release_hr_mailbox_lock
-- Releases the sync lease and commits final progress checkpoints.
-- Fails (returns FALSE) if the token does not match or if the lease has already expired,
-- preventing expired workers from overwriting a new worker's lock or checkpoints.
CREATE OR REPLACE FUNCTION public.release_hr_mailbox_lock(
  p_mailbox_address VARCHAR(255),
  p_folder VARCHAR(100),
  p_lock_token UUID,
  p_last_synced_uid BIGINT DEFAULT NULL,
  p_messages_synced_delta INT DEFAULT 0,
  p_error_message TEXT DEFAULT NULL,
  p_uidvalidity BIGINT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_updated INT;
  v_clean_mailbox VARCHAR(255);
  v_clean_folder VARCHAR(100);
BEGIN
  -- 1. Input Validation
  IF p_mailbox_address IS NULL OR pg_catalog.btrim(p_mailbox_address) = '' THEN
    RAISE EXCEPTION 'Invalid mailbox address: %', p_mailbox_address USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_folder IS NULL OR pg_catalog.btrim(p_folder) = '' THEN
    RAISE EXCEPTION 'Invalid folder name: %', p_folder USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_lock_token IS NULL THEN
    RAISE EXCEPTION 'Lock token is required for release' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_last_synced_uid IS NOT NULL AND p_last_synced_uid < 0 THEN
    RAISE EXCEPTION 'last_synced_uid cannot be negative: %', p_last_synced_uid USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_messages_synced_delta IS NOT NULL AND p_messages_synced_delta < 0 THEN
    RAISE EXCEPTION 'messages_synced_delta cannot be negative: %', p_messages_synced_delta USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_uidvalidity IS NOT NULL AND p_uidvalidity <= 0 THEN
    RAISE EXCEPTION 'uidvalidity must be greater than zero: %', p_uidvalidity USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_clean_mailbox := pg_catalog.btrim(p_mailbox_address);
  v_clean_folder := pg_catalog.btrim(p_folder);

  -- 2. Release lock only if token matches, status is SYNCING, and lock has not expired
  UPDATE public.hr_mailbox_sync_state
  SET
    status = CASE WHEN p_error_message IS NOT NULL AND pg_catalog.btrim(p_error_message) != '' THEN 'ERROR' ELSE 'IDLE' END,
    lock_token = NULL,
    lock_acquired_at = NULL,
    lock_expires_at = NULL,
    last_sync_completed_at = pg_catalog.now(),
    uidvalidity = COALESCE(p_uidvalidity, uidvalidity),
    last_synced_uid = COALESCE(p_last_synced_uid, last_synced_uid),
    total_messages_synced = total_messages_synced + COALESCE(p_messages_synced_delta, 0),
    error_message = pg_catalog.substr(pg_catalog.btrim(p_error_message), 1, 1000),
    updated_at = pg_catalog.now()
  WHERE mailbox_address = v_clean_mailbox
    AND folder = v_clean_folder
    AND lock_token = p_lock_token
    AND status = 'SYNCING'
    AND lock_expires_at >= pg_catalog.now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN (v_updated > 0);
END;
$$;

-- Set explicit ownership to postgres (standard Supabase administrative role)
ALTER FUNCTION public.acquire_hr_mailbox_lock(VARCHAR, VARCHAR, INT) OWNER TO postgres;
ALTER FUNCTION public.renew_hr_mailbox_lock(VARCHAR, VARCHAR, UUID, INT, BIGINT, INT) OWNER TO postgres;
ALTER FUNCTION public.release_hr_mailbox_lock(VARCHAR, VARCHAR, UUID, BIGINT, INT, TEXT, BIGINT) OWNER TO postgres;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) & PRIVILEGE ENFORCEMENT
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE public.hr_mailbox_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_emails ENABLE ROW LEVEL SECURITY;

-- Revoke all table-level access from client PostgREST roles and PUBLIC
REVOKE ALL ON TABLE public.hr_mailbox_sync_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_emails FROM PUBLIC, anon, authenticated;

-- Revoke function execution from client PostgREST roles and PUBLIC
REVOKE ALL ON FUNCTION public.acquire_hr_mailbox_lock(VARCHAR, VARCHAR, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_hr_mailbox_lock(VARCHAR, VARCHAR, UUID, INT, BIGINT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_hr_mailbox_lock(VARCHAR, VARCHAR, UUID, BIGINT, INT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;

-- Grant exclusive permissions to backend service_role only
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_mailbox_sync_state TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_emails TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_hr_mailbox_lock(VARCHAR, VARCHAR, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_hr_mailbox_lock(VARCHAR, VARCHAR, UUID, INT, BIGINT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_hr_mailbox_lock(VARCHAR, VARCHAR, UUID, BIGINT, INT, TEXT, BIGINT) TO service_role;
