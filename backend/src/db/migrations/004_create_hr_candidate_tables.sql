-- Migration: 004_create_hr_candidate_tables.sql
-- Description: Persistent candidate management, email linkage, and audit history for KODEWAR HR Workspace.
-- Architecture: Supabase PostgreSQL (Accessed strictly via backend service-role client).
-- Security:
--   1. RLS enabled on all candidate tables; explicit REVOKE from 'PUBLIC', 'anon', and 'authenticated'.
--   2. Only 'service_role' possesses table DML permissions.
--   3. Auditing for all lifecycle changes (status changes, updates, email linking).
--   4. Cascade safety on foreign keys.

-- ============================================================================
-- 1. TABLE: public.hr_candidates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  source VARCHAR(50) NOT NULL DEFAULT 'EMAIL',
  source_details TEXT,
  target_role VARCHAR(255),
  experience_years NUMERIC(4, 1),
  current_company VARCHAR(255),
  current_title VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
  rating INT,
  notes TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_candidates_status_check CHECK (
    status IN ('APPLIED', 'SCREENING', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'ARCHIVED')
  ),
  CONSTRAINT hr_candidates_source_check CHECK (
    source IN ('EMAIL', 'INSTAGRAM', 'LINKEDIN', 'REFERRAL', 'CAREERS_PAGE', 'WALK_IN', 'OTHER')
  ),
  CONSTRAINT hr_candidates_rating_check CHECK (
    rating IS NULL OR (rating >= 1 AND rating <= 5)
  )
);

-- ============================================================================
-- 2. TABLE: public.hr_candidate_emails (N:M Linkage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_candidate_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.hr_candidates(id) ON DELETE CASCADE,
  email_id UUID NOT NULL REFERENCES public.hr_emails(id) ON DELETE CASCADE,
  is_primary_application BOOLEAN NOT NULL DEFAULT false,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_candidate_emails_unique_link UNIQUE (candidate_id, email_id)
);

-- ============================================================================
-- 3. TABLE: public.hr_candidate_audit_logs (Immutable Audit Trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_candidate_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.hr_candidates(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  performed_by VARCHAR(255),
  old_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES FOR HIGH-EFFICIENCY QUERIES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_hr_candidates_email_lower 
  ON public.hr_candidates(LOWER(email));

CREATE INDEX IF NOT EXISTS idx_hr_candidates_status 
  ON public.hr_candidates(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hr_candidates_source 
  ON public.hr_candidates(source);

CREATE INDEX IF NOT EXISTS idx_hr_candidates_full_name_lower 
  ON public.hr_candidates(LOWER(full_name));

CREATE INDEX IF NOT EXISTS idx_hr_candidate_emails_candidate 
  ON public.hr_candidate_emails(candidate_id);

CREATE INDEX IF NOT EXISTS idx_hr_candidate_emails_email 
  ON public.hr_candidate_emails(email_id);

CREATE INDEX IF NOT EXISTS idx_hr_candidate_audit_candidate 
  ON public.hr_candidate_audit_logs(candidate_id, created_at DESC);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) & PRIVILEGE ENFORCEMENT
-- ============================================================================
ALTER TABLE public.hr_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_candidate_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_candidate_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hr_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_candidate_emails FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_candidate_audit_logs FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_candidates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_candidate_emails TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hr_candidate_audit_logs TO service_role;
