-- ============================================================================
-- KODEWAR HR MANAGEMENT PORTAL — MIGRATION 006 (HARDENED)
-- Stage B3.3: Secure Document Verification & Atomic Audit Workflow
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. UPDATE CHECK CONSTRAINTS ON public.hr_document_verifications
-- ----------------------------------------------------------------------------

-- Drop old check constraints if they exist
ALTER TABLE public.hr_document_verifications 
  DROP CONSTRAINT IF EXISTS hr_doc_verif_status_check;

ALTER TABLE public.hr_document_verifications 
  DROP CONSTRAINT IF EXISTS hr_doc_verif_type_check;

-- Add updated check constraint supporting enterprise review statuses
-- Note: 'ACCEPTED' indicates an HR reviewer approval based on manual review,
-- NOT an automated guarantee of document authenticity.
ALTER TABLE public.hr_document_verifications 
  ADD CONSTRAINT hr_doc_verif_status_check CHECK (
    status IN (
      'NEEDS_REVIEW',
      'UNDER_REVIEW',
      'ACCEPTED',
      'REJECTED',
      'MORE_INFO_REQUIRED',
      'PENDING',
      'VERIFIED',
      'INCOMPLETE'
    )
  );

-- Add updated check constraint supporting standardized document categories
ALTER TABLE public.hr_document_verifications 
  ADD CONSTRAINT hr_doc_verif_type_check CHECK (
    document_type IN (
      'RESUME',
      'IDENTITY_DOCUMENT',
      'EDUCATION_CERTIFICATE',
      'EMPLOYMENT_DOCUMENT',
      'OFFER_JOINING_DOCUMENT',
      'PHOTOGRAPH',
      'OTHER',
      'UNCLASSIFIED',
      'GOVT_ID',
      'ID_PHOTO',
      'OFFER_LETTER',
      'DEGREE_CERTIFICATE',
      'MARKSHEET'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. TABLE: public.hr_document_audit_logs (Append-Only Audit Trail)
-- Retention Strategy: ON DELETE RESTRICT guarantees documents with audit trails
-- cannot be deleted, harmonizing with audit immutability.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_document_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.hr_document_verifications(id) ON DELETE RESTRICT,
  action VARCHAR(50) NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_doc_audit_doc_idx ON public.hr_document_audit_logs(document_id);
CREATE INDEX IF NOT EXISTS hr_doc_audit_created_idx ON public.hr_document_audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. AUDIT LOG IMMUTABILITY TRIGGER (Prevent Updates & Deletes)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_prevent_hr_doc_audit_modification()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Document audit log entries are immutable. Modification or deletion is forbidden.'
    USING ERRCODE = '27000';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_hr_doc_audit_modification ON public.hr_document_audit_logs;
CREATE TRIGGER trg_prevent_hr_doc_audit_modification
  BEFORE UPDATE OR DELETE ON public.hr_document_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_hr_doc_audit_modification();

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY & PERMISSIONS
-- ----------------------------------------------------------------------------
ALTER TABLE public.hr_document_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hr_document_audit_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hr_document_audit_logs TO service_role;

DROP POLICY IF EXISTS hr_doc_audit_service_role_policy ON public.hr_document_audit_logs;
CREATE POLICY hr_doc_audit_service_role_policy 
  ON public.hr_document_audit_logs 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. ATOMIC DATABASE RPC FUNCTIONS FOR TRANSACTIONAL INTEGRITY
-- Hardened with fixed search_path, explicit parameter validation,
-- note preservation, and restricted execution permissions.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_review_hr_document_with_audit(
  p_document_id UUID,
  p_status VARCHAR(50) DEFAULT NULL,
  p_category VARCHAR(50) DEFAULT NULL,
  p_review_notes TEXT DEFAULT NULL,
  p_update_notes BOOLEAN DEFAULT FALSE,
  p_candidate_id UUID DEFAULT NULL,
  p_update_candidate BOOLEAN DEFAULT FALSE,
  p_performed_by VARCHAR(255) DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_record RECORD;
  v_new_record RECORD;
  v_target_status VARCHAR(50);
  v_target_category VARCHAR(50);
  v_target_notes TEXT;
  v_target_candidate_id UUID;
  v_old_values JSONB;
  v_new_values JSONB;
  v_allowed_statuses CONSTANT TEXT[] := ARRAY[
    'NEEDS_REVIEW', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED',
    'MORE_INFO_REQUIRED', 'PENDING', 'VERIFIED', 'INCOMPLETE'
  ];
  v_allowed_categories CONSTANT TEXT[] := ARRAY[
    'RESUME', 'IDENTITY_DOCUMENT', 'EDUCATION_CERTIFICATE',
    'EMPLOYMENT_DOCUMENT', 'OFFER_JOINING_DOCUMENT', 'PHOTOGRAPH',
    'OTHER', 'UNCLASSIFIED', 'GOVT_ID', 'ID_PHOTO', 'OFFER_LETTER',
    'DEGREE_CERTIFICATE', 'MARKSHEET'
  ];
BEGIN
  -- 1. Validate document ID
  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'Document ID is required' USING ERRCODE = '22023';
  END IF;

  -- 2. Row-level lock to prevent concurrent race conditions
  SELECT * INTO v_old_record
  FROM public.hr_document_verifications
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document verification record not found with ID %', p_document_id USING ERRCODE = 'P0002';
  END IF;

  -- 3. Validate status if provided
  IF p_status IS NOT NULL THEN
    IF NOT (p_status = ANY(v_allowed_statuses)) THEN
      RAISE EXCEPTION 'Invalid document review status: %', p_status USING ERRCODE = '22023';
    END IF;
    v_target_status := p_status;
  ELSE
    v_target_status := v_old_record.status;
  END IF;

  -- 4. Validate category if provided
  IF p_category IS NOT NULL THEN
    IF NOT (p_category = ANY(v_allowed_categories)) THEN
      RAISE EXCEPTION 'Invalid document category: %', p_category USING ERRCODE = '22023';
    END IF;
    v_target_category := p_category;
  ELSE
    v_target_category := v_old_record.document_type;
  END IF;

  -- 5. Handle review notes (preserve if p_update_notes is FALSE)
  IF p_update_notes THEN
    v_target_notes := p_review_notes;
  ELSE
    v_target_notes := v_old_record.review_notes;
  END IF;

  -- 6. Handle candidate linking (preserve if p_update_candidate is FALSE)
  IF p_update_candidate THEN
    IF p_candidate_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.hr_candidates WHERE id = p_candidate_id) THEN
        RAISE EXCEPTION 'Candidate profile not found with ID %', p_candidate_id USING ERRCODE = 'P0002';
      END IF;
      v_target_candidate_id := p_candidate_id;
    ELSE
      v_target_candidate_id := NULL;
    END IF;
  ELSE
    v_target_candidate_id := v_old_record.candidate_id;
  END IF;

  -- 7. Snapshot old values for audit trail
  v_old_values := jsonb_build_object(
    'status', v_old_record.status,
    'document_type', v_old_record.document_type,
    'review_notes', v_old_record.review_notes,
    'candidate_id', v_old_record.candidate_id,
    'reviewed_by', v_old_record.reviewed_by,
    'reviewed_at', v_old_record.reviewed_at
  );

  -- 8. Atomic document update
  UPDATE public.hr_document_verifications
  SET
    status = v_target_status,
    document_type = v_target_category,
    review_notes = v_target_notes,
    candidate_id = v_target_candidate_id,
    reviewed_by = p_performed_by,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_document_id
  RETURNING * INTO v_new_record;

  v_new_values := jsonb_build_object(
    'status', v_new_record.status,
    'document_type', v_new_record.document_type,
    'review_notes', v_new_record.review_notes,
    'candidate_id', v_new_record.candidate_id,
    'reviewed_by', v_new_record.reviewed_by,
    'reviewed_at', v_new_record.reviewed_at
  );

  -- 9. Insert immutable audit log in same atomic transaction
  INSERT INTO public.hr_document_audit_logs (
    document_id,
    action,
    performed_by,
    old_values,
    new_values,
    reason,
    created_at
  ) VALUES (
    p_document_id,
    'REVIEW_UPDATED',
    p_performed_by,
    v_old_values,
    v_new_values,
    COALESCE(
      v_target_notes,
      'Status updated from ' || v_old_record.status || ' to ' || v_new_record.status
    ),
    NOW()
  );

  RETURN to_jsonb(v_new_record);
END;
$$;

-- Explicitly revoke from public/unauthenticated and grant only to service_role
REVOKE ALL ON FUNCTION public.fn_review_hr_document_with_audit FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_review_hr_document_with_audit TO service_role;

CREATE OR REPLACE FUNCTION public.fn_link_hr_document_candidate_with_audit(
  p_document_id UUID,
  p_candidate_id UUID DEFAULT NULL,
  p_performed_by VARCHAR(255) DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_record RECORD;
  v_new_record RECORD;
  v_action VARCHAR(50);
  v_reason TEXT;
BEGIN
  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'Document ID is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old_record
  FROM public.hr_document_verifications
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document verification record not found with ID %', p_document_id USING ERRCODE = 'P0002';
  END IF;

  IF p_candidate_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.hr_candidates WHERE id = p_candidate_id) THEN
      RAISE EXCEPTION 'Candidate profile not found with ID %', p_candidate_id USING ERRCODE = 'P0002';
    END IF;
    v_action := 'CANDIDATE_LINKED';
    v_reason := 'Linked to candidate profile ' || p_candidate_id::text;
  ELSE
    v_action := 'CANDIDATE_UNLINKED';
    v_reason := 'Candidate linkage removed';
  END IF;

  UPDATE public.hr_document_verifications
  SET
    candidate_id = p_candidate_id,
    updated_at = NOW()
  WHERE id = p_document_id
  RETURNING * INTO v_new_record;

  INSERT INTO public.hr_document_audit_logs (
    document_id,
    action,
    performed_by,
    old_values,
    new_values,
    reason,
    created_at
  ) VALUES (
    p_document_id,
    v_action,
    p_performed_by,
    jsonb_build_object('candidate_id', v_old_record.candidate_id),
    jsonb_build_object('candidate_id', v_new_record.candidate_id),
    v_reason,
    NOW()
  );

  RETURN to_jsonb(v_new_record);
END;
$$;

-- Explicitly revoke from public/unauthenticated and grant only to service_role
REVOKE ALL ON FUNCTION public.fn_link_hr_document_candidate_with_audit FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_link_hr_document_candidate_with_audit TO service_role;

REVOKE ALL ON FUNCTION public.fn_prevent_hr_doc_audit_modification FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_prevent_hr_doc_audit_modification TO service_role;

-- ----------------------------------------------------------------------------
-- 6. RELOAD POSTGREST SCHEMA CACHE
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
