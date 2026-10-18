import { supabase as defaultSupabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { getCandidateById, createCandidate, linkEmailToCandidate } from './hrCandidateService.js';

export const APPLICATION_STATUSES = [
  'APPLIED',
  'SCREENING',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
  'WITHDRAWN'
];

export const APPLICATION_SOURCES = [
  'INSTAGRAM',
  'EMAIL',
  'REFERRAL',
  'WEBSITE',
  'CAREERS_PAGE',
  'WALK_IN',
  'OTHER'
];

/**
 * Lists job applications with pagination, search, and filters.
 */
export const getApplications = async (params = {}, supabase = defaultSupabase) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('hr_applications')
    .select(`
      *,
      candidate:hr_candidates (
        id,
        first_name,
        last_name,
        full_name,
        email,
        phone,
        current_company
      ),
      job:hr_jobs (
        id,
        job_code,
        title,
        department,
        status,
        location
      ),
      email:hr_emails (
        id,
        uid,
        subject,
        sent_at,
        has_attachments
      )
    `, { count: 'exact' });

  if (params.status && params.status !== 'ALL') {
    query = query.eq('status', params.status);
  }

  if (params.source && params.source !== 'ALL') {
    query = query.eq('source', params.source);
  }

  if (params.jobId) {
    if (params.jobId === 'UNASSIGNED') {
      query = query.is('job_id', null);
    } else {
      query = query.eq('job_id', params.jobId);
    }
  }

  if (params.candidateId) {
    query = query.eq('candidate_id', params.candidateId);
  }

  const sortBy = params.sortBy || 'applied_at';
  const ascending = params.sortOrder === 'asc';
  query = query.order(sortBy, { ascending });
  query = query.range(from, to);

  const { data: applications, count, error } = await query;

  if (error) {
    logger.error('Failed to fetch job applications', { error: error.message });
    throw new AppError(`Failed to fetch job applications: ${error.message}`, 500);
  }

  let filtered = applications || [];

  // In-memory text search over candidate name, email, or job title
  if (params.search && params.search.trim()) {
    const s = params.search.trim().toLowerCase();
    filtered = filtered.filter((app) => {
      const candName = app.candidate?.full_name?.toLowerCase() || '';
      const candEmail = app.candidate?.email?.toLowerCase() || '';
      const jobTitle = app.job?.title?.toLowerCase() || '';
      const jobCode = app.job?.job_code?.toLowerCase() || '';
      return candName.includes(s) || candEmail.includes(s) || jobTitle.includes(s) || jobCode.includes(s);
    });
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    applications: filtered,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages
    }
  };
};

/**
 * Fetches a single job application by ID, including candidate, job, email, and audit logs.
 */
