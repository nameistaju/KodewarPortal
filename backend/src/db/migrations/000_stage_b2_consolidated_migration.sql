-- ============================================================================
-- KODEWAR HR WORKSPACE — CONSOLIDATED STAGE B2 DATABASE MIGRATION
-- File: backend/src/db/migrations/000_stage_b2_consolidated_migration.sql
-- Description:
--   Creates persistent candidate profiles, job requisitions, application pipeline,
--   document verification queue, audit histories, and email classification fields.
-- Execution:
--   Run this entire script in Supabase Dashboard -> SQL Editor -> Run.
-- Safety:
--   Idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
--   Preserves all 180 existing records in public.hr_emails and public.hr_mailbox_sync_state.
--   Zero data deletion. RLS enabled on all new tables with service_role access.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD CLASSIFICATION COLUMNS TO public.hr_emails (IF NOT PRESENT)
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.hr_emails
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Needs Human Review',
  ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(3, 2) DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS classification_reason TEXT,
  ADD COLUMN IF NOT EXISTS manual_category_override VARCHAR(50),
  ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS hr_emails_category_idx ON public.hr_emails(category);

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.hr_candidates (Persistent Candidate Profiles)
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS hr_candidates_email_idx ON public.hr_candidates(email);
CREATE INDEX IF NOT EXISTS hr_candidates_lower_email_idx ON public.hr_candidates(LOWER(email));
CREATE INDEX IF NOT EXISTS hr_candidates_status_idx ON public.hr_candidates(status);
CREATE INDEX IF NOT EXISTS hr_candidates_created_idx ON public.hr_candidates(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. TABLE: public.hr_candidate_emails (M:N Candidate-Email Linkage)
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS hr_candidate_emails_cand_idx ON public.hr_candidate_emails(candidate_id);
CREATE INDEX IF NOT EXISTS hr_candidate_emails_mail_idx ON public.hr_candidate_emails(email_id);

-- ----------------------------------------------------------------------------
-- 4. TABLE: public.hr_candidate_audit_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_candidate_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.hr_candidates(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_candidate_audit_cand_idx ON public.hr_candidate_audit_logs(candidate_id);
CREATE INDEX IF NOT EXISTS hr_candidate_audit_created_idx ON public.hr_candidate_audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. TABLE: public.hr_jobs (Job Requisitions)
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS hr_jobs_status_idx ON public.hr_jobs(status);
CREATE INDEX IF NOT EXISTS hr_jobs_dept_idx ON public.hr_jobs(department);
CREATE INDEX IF NOT EXISTS hr_jobs_created_idx ON public.hr_jobs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. TABLE: public.hr_applications (Candidate Job Applications)
-- ----------------------------------------------------------------------------
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

-- Unique constraint: A candidate cannot apply twice for the SAME job requisition.
-- When job_id is NULL (unassigned review queue), multiple entries are permitted.
CREATE UNIQUE INDEX IF NOT EXISTS hr_applications_candidate_job_unique_idx
  ON public.hr_applications (candidate_id, job_id)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS hr_applications_cand_idx ON public.hr_applications(candidate_id);
CREATE INDEX IF NOT EXISTS hr_applications_job_idx ON public.hr_applications(job_id);
CREATE INDEX IF NOT EXISTS hr_applications_status_idx ON public.hr_applications(status);
CREATE INDEX IF NOT EXISTS hr_applications_source_idx ON public.hr_applications(source);
CREATE INDEX IF NOT EXISTS hr_applications_applied_idx ON public.hr_applications(applied_at DESC);

-- ----------------------------------------------------------------------------
-- 7. TABLE: public.hr_application_audit_logs
-- ----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS hr_app_audit_app_idx ON public.hr_application_audit_logs(application_id);
CREATE INDEX IF NOT EXISTS hr_app_audit_created_idx ON public.hr_application_audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 8. TABLE: public.hr_document_verifications (Document Verification Queue)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_document_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES public.hr_emails(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.hr_candidates(id) ON DELETE SET NULL,
  attachment_index INT NOT NULL DEFAULT 0,
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100),
  size_bytes BIGINT DEFAULT 0,
  document_type VARCHAR(50) NOT NULL DEFAULT 'OTHER',
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  review_notes TEXT,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hr_doc_verif_status_check CHECK (
    status IN ('PENDING', 'VERIFIED', 'REJECTED', 'INCOMPLETE')
  ),
  CONSTRAINT hr_doc_verif_type_check CHECK (
    document_type IN ('ID_PHOTO', 'OFFER_LETTER', 'DEGREE_CERTIFICATE', 'MARKSHEET', 'GOVT_ID', 'RESUME', 'OTHER')
  ),
  CONSTRAINT hr_doc_verif_unique_attachment UNIQUE (email_id, attachment_index)
);

CREATE INDEX IF NOT EXISTS hr_doc_verif_status_idx ON public.hr_document_verifications(status);
CREATE INDEX IF NOT EXISTS hr_doc_verif_email_idx ON public.hr_document_verifications(email_id);
CREATE INDEX IF NOT EXISTS hr_doc_verif_cand_idx ON public.hr_document_verifications(candidate_id);

-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ----------------------------------------------------------------------------
ALTER TABLE public.hr_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_candidate_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_candidate_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_application_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_document_verifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hr_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_candidate_emails FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_candidate_audit_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_applications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_application_audit_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.hr_document_verifications FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.hr_candidates TO service_role;
GRANT ALL ON TABLE public.hr_candidate_emails TO service_role;
GRANT ALL ON TABLE public.hr_candidate_audit_logs TO service_role;
GRANT ALL ON TABLE public.hr_jobs TO service_role;
GRANT ALL ON TABLE public.hr_applications TO service_role;
GRANT ALL ON TABLE public.hr_application_audit_logs TO service_role;
GRANT ALL ON TABLE public.hr_document_verifications TO service_role;

DROP POLICY IF EXISTS hr_candidates_service_role_policy ON public.hr_candidates;
CREATE POLICY hr_candidates_service_role_policy ON public.hr_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hr_candidate_emails_service_role_policy ON public.hr_candidate_emails;
CREATE POLICY hr_candidate_emails_service_role_policy ON public.hr_candidate_emails FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hr_candidate_audit_service_role_policy ON public.hr_candidate_audit_logs;
CREATE POLICY hr_candidate_audit_service_role_policy ON public.hr_candidate_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hr_jobs_service_role_policy ON public.hr_jobs;
CREATE POLICY hr_jobs_service_role_policy ON public.hr_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hr_applications_service_role_policy ON public.hr_applications;
CREATE POLICY hr_applications_service_role_policy ON public.hr_applications FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hr_app_audit_service_role_policy ON public.hr_application_audit_logs;
CREATE POLICY hr_app_audit_service_role_policy ON public.hr_application_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hr_doc_verif_service_role_policy ON public.hr_document_verifications;
CREATE POLICY hr_doc_verif_service_role_policy ON public.hr_document_verifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 10. REFRESH POSTGREST SCHEMA CACHE
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
