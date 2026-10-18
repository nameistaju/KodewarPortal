import { supabase as defaultSupabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { DOCUMENT_STATUSES, DOCUMENT_CATEGORIES } from '../validators/hrDocumentValidator.js';

/**
 * Deterministically categorizes an attachment based on filename and email context.
 * Strict rule: Does not infer authenticity. Returns suggested category for HR review.
 */
export const categorizeAttachment = (filename = '', emailSubject = '', emailSnippet = '') => {
  const fnLower = (filename || '').toLowerCase();
  const subjLower = (emailSubject || '').toLowerCase();
  const snipLower = (emailSnippet || '').toLowerCase();
  const combined = `${subjLower} ${snipLower} ${fnLower}`.replace(/[_\-.]/g, ' ');

  // Resumes explicitly recognized first
  if (/resume|cv|biodata|curriculum/i.test(fnLower) && !/marksheet|certificate|photo|marks/i.test(fnLower)) {
    return 'RESUME';
  }

  // ID Cards and Photographs
  if (/submission of photo|photo for id|id card|id_card|passport_photo|passport photo/i.test(combined) ||
      (/\.(jpg|jpeg|png)$/i.test(fnLower) && /photo|image/i.test(fnLower))) {
    return 'PHOTOGRAPH';
  }

  // Offer letters and employment contracts
  if (/offer letter|appointment letter|joining report|internship offer|signed offer/i.test(combined)) {
    return 'OFFER_JOINING_DOCUMENT';
  }

  // Educational Marksheets and Degree Certificates
  if (/marksheet|degree|transcript|provisional|marks card|certificate submission/i.test(combined)) {
    return 'EDUCATION_CERTIFICATE';
  }

  // Government ID (Aadhaar / PAN)
  if (/aadhaar|aadhar|pan card|pan_|voter id/i.test(combined)) {
    return 'IDENTITY_DOCUMENT';
  }

  return 'OTHER';
};

/**
 * Idempotently indexes attachment metadata from hr_emails into hr_document_verifications.
 * Note: Only metadata is stored. Binaries are never duplicated or downloaded.
 */
export const syncAttachmentMetadata = async (supabase = defaultSupabase) => {
  try {
    const { data: emailsWithAtts, error } = await supabase
      .from('hr_emails')
      .select('id, uid, from_name, from_address, subject, snippet, attachments, has_attachments')
      .eq('has_attachments', true);

    if (error || !emailsWithAtts) {
      logger.warn('Failed to query emails with attachments', { error: error?.message });
      return { syncedCount: 0 };
    }

    // Fetch existing candidate-email linkages
    const { data: linkages } = await supabase
      .from('hr_candidate_emails')
      .select('email_id, candidate_id');

    const linkMap = new Map();
    if (Array.isArray(linkages)) {
      linkages.forEach((l) => linkMap.set(l.email_id, l.candidate_id));
    }

    const documentRows = [];
    emailsWithAtts.forEach((email) => {
      const atts = Array.isArray(email.attachments) ? email.attachments : [];
      atts.forEach((att, idx) => {
        const filename = att.filename || `Attachment_${idx + 1}`;
        const docType = categorizeAttachment(filename, email.subject, email.snippet);
        const linkedCandidateId = linkMap.get(email.id) || null;

        documentRows.push({
          email_id: email.id,
          attachment_index: idx,
          filename: filename.slice(0, 255),
          content_type: (att.contentType || 'application/octet-stream').slice(0, 100),
          size_bytes: Number(att.size) || 0,
          document_type: docType,
          status: 'NEEDS_REVIEW',
          candidate_id: linkedCandidateId
        });
      });
    });

    if (documentRows.length === 0) {
      return { syncedCount: 0 };
    }

    // Upsert idempotently on (email_id, attachment_index)
    const { data: upserted, error: upsertErr } = await supabase
      .from('hr_document_verifications')
      .upsert(documentRows, {
        onConflict: 'email_id, attachment_index',
        ignoreDuplicates: true
      })
      .select('id');

    if (upsertErr) {
      logger.warn('Failed upserting document verification records', { error: upsertErr.message });
      return { syncedCount: 0 };
    }

    return { syncedCount: upserted?.length || 0 };
  } catch (err) {
    logger.warn('Error during attachment metadata sync', { error: err.message });
    return { syncedCount: 0 };
  }
};

/**
 * Lists document verification records with pagination, search, and filtering.
 */
export const getDocuments = async (params = {}, supabase = defaultSupabase) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Auto-sync attachment metadata if table is empty
  const { count: currentTotal } = await supabase
    .from('hr_document_verifications')
    .select('id', { count: 'exact', head: true });

  if (currentTotal === 0) {
    await syncAttachmentMetadata(supabase);
  }

  let query = supabase
    .from('hr_document_verifications')
    .select(`
      id,
      email_id,
      candidate_id,
      attachment_index,
      filename,
      content_type,
      size_bytes,
      document_type,
      status,
      review_notes,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      email:hr_emails (
        id,
        uid,
        from_name,
        from_address,
        subject,
        sent_at
      ),
      candidate:hr_candidates (
        id,
        full_name,
        email,
        phone,
        target_role
      )
    `, { count: 'exact' });

  // Map legacy / flexible statuses
  if (params.status && params.status !== 'ALL') {
    let targetStatus = params.status;
    if (targetStatus === 'PENDING') targetStatus = 'NEEDS_REVIEW';
    if (targetStatus === 'VERIFIED') targetStatus = 'ACCEPTED';
    query = query.or(`status.eq.${params.status},status.eq.${targetStatus}`);
  }

  if (params.category && params.category !== 'ALL') {
    query = query.eq('document_type', params.category);
  }

  if (params.candidateId) {
    if (params.candidateId === 'UNLINKED') {
      query = query.is('candidate_id', null);
    } else {
      query = query.eq('candidate_id', params.candidateId);
    }
  }

  const sortBy = params.sortBy || 'created_at';
  const ascending = params.sortOrder === 'asc';
  query = query.order(sortBy, { ascending }).range(from, to);

  const { data: documents, count, error } = await query;

  if (error) {
    logger.error('Failed to fetch document verifications', { error: error.message });
    throw new AppError(`Failed to fetch documents: ${error.message}`, 500);
  }

  let filtered = documents || [];

  // In-memory search if requested
  if (params.search && params.search.trim()) {
    const s = params.search.trim().toLowerCase();
    filtered = filtered.filter((d) =>
      (d.filename && d.filename.toLowerCase().includes(s)) ||
      (d.candidate?.full_name && d.candidate.full_name.toLowerCase().includes(s)) ||
      (d.candidate?.email && d.candidate.email.toLowerCase().includes(s)) ||
      (d.email?.from_name && d.email.from_name.toLowerCase().includes(s)) ||
      (d.email?.from_address && d.email.from_address.toLowerCase().includes(s)) ||
      (d.email?.subject && d.email.subject.toLowerCase().includes(s))
    );
  }

  // Annotate with file availability privacy guarantee
  const annotated = filtered.map((doc) => ({
    ...doc,
    binary_stored: false,
    file_availability_notice: 'Binary Not Stored: Only message attachment metadata is available for manual review. Raw content cannot be downloaded.'
  }));

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    documents: annotated,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages
    }
  };
};

