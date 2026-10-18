import { supabase as defaultSupabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export const CANDIDATE_STATUSES = [
  'APPLIED',
  'SCREENING',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
  'ARCHIVED'
];

export const CANDIDATE_SOURCES = [
  'EMAIL',
  'INSTAGRAM',
  'LINKEDIN',
  'REFERRAL',
  'CAREERS_PAGE',
  'WALK_IN',
  'OTHER'
];

/**
 * Lists candidates with pagination, text search, and category/source filters.
 */
export const getCandidates = async (params = {}, supabase = defaultSupabase) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('hr_candidates')
    .select('*', { count: 'exact' });

  if (params.status && params.status !== 'ALL') {
    query = query.eq('status', params.status);
  }

  if (params.source && params.source !== 'ALL') {
    query = query.eq('source', params.source);
  }

  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,target_role.ilike.%${s}%`);
  }

  const sortBy = params.sortBy || 'created_at';
  const ascending = params.sortOrder === 'asc';
  query = query.order(sortBy, { ascending });
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    logger.error('Failed to fetch candidates from database', { error: error.message });
    throw new AppError(`Failed to fetch candidates: ${error.message}`, 500);
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    candidates: data || [],
    pagination: {
      page,
      limit,
      totalCount,
      totalPages
    }
  };
};

/**
 * Fetches a candidate by ID including linked emails and audit logs.
 */
export const getCandidateById = async (id, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Candidate ID is required', 400);

  // 1. Fetch candidate
  const { data: candidate, error: candErr } = await supabase
    .from('hr_candidates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (candErr) {
    logger.error('Failed to fetch candidate by ID', { id, error: candErr.message });
    throw new AppError(`Failed to fetch candidate: ${candErr.message}`, 500);
  }

  if (!candidate) {
    throw new AppError('Candidate not found', 404);
  }

  // 2. Fetch linked emails with email details
  const { data: linkedRows, error: linkErr } = await supabase
    .from('hr_candidate_emails')
    .select(`
      id,
      candidate_id,
      email_id,
      is_primary_application,
      linked_at,
      linked_by,
      notes,
      hr_emails (
        id,
        uid,
        subject,
        from_name,
        from_address,
        sent_at,
        snippet,
        has_attachments,
        attachments,
        processing_status
      )
    `)
    .eq('candidate_id', id)
    .order('linked_at', { ascending: false });

  if (linkErr) {
    logger.warn('Failed to fetch candidate linked emails', { id, error: linkErr.message });
  }

  // 3. Fetch audit logs
  const { data: auditLogs, error: auditErr } = await supabase
    .from('hr_candidate_audit_logs')
    .select('*')
    .eq('candidate_id', id)
    .order('created_at', { ascending: false });

  if (auditErr) {
    logger.warn('Failed to fetch candidate audit logs', { id, error: auditErr.message });
  }

  return {
    ...candidate,
    linkedEmails: (linkedRows || []).map((l) => ({
      linkId: l.id,
      emailId: l.email_id,
      isPrimaryApplication: l.is_primary_application,
      linkedAt: l.linked_at,
      linkedBy: l.linked_by,
      notes: l.notes,
      email: l.hr_emails || null
    })),
    auditLogs: auditLogs || []
  };
};

/**
 * Creates a new candidate with duplicate detection.
 */
export const createCandidate = async (payload, user = {}, supabase = defaultSupabase) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    source = 'EMAIL',
    sourceDetails,
    targetRole,
    experienceYears,
    currentCompany,
    currentTitle,
    status = 'APPLIED',
    rating,
    notes,
    tags = [],
    allowDuplicate = false
  } = payload;

  if (!firstName || !firstName.trim()) {
    throw new AppError('First name is required', 400);
  }

  if (!email || !email.trim()) {
    throw new AppError('Email address is required', 400);
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanFirstName = firstName.trim();
  const cleanLastName = lastName ? lastName.trim() : null;
  const fullName = cleanLastName ? `${cleanFirstName} ${cleanLastName}` : cleanFirstName;

  // Duplicate detection (email collision check)
  const { data: existing, error: checkErr } = await supabase
    .from('hr_candidates')
    .select('id, full_name, email, status, target_role, created_at')
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (checkErr) {
    logger.error('Failed duplicate check query', { error: checkErr.message });
  }

  if (existing && !allowDuplicate) {
    throw new AppError(
      `Candidate with email ${cleanEmail} already exists. To proceed anyway, confirm manual override.`,
      409,
      [{ field: 'email', message: 'Candidate with this email already exists', existingCandidate: existing }]
    );
  }

  const record = {
    first_name: cleanFirstName,
    last_name: cleanLastName,
    full_name: fullName,
    email: cleanEmail,
    phone: phone ? phone.trim() : null,
    source: CANDIDATE_SOURCES.includes(source) ? source : 'OTHER',
    source_details: sourceDetails ? sourceDetails.trim() : null,
    target_role: targetRole ? targetRole.trim() : null,
    experience_years: experienceYears !== undefined && experienceYears !== null ? Number(experienceYears) : null,
    current_company: currentCompany ? currentCompany.trim() : null,
    current_title: currentTitle ? currentTitle.trim() : null,
    status: CANDIDATE_STATUSES.includes(status) ? status : 'APPLIED',
    rating: rating ? Number(rating) : null,
    notes: notes ? notes.trim() : null,
    tags: Array.isArray(tags) ? tags : [],
    created_by: user.email || user.id || 'system',
    updated_by: user.email || user.id || 'system'
  };

  const { data: created, error: insertErr } = await supabase
    .from('hr_candidates')
    .insert([record])
    .select()
    .single();

  if (insertErr) {
    logger.error('Failed to create candidate record', { error: insertErr.message });
    throw new AppError(`Failed to create candidate: ${insertErr.message}`, 500);
  }

  // Record audit log
  try {
    await supabase
      .from('hr_candidate_audit_logs')
      .insert([{
        candidate_id: created.id,
        action: 'CREATED',
        performed_by: user.email || user.id || 'system',
        new_values: { ...record, id: created.id },
        reason: 'Initial candidate profile creation'
      }]);
  } catch (err) {
    logger.warn('Failed to insert candidate creation audit log', { error: err.message });
  }

  return created;
};

/**
 * Updates an existing candidate profile with full change auditing.
 */
export const updateCandidate = async (id, updatePayload, user = {}, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Candidate ID is required', 400);

  const existing = await getCandidateById(id, supabase);

  const updates = {};
  if (updatePayload.firstName !== undefined) updates.first_name = updatePayload.firstName.trim();
  if (updatePayload.lastName !== undefined) updates.last_name = updatePayload.lastName ? updatePayload.lastName.trim() : null;
  if (updates.first_name || updates.last_name !== undefined) {
    const fn = updates.first_name || existing.first_name;
    const ln = updates.last_name !== undefined ? updates.last_name : existing.last_name;
    updates.full_name = ln ? `${fn} ${ln}` : fn;
  }
  if (updatePayload.email !== undefined) updates.email = updatePayload.email.trim().toLowerCase();
  if (updatePayload.phone !== undefined) updates.phone = updatePayload.phone ? updatePayload.phone.trim() : null;
  if (updatePayload.source !== undefined && CANDIDATE_SOURCES.includes(updatePayload.source)) updates.source = updatePayload.source;
  if (updatePayload.sourceDetails !== undefined) updates.source_details = updatePayload.sourceDetails;
  if (updatePayload.targetRole !== undefined) updates.target_role = updatePayload.targetRole ? updatePayload.targetRole.trim() : null;
  if (updatePayload.experienceYears !== undefined) updates.experience_years = updatePayload.experienceYears !== null ? Number(updatePayload.experienceYears) : null;
  if (updatePayload.currentCompany !== undefined) updates.current_company = updatePayload.currentCompany ? updatePayload.currentCompany.trim() : null;
  if (updatePayload.currentTitle !== undefined) updates.current_title = updatePayload.currentTitle ? updatePayload.currentTitle.trim() : null;
  if (updatePayload.rating !== undefined) updates.rating = updatePayload.rating !== null ? Number(updatePayload.rating) : null;
  if (updatePayload.notes !== undefined) updates.notes = updatePayload.notes ? updatePayload.notes.trim() : null;
  if (updatePayload.tags !== undefined && Array.isArray(updatePayload.tags)) updates.tags = updatePayload.tags;
  if (updatePayload.isArchived !== undefined) updates.is_archived = Boolean(updatePayload.isArchived);

  updates.updated_by = user.email || user.id || 'system';
  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('hr_candidates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update candidate', { id, error: error.message });
    throw new AppError(`Failed to update candidate: ${error.message}`, 500);
  }

  // Audit log
  try {
    await supabase
      .from('hr_candidate_audit_logs')
      .insert([{
        candidate_id: id,
        action: 'UPDATED',
        performed_by: user.email || user.id || 'system',
        old_values: existing,
        new_values: updates,
        reason: updatePayload.changeReason || 'Candidate profile details modified'
      }]);
  } catch (err) {
    logger.warn('Failed to insert update audit log', { error: err.message });
  }

  return updated;
};

/**
 * Updates a candidate's recruitment lifecycle status with mandatory audit logging.
 */
export const updateCandidateStatus = async (id, newStatus, reason = '', user = {}, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Candidate ID is required', 400);

  if (!CANDIDATE_STATUSES.includes(newStatus)) {
    throw new AppError(`Invalid candidate status: ${newStatus}`, 400);
  }

  const existing = await getCandidateById(id, supabase);

  if (existing.status === newStatus) {
    return existing;
  }

  const { data: updated, error } = await supabase
    .from('hr_candidates')
    .update({
      status: newStatus,
      updated_by: user.email || user.id || 'system',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update candidate status', { id, newStatus, error: error.message });
    throw new AppError(`Failed to update candidate status: ${error.message}`, 500);
  }

  // Record status change audit entry
  try {
    await supabase
      .from('hr_candidate_audit_logs')
      .insert([{
        candidate_id: id,
        action: 'STATUS_CHANGED',
        performed_by: user.email || user.id || 'system',
        old_values: { status: existing.status },
        new_values: { status: newStatus },
        reason: reason || `Status transitioned from ${existing.status} to ${newStatus}`
      }]);
  } catch (err) {
    logger.warn('Failed to insert status audit log', { error: err.message });
  }

  return updated;
};

/**
 * Links a verified mailbox email to a candidate record.
 */
export const linkEmailToCandidate = async (candidateId, emailId, options = {}, user = {}, supabase = defaultSupabase) => {
  if (!candidateId) throw new AppError('Candidate ID is required', 400);
  if (!emailId) throw new AppError('Email ID is required', 400);

  // 1. Verify candidate exists
  const candidate = await getCandidateById(candidateId, supabase);

  // 2. Verify email exists in hr_emails
  const { data: email, error: emailErr } = await supabase
    .from('hr_emails')
    .select('id, uid, subject, from_name, from_address')
    .eq('id', emailId)
    .maybeSingle();

  if (emailErr || !email) {
    throw new AppError('Target email record does not exist in hr_emails', 404);
  }

  // 3. Insert link
  const linkRecord = {
    candidate_id: candidateId,
    email_id: emailId,
    is_primary_application: Boolean(options.isPrimaryApplication),
    linked_by: user.email || user.id || 'system',
    notes: options.notes ? options.notes.trim() : null
  };

  const { data: link, error: linkErr } = await supabase
    .from('hr_candidate_emails')
    .insert([linkRecord])
    .select()
    .single();

  if (linkErr) {
    if (linkErr.code === '23505' || linkErr.message?.includes('duplicate key') || linkErr.message?.includes('unique')) {
      throw new AppError('This email is already linked to this candidate', 409);
    }
    throw new AppError(`Failed to link email: ${linkErr.message}`, 500);
  }

  // 4. Audit entry
  try {
    await supabase
      .from('hr_candidate_audit_logs')
      .insert([{
        candidate_id: candidateId,
        action: 'EMAIL_LINKED',
        performed_by: user.email || user.id || 'system',
        new_values: { emailId, uid: email.uid, subject: email.subject },
        reason: options.notes || `Linked mailbox email (UID ${email.uid}) to candidate`
      }]);
  } catch (err) {
    logger.warn('Failed to insert email link audit log', { error: err.message });
  }

  return link;
};

/**
 * Unlinks an email from a candidate record.
 */
export const unlinkEmailFromCandidate = async (candidateId, emailId, user = {}, supabase = defaultSupabase) => {
  if (!candidateId) throw new AppError('Candidate ID is required', 400);
  if (!emailId) throw new AppError('Email ID is required', 400);

  const { data: deleted, error } = await supabase
    .from('hr_candidate_emails')
    .delete()
    .eq('candidate_id', candidateId)
    .eq('email_id', emailId)
    .select();

  if (error) {
    throw new AppError(`Failed to unlink email: ${error.message}`, 500);
  }

  if (!deleted || deleted.length === 0) {
    throw new AppError('Email linkage not found', 404);
  }

  // Audit entry
  try {
    await supabase
      .from('hr_candidate_audit_logs')
      .insert([{
        candidate_id: candidateId,
        action: 'EMAIL_UNLINKED',
        performed_by: user.email || user.id || 'system',
        old_values: { emailId },
        reason: 'Email linkage removed by HR user'
      }]);
  } catch (err) {
    logger.warn('Failed to insert email unlink audit log', { error: err.message });
  }

  return { success: true };
};

/**
 * Convenience method to create a candidate directly from an incoming email
 * and automatically establish the link.
 */
export const createCandidateFromEmail = async (emailId, overrides = {}, user = {}, supabase = defaultSupabase) => {
  if (!emailId) throw new AppError('Email ID is required', 400);

  const { data: email, error } = await supabase
    .from('hr_emails')
    .select('id, uid, subject, from_name, from_address')
    .eq('id', emailId)
    .maybeSingle();

  if (error || !email) {
    throw new AppError('Email record not found', 404);
  }

  // Extract candidate name from sender
  let firstName = overrides.firstName;
  let lastName = overrides.lastName;

  if (!firstName) {
    const rawName = email.from_name || email.from_address.split('@')[0];
    const parts = rawName.trim().split(/\s+/);
    firstName = parts[0] || 'Unknown';
    lastName = parts.slice(1).join(' ') || null;
  }

  const candidatePayload = {
    firstName,
    lastName,
    email: overrides.email || email.from_address,
    phone: overrides.phone || null,
    source: overrides.source || 'EMAIL',
    sourceDetails: overrides.sourceDetails || `Ingested from IMAP message UID ${email.uid}`,
    targetRole: overrides.targetRole || (email.subject ? email.subject.replace(/^(re:|fwd:|application for|applying for|reg:)\s*/i, '').trim() : 'General Application'),
    status: overrides.status || 'APPLIED',
    notes: overrides.notes || `Created directly from email UID ${email.uid}: "${email.subject || '(No Subject)'}"`,
    allowDuplicate: Boolean(overrides.allowDuplicate)
  };

  const candidate = await createCandidate(candidatePayload, user, supabase);

  // Link email as primary
  await linkEmailToCandidate(candidate.id, emailId, { isPrimaryApplication: true }, user, supabase);

  return candidate;
};

/**
 * Fetches audit logs for a specific candidate.
 */
export const getCandidateAuditLogs = async (candidateId, supabase = defaultSupabase) => {
  if (!candidateId) throw new AppError('Candidate ID is required', 400);

  const { data, error } = await supabase
    .from('hr_candidate_audit_logs')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch candidate audit logs', { candidateId, error: error.message });
    throw new AppError(`Failed to fetch audit logs: ${error.message}`, 500);
  }

  return data || [];
};