export const getApplicationById = async (id, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Application ID is required', 400);

  const { data: application, error } = await supabase
    .from('hr_applications')
    .select(`
      *,
      candidate:hr_candidates (
        id,
        first_name,
        last_name,
        full_name,
        email,
        phone,
        source,
        current_company,
        current_title,
        notes
      ),
      job:hr_jobs (
        id,
        job_code,
        title,
        department,
        status,
        location,
        employment_type
      ),
      email:hr_emails (
        id,
        uid,
        subject,
        sent_at,
        snippet,
        has_attachments,
        attachments
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch application by ID', { id, error: error.message });
    throw new AppError(`Failed to fetch application: ${error.message}`, 500);
  }

  if (!application) {
    throw new AppError('Job application not found', 404);
  }

  // Fetch audit logs for this application
  const { data: auditLogs, error: auditErr } = await supabase
    .from('hr_application_audit_logs')
    .select('*')
    .eq('application_id', id)
    .order('created_at', { ascending: false });

  if (auditErr) {
    logger.warn('Failed to fetch application audit logs', { id, error: auditErr.message });
  }

  return {
    ...application,
    auditLogs: auditLogs || []
  };
};

/**
 * Creates a new job application for a candidate.
 * Prevents accidental duplicate applications for the SAME job requisition,
 * while allowing a candidate to apply for DIFFERENT jobs.
 */
export const createApplication = async (payload, user = {}, supabase = defaultSupabase) => {
  const {
    candidateId,
    jobId,
    source = 'EMAIL',
    sourceDetails,
    status = 'APPLIED',
    emailId,
    notes,
    rating,
    allowDuplicate = false
  } = payload;

  if (!candidateId) {
    throw new AppError('Candidate ID is required', 400);
  }

  // Verify candidate exists
  const candidate = await getCandidateById(candidateId, supabase);

  // If jobId is provided, verify job exists
  let job = null;
  if (jobId) {
    const { data: jobData, error: jobErr } = await supabase
      .from('hr_jobs')
      .select('id, title, status')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr || !jobData) {
      throw new AppError('Job requisition not found', 404);
    }
    job = jobData;

    // Check duplicate application for the same job
    const { data: existingApp, error: checkErr } = await supabase
      .from('hr_applications')
      .select('id, status, applied_at')
      .eq('candidate_id', candidateId)
      .eq('job_id', jobId)
      .maybeSingle();

    if (checkErr) {
      logger.error('Failed duplicate application check', { error: checkErr.message });
    }

    if (existingApp && !allowDuplicate) {
      throw new AppError(
        `Candidate ${candidate.full_name} has already applied for this job (${job.title}). Duplicate application blocked.`,
        409,
        [{ field: 'jobId', existingApplication: existingApp }]
      );
    }
  }

  // Verify email exists if provided
  if (emailId) {
    const { data: emailData, error: emailErr } = await supabase
      .from('hr_emails')
      .select('id, uid')
      .eq('id', emailId)
      .maybeSingle();

    if (emailErr || !emailData) {
      throw new AppError('Referenced email record not found', 404);
    }

    // Ensure email is linked to candidate
    await linkEmailToCandidate(candidateId, emailId, { isPrimaryApplication: false }, user, supabase)
      .catch(() => {}); // ignore if already linked
  }

  const record = {
    candidate_id: candidateId,
    job_id: jobId || null,
    source: APPLICATION_SOURCES.includes(source) ? source : 'OTHER',
    source_details: sourceDetails ? sourceDetails.trim() : null,
    status: APPLICATION_STATUSES.includes(status) ? status : 'APPLIED',
    applied_at: new Date().toISOString(),
    email_id: emailId || null,
    notes: notes ? notes.trim() : null,
    rating: rating ? Number(rating) : null,
    created_by: user.email || user.id || 'system',
    updated_by: user.email || user.id || 'system'
  };

  const { data: created, error } = await supabase
    .from('hr_applications')
    .insert([record])
    .select()
    .single();

  if (error) {
    if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique')) {
      throw new AppError('Candidate already has an active application for this job requisition.', 409);
    }
    logger.error('Failed to create application record', { error: error.message });
    throw new AppError(`Failed to create application: ${error.message}`, 500);
  }

  // Insert audit log
  try {
    await supabase
      .from('hr_application_audit_logs')
      .insert([{
        application_id: created.id,
        action: 'CREATED',
        performed_by: user.email || user.id || 'system',
        new_values: { ...record, id: created.id },
        reason: jobId ? `Application submitted for job ${job?.title || jobId}` : 'Application created in unassigned review queue'
      }]);
  } catch (err) {
    logger.warn('Failed to insert application audit log', { error: err.message });
  }

  return created;
};

/**
 * Updates application details.
 */
export const updateApplication = async (id, payload, user = {}, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Application ID is required', 400);

  const existing = await getApplicationById(id, supabase);

  const updates = {
    updated_by: user.email || user.id || 'system',
    updated_at: new Date().toISOString()
  };

  if (payload.jobId !== undefined) {
    // Check if moving to another job causes collision
    if (payload.jobId && payload.jobId !== existing.job_id) {
      const { data: collision } = await supabase
        .from('hr_applications')
        .select('id')
        .eq('candidate_id', existing.candidate_id)
        .eq('job_id', payload.jobId)
        .maybeSingle();

      if (collision) {
        throw new AppError('Candidate already has an application for that target job.', 409);
      }
    }
    updates.job_id = payload.jobId || null;
  }

  if (payload.source !== undefined) {
    if (!APPLICATION_SOURCES.includes(payload.source)) {
      throw new AppError(`Invalid source: ${payload.source}`, 400);
    }
    updates.source = payload.source;
  }

  if (payload.sourceDetails !== undefined) updates.source_details = payload.sourceDetails?.trim() || null;
  if (payload.notes !== undefined) updates.notes = payload.notes?.trim() || null;
  if (payload.rating !== undefined) updates.rating = payload.rating ? Number(payload.rating) : null;

  const { data: updated, error } = await supabase
    .from('hr_applications')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update application', { id, error: error.message });
    throw new AppError(`Failed to update application: ${error.message}`, 500);
  }

  return updated;
};

/**
 * Transitions application status and logs immutable audit entry.
 */
export const updateApplicationStatus = async (id, newStatus, reason = '', user = {}, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Application ID is required', 400);

  if (!APPLICATION_STATUSES.includes(newStatus)) {
    throw new AppError(`Invalid application status: ${newStatus}`, 400);
  }

  const existing = await getApplicationById(id, supabase);

  if (existing.status === newStatus) {
    return existing;
  }

  const { data: updated, error } = await supabase
    .from('hr_applications')
    .update({
      status: newStatus,
      updated_by: user.email || user.id || 'system',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update application status', { id, newStatus, error: error.message });
    throw new AppError(`Failed to update application status: ${error.message}`, 500);
  }

  // Insert audit log
  try {
    await supabase
      .from('hr_application_audit_logs')
      .insert([{
        application_id: id,
        action: 'STATUS_CHANGED',
        performed_by: user.email || user.id || 'system',
        old_values: { status: existing.status },
        new_values: { status: newStatus },
        reason: reason || `Status transitioned from ${existing.status} to ${newStatus}`
      }]);
  } catch (err) {
    logger.warn('Failed to insert application status audit log', { error: err.message });
  }

  return updated;
};

/**
 * Incoming email integration workflow:
 * - Links an email to a candidate (finding or creating the candidate profile).
 * - Creates an application for a confirmed job, or leaves job unassigned for HR review.
 * - Allows explicitly setting source (e.g. 'INSTAGRAM' if confirmed from Instagram ad, 'EMAIL', 'REFERRAL', etc.).
 * - Does not guess job solely from subject without HR confirmation.
 */
export const createApplicationFromEmail = async (payload, user = {}, supabase = defaultSupabase) => {
  const {
    emailId,
    candidateId,
    candidateData = {},
    jobId = null,
    source = 'EMAIL',
    sourceDetails,
    notes,
    allowDuplicate = false
  } = payload;

  if (!emailId) {
    throw new AppError('Email ID is required', 400);
  }

  // 1. Fetch email
  const { data: email, error: emailErr } = await supabase
    .from('hr_emails')
    .select('id, uid, subject, from_name, from_address')
    .eq('id', emailId)
    .maybeSingle();

  if (emailErr || !email) {
    throw new AppError('Email record not found', 404);
  }

  // 2. Resolve Candidate
  let finalCandidateId = candidateId;

  if (!finalCandidateId) {
    // Check if candidate with this email address already exists
    const cleanEmail = (candidateData.email || email.from_address).trim().toLowerCase();
    const { data: existingCand } = await supabase
      .from('hr_candidates')
      .select('id')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingCand) {
      finalCandidateId = existingCand.id;
    } else {
      // Create candidate from email details
      let firstName = candidateData.firstName;
      let lastName = candidateData.lastName;
      if (!firstName) {
        const rawName = email.from_name || email.from_address.split('@')[0];
        const parts = rawName.trim().split(/\s+/);
        firstName = parts[0] || 'Unknown';
        lastName = parts.slice(1).join(' ') || null;
      }

      const newCand = await createCandidate(
        {
          firstName,
          lastName,
          email: cleanEmail,
          phone: candidateData.phone || null,
          source: source === 'INSTAGRAM' ? 'INSTAGRAM' : 'EMAIL',
          sourceDetails: sourceDetails || `Inbound message UID ${email.uid}`,
          targetRole: candidateData.targetRole || (email.subject ? email.subject.replace(/^(re:|fwd:|application for|applying for|reg:)\s*/i, '').trim() : null),
          notes: candidateData.notes || `Created during email application processing (UID ${email.uid})`,
          allowDuplicate: Boolean(allowDuplicate)
        },
        user,
        supabase
      );
      finalCandidateId = newCand.id;
    }
  }

  // 3. Link email to candidate
  await linkEmailToCandidate(finalCandidateId, emailId, { isPrimaryApplication: true }, user, supabase)
    .catch(() => {});

  // 4. Create application
  const appPayload = {
    candidateId: finalCandidateId,
    jobId: jobId || null, // Unassigned if null
    source: APPLICATION_SOURCES.includes(source) ? source : 'EMAIL',
    sourceDetails: sourceDetails || (source === 'INSTAGRAM' ? 'Confirmed Instagram ad response' : `Inbound email UID ${email.uid}`),
    status: 'APPLIED',
    emailId,
    notes: notes || (jobId ? `Application linked from email UID ${email.uid}` : `Unassigned application from email UID ${email.uid} awaiting HR review`),
    allowDuplicate
  };

  return createApplication(appPayload, user, supabase);
};

/**
 * Fetches audit logs for a specific application.
 */
export const getApplicationAuditLogs = async (applicationId, supabase = defaultSupabase) => {
  if (!applicationId) throw new AppError('Application ID is required', 400);

  const { data, error } = await supabase
    .from('hr_application_audit_logs')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch application audit logs', { applicationId, error: error.message });
    throw new AppError(`Failed to fetch audit logs: ${error.message}`, 500);
  }

  return data || [];
};
