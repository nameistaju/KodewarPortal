import { supabase as defaultSupabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export const JOB_STATUSES = ['DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'ARCHIVED'];
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'FREELANCE'];

/**
 * Lists job requisitions with pagination, search, and filters.
 */
export const getJobs = async (params = {}, supabase = defaultSupabase) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('hr_jobs')
    .select('*', { count: 'exact' });

  if (params.status && params.status !== 'ALL') {
    query = query.eq('status', params.status);
  }

  if (params.department && params.department !== 'ALL') {
    query = query.eq('department', params.department);
  }

  if (params.employmentType && params.employmentType !== 'ALL') {
    query = query.eq('employment_type', params.employmentType);
  }

  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    query = query.or(`title.ilike.%${s}%,department.ilike.%${s}%,job_code.ilike.%${s}%`);
  }

  const sortBy = params.sortBy || 'created_at';
  const ascending = params.sortOrder === 'asc';
  query = query.order(sortBy, { ascending });
  query = query.range(from, to);

  const { data: jobs, count, error } = await query;

  if (error) {
    logger.error('Failed to fetch job requisitions', { error: error.message });
    throw new AppError(`Failed to fetch job requisitions: ${error.message}`, 500);
  }

  // Retrieve applications count for each job
  let jobsWithCounts = jobs || [];
  if (jobsWithCounts.length > 0) {
    const jobIds = jobsWithCounts.map((j) => j.id);
    const { data: appCounts } = await supabase
      .from('hr_applications')
      .select('job_id')
      .in('job_id', jobIds);

    const countMap = {};
    if (appCounts) {
      appCounts.forEach((a) => {
        if (a.job_id) {
          countMap[a.job_id] = (countMap[a.job_id] || 0) + 1;
        }
      });
    }

    jobsWithCounts = jobsWithCounts.map((j) => ({
      ...j,
      applicationsCount: countMap[j.id] || 0
    }));
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return {
    jobs: jobsWithCounts,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages
    }
  };
};

/**
 * Fetches single job requisition by ID.
 */
export const getJobById = async (id, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Job ID is required', 400);

  const { data: job, error } = await supabase
    .from('hr_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch job by ID', { id, error: error.message });
    throw new AppError(`Failed to fetch job: ${error.message}`, 500);
  }

  if (!job) {
    throw new AppError('Job requisition not found', 404);
  }

  // Get application count and recent applications
  const { data: apps, error: appErr } = await supabase
    .from('hr_applications')
    .select(`
      id,
      status,
      applied_at,
      source,
      candidate_id,
      hr_candidates (
        id,
        full_name,
        email
      )
    `)
    .eq('job_id', id)
    .order('applied_at', { ascending: false });

  if (appErr) {
    logger.warn('Failed to fetch applications for job', { id, error: appErr.message });
  }

  return {
    ...job,
    applicationsCount: apps?.length || 0,
    applications: apps || []
  };
};

/**
 * Creates a new job requisition.
 */
export const createJob = async (payload, user = {}, supabase = defaultSupabase) => {
  const {
    title,
    department,
    description,
    requiredSkills = [],
    qualifications,
    location = 'Remote',
    employmentType = 'FULL_TIME',
    openingsCount = 1,
    hiringManager,
    status = 'OPEN',
    jobCode
  } = payload;

  if (!title || !title.trim()) {
    throw new AppError('Job title is required', 400);
  }

  if (!department || !department.trim()) {
    throw new AppError('Department is required', 400);
  }

  // Generate unique job code if not provided
  let code = jobCode ? jobCode.trim().toUpperCase() : null;
  if (!code) {
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    code = `REQ-${year}-${rand}`;
  }

  const record = {
    job_code: code,
    title: title.trim(),
    department: department.trim(),
    description: description ? description.trim() : null,
    required_skills: Array.isArray(requiredSkills) ? requiredSkills : [],
    qualifications: qualifications ? qualifications.trim() : null,
    location: location.trim(),
    employment_type: EMPLOYMENT_TYPES.includes(employmentType) ? employmentType : 'FULL_TIME',
    openings_count: Math.max(1, Number(openingsCount) || 1),
    hiring_manager: hiringManager ? hiringManager.trim() : null,
    status: JOB_STATUSES.includes(status) ? status : 'OPEN',
    created_by: user.email || user.id || 'system',
    updated_by: user.email || user.id || 'system'
  };

  const { data: created, error } = await supabase
    .from('hr_jobs')
    .insert([record])
    .select()
    .single();

  if (error) {
    if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('job_code')) {
      throw new AppError(`Job code '${code}' already exists. Please specify a unique code.`, 409);
    }
    logger.error('Failed to create job requisition', { error: error.message });
    throw new AppError(`Failed to create job requisition: ${error.message}`, 500);
  }

  return created;
};

/**
 * Updates an existing job requisition.
 */
export const updateJob = async (id, payload, user = {}, supabase = defaultSupabase) => {
  if (!id) throw new AppError('Job ID is required', 400);

  const existing = await getJobById(id, supabase);

  const updates = {
    updated_by: user.email || user.id || 'system',
    updated_at: new Date().toISOString()
  };

  if (payload.title !== undefined) updates.title = payload.title.trim();
  if (payload.department !== undefined) updates.department = payload.department.trim();
  if (payload.description !== undefined) updates.description = payload.description?.trim() || null;
  if (payload.requiredSkills !== undefined) updates.required_skills = Array.isArray(payload.requiredSkills) ? payload.requiredSkills : [];
  if (payload.qualifications !== undefined) updates.qualifications = payload.qualifications?.trim() || null;
  if (payload.location !== undefined) updates.location = payload.location.trim();
  if (payload.employmentType !== undefined) {
    if (!EMPLOYMENT_TYPES.includes(payload.employmentType)) {
      throw new AppError(`Invalid employment type: ${payload.employmentType}`, 400);
    }
    updates.employment_type = payload.employmentType;
  }
  if (payload.openingsCount !== undefined) updates.openings_count = Math.max(1, Number(payload.openingsCount) || 1);
  if (payload.hiringManager !== undefined) updates.hiring_manager = payload.hiringManager?.trim() || null;
  if (payload.status !== undefined) {
    if (!JOB_STATUSES.includes(payload.status)) {
      throw new AppError(`Invalid job status: ${payload.status}`, 400);
    }
    updates.status = payload.status;
  }

  const { data: updated, error } = await supabase
    .from('hr_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update job requisition', { id, error: error.message });
    throw new AppError(`Failed to update job requisition: ${error.message}`, 500);
  }

  return updated;
};

/**
 * Archives or soft-deletes a job requisition.
 */
export const archiveJob = async (id, user = {}, supabase = defaultSupabase) => {
  return updateJob(id, { status: 'ARCHIVED' }, user, supabase);
};
