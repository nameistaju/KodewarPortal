-- Migration: 005_create_hr_job_and_application_tables.sql
-- Description: Normalized Job Requisitions, Application Pipeline, and Application Audit History for KODEWAR HR Workspace.
-- Architecture: Supabase PostgreSQL (Accessed strictly via backend service-role client).
-- Security:
--   1. RLS enabled on all tables; explicit REVOKE from 'PUBLIC', 'anon', and 'authenticated'.
--   2. Only 'service_role' possesses table DML permissions.
--   3. Cascade safety on foreign keys.
--   4. Duplicate prevention for candidate-job pairs while allowing multiple jobs per candidate.

-- ============================================================================
-- 1. TABLE: public.hr_jobs (Job Requisitions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_code VARCHAR(50) UNIQUE,
  title VARCHAR(200) NOT NULL,
  department VARCHAR(100) NOT NULL,
  description TEXT,
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  qualifications TEXT,
  location VARCHAR(100) NOT NULL DEFAULT 'Remote',
  employment_type VARCHAR(50) NOT NULL DEFAULT 'FULL_TIME',
  openings_count INT NOT NULL DEFAULT 1,
  hiring_manager VARCHAR(200),
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_jobs_status_check CHECK (
    status IN ('DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'ARCHIVED')
  ),
  CONSTRAINT hr_jobs_employment_type_check CHECK (
    employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'FREELANCE')
  ),
  CONSTRAINT hr_jobs_openings_check CHECK (
    openings_count >= 1
  )
);

-- ============================================================================
-- 2. TABLE: public.hr_applications (Candidate Job Applications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.hr_candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.hr_jobs(id) ON DELETE SET NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'EMAIL',
  source_details TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_id UUID REFERENCES public.hr_emails(id) ON DELETE SET NULL,
  notes TEXT,
  rating INT,
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_applications_status_check CHECK (
    status IN ('APPLIED', 'SCREENING', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN')
  ),
  CONSTRAINT hr_applications_source_check CHECK (
    source IN ('INSTAGRAM', 'EMAIL', 'REFERRAL', 'WEBSITE', 'CAREERS_PAGE', 'WALK_IN', 'OTHER')
  ),
  CONSTRAINT hr_applications_rating_check CHECK (
    rating IS NULL OR (rating >= 1 AND rating <= 5)
  )
);

-- Compound unique constraint: Candidate can only have ONE application per job requisition.
-- If job_id is NULL (unassigned review queue), multiple entries are allowed for HR sorting.
CREATE UNIQUE INDEX IF NOT EXISTS hr_applications_candidate_job_unique_idx
  ON public.hr_applications (candidate_id, job_id)
  WHERE job_id IS NOT NULL;

-- ============================================================================
-- 3. TABLE: public.hr_application_audit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.hr_application_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.hr_applications(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. PERFORMANCE & LOOKUP INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS hr_jobs_status_idx ON public.hr_jobs(status);
CREATE INDEX IF NOT EXISTS hr_jobs_dept_idx ON public.hr_jobs(department);
CREATE INDEX IF NOT EXISTS hr_jobs_created_idx ON public.hr_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS hr_applications_candidate_idx ON public.hr_applications(candidate_id);
CREATE INDEX IF NOT EXISTS hr_applications_job_idx ON public.hr_applications(job_id);
CREATE INDEX IF NOT EXISTS hr_applications_status_idx ON public.hr_applications(status);
CREATE INDEX IF NOT EXISTS hr_applications_source_idx ON public.hr_applications(source);
CREATE INDEX IF NOT EXISTS hr_applications_email_idx ON public.hr_applications(email_id);
CREATE INDEX IF NOT EXISTS hr_applications_applied_idx ON public.hr_applications(applied_at DESC);

CREATE INDEX IF NOT EXISTS hr_app_audit_app_idx ON public.hr_application_audit_logs(application_id);
CREATE INDEX IF NOT EXISTS hr_app_audit_created_idx ON public.hr_application_audit_logs(created_at DESC);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ============================================================================
ALTER TABLE public.hr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_application_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hr_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_applications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_application_audit_logs FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.hr_jobs TO service_role;
GRANT ALL ON TABLE public.hr_applications TO service_role;
GRANT ALL ON TABLE public.hr_application_audit_logs TO service_role;

DROP POLICY IF EXISTS hr_jobs_service_role_policy ON public.hr_jobs;
CREATE POLICY hr_jobs_service_role_policy
  ON public.hr_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS hr_applications_service_role_policy ON public.hr_applications;
CREATE POLICY hr_applications_service_role_policy
  ON public.hr_applications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS hr_app_audit_service_role_policy ON public.hr_application_audit_logs;
CREATE POLICY hr_app_audit_service_role_policy
  ON public.hr_application_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