/**
 * Fetches a single document record by ID with linked email, candidate, and audit trail.
 */
export const getDocumentById = async (id, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Document ID is required', 400);

  const { data: document, error } = await supabase
    .from('hr_document_verifications')
    .select(`
      *,
      email:hr_emails (
        id,
        uid,
        from_name,
        from_address,
        subject,
        sent_at,
        snippet
      ),
      candidate:hr_candidates (
        id,
        full_name,
        email,
        phone,
        target_role
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch document record', { id, error: error.message });
    throw new AppError(`Failed to fetch document: ${error.message}`, 500);
  }

  if (!document) {
    throw new AppError('Document verification record not found', 404);
  }

  // Retrieve audit trail
  const { data: auditLogs } = await supabase
    .from('hr_document_audit_logs')
    .select('*')
    .eq('document_id', id)
    .order('created_at', { ascending: false });

  return {
    ...document,
    binary_stored: false,
    file_availability_notice: 'Binary Not Stored: Only message attachment metadata is available for manual review. Raw content cannot be downloaded.',
    auditLogs: auditLogs || []
  };
};

/**
 * Updates a document's review status and records audit history.
 */
export const updateDocumentReview = async (id, payload, user = {}, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Document ID is required', 400);

  const existing = await getDocumentById(id, supabase);

  const updates = {
    updated_at: new Date().toISOString()
  };

  if (payload.status) {
    if (!DOCUMENT_STATUSES.includes(payload.status)) {
      throw new AppError(`Invalid status: ${payload.status}`, 400);
    }
    updates.status = payload.status;
    updates.reviewed_by = user.email || user.id || 'system';
    updates.reviewed_at = new Date().toISOString();
  }

  if (payload.category) {
    if (!DOCUMENT_CATEGORIES.includes(payload.category)) {
      throw new AppError(`Invalid category: ${payload.category}`, 400);
    }
    updates.document_type = payload.category;
  }

  if (payload.reviewNotes !== undefined) {
    updates.review_notes = payload.reviewNotes ? payload.reviewNotes.trim() : null;
  }

  if (payload.candidateId !== undefined) {
    updates.candidate_id = payload.candidateId || null;
  }

  // Try atomic PostgreSQL RPC function first if available
  if (typeof supabase.rpc === 'function') {
    try {
      const updateNotes = payload.reviewNotes !== undefined;
      const updateCandidate = payload.candidateId !== undefined;
      const { data: rpcData, error: rpcErr } = await supabase.rpc('fn_review_hr_document_with_audit', {
        p_document_id: id,
        p_status: payload.status || null,
        p_category: payload.category || null,
        p_review_notes: updateNotes ? (payload.reviewNotes ? payload.reviewNotes.trim() : null) : null,
        p_update_notes: updateNotes,
        p_candidate_id: updateCandidate ? (payload.candidateId || null) : null,
        p_update_candidate: updateCandidate,
        p_performed_by: user.email || user.id || 'system'
      });

      if (!rpcErr && rpcData) {
        return rpcData;
      }
      if (rpcErr && !rpcErr.message?.toLowerCase().includes('function') && rpcErr.code !== 'PGRST202') {
        logger.error('Failed executing review RPC', { error: rpcErr.message });
        const statusCode = rpcErr.code === 'P0002' ? 404 : 400;
        throw new AppError(`Failed to update document: ${rpcErr.message}`, statusCode);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // If RPC is missing, continue to guarded application transaction
    }
  }

  const { data: updated, error } = await supabase
    .from('hr_document_verifications')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update document verification record', { id, error: error.message });
    throw new AppError(`Failed to update document: ${error.message}`, 500);
  }

  // Guarded audit log insertion: failure triggers compensating rollback
  try {
    const { error: auditErr } = await supabase
      .from('hr_document_audit_logs')
      .insert([{
        document_id: id,
        action: 'REVIEW_UPDATED',
        performed_by: user.email || user.id || 'system',
        old_values: {
          status: existing.status,
          document_type: existing.document_type,
          review_notes: existing.review_notes,
          candidate_id: existing.candidate_id
        },
        new_values: updates,
        reason: payload.reviewNotes || `Status updated from ${existing.status} to ${updates.status || existing.status}`
      }]);

    if (auditErr) {
      throw auditErr;
    }
  } catch (auditErr) {
    logger.error('Failed to insert document audit log, rolling back document update', { error: auditErr.message });
    // Compensating rollback: Revert document to original state to preserve audit integrity
    await supabase.from('hr_document_verifications').update({
      status: existing.status,
      document_type: existing.document_type,
      review_notes: existing.review_notes,
      candidate_id: existing.candidate_id,
      reviewed_by: existing.reviewed_by,
      reviewed_at: existing.reviewed_at,
      updated_at: existing.updated_at
    }).eq('id', id);

    throw new AppError('Audit log insertion failed. Review update was aborted to preserve audit integrity.', 500);
  }

  return updated;
};

/**
 * Links or unlinks a document to a persistent candidate profile.
 */
export const linkDocumentCandidate = async (id, candidateId, user = {}, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Document ID is required', 400);

  const existing = await getDocumentById(id, supabase);

  if (candidateId) {
    const { data: candidate, error: cErr } = await supabase
      .from('hr_candidates')
      .select('id, full_name, email')
      .eq('id', candidateId)
      .maybeSingle();

    if (cErr || !candidate) {
      throw new AppError('Candidate profile not found', 404);
    }
  }

  // Try atomic PostgreSQL RPC function first if available
  if (typeof supabase.rpc === 'function') {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('fn_link_hr_document_candidate_with_audit', {
        p_document_id: id,
        p_candidate_id: candidateId || null,
        p_performed_by: user.email || user.id || 'system'
      });

      if (!rpcErr && rpcData) {
        return rpcData;
      }
      if (rpcErr && !rpcErr.message?.toLowerCase().includes('function') && rpcErr.code !== 'PGRST202') {
        logger.error('Failed executing link candidate RPC', { error: rpcErr.message });
        const statusCode = rpcErr.code === 'P0002' ? 404 : 400;
        throw new AppError(`Failed to link candidate: ${rpcErr.message}`, statusCode);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // If RPC is missing, continue to guarded application transaction
    }
  }

  const updates = {
    candidate_id: candidateId || null,
    updated_at: new Date().toISOString()
  };

  const { data: updated, error } = await supabase
    .from('hr_document_verifications')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError(`Failed to link candidate: ${error.message}`, 500);
  }

  // Guarded audit log insertion: failure triggers compensating rollback
  try {
    const { error: auditErr } = await supabase
      .from('hr_document_audit_logs')
      .insert([{
        document_id: id,
        action: candidateId ? 'CANDIDATE_LINKED' : 'CANDIDATE_UNLINKED',
        performed_by: user.email || user.id || 'system',
        old_values: { candidate_id: existing.candidate_id },
        new_values: { candidate_id: candidateId || null },
        reason: candidateId ? `Linked to candidate profile ${candidateId}` : 'Removed candidate linkage'
      }]);

    if (auditErr) {
      throw auditErr;
    }
  } catch (auditErr) {
    logger.error('Failed to insert document candidate link audit log, rolling back linkage', { error: auditErr.message });
    await supabase.from('hr_document_verifications').update({
      candidate_id: existing.candidate_id,
      updated_at: existing.updated_at
    }).eq('id', id);

    throw new AppError('Audit log insertion failed. Candidate linkage was aborted to preserve audit integrity.', 500);
  }

  return updated;
};
