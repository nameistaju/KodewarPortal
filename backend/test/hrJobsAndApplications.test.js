import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';

const { ROLES } = await import('../src/constants/roles.js');
const { authorizeRoles } = await import('../src/middleware/roleMiddleware.js');
const {
  JOB_STATUSES,
  EMPLOYMENT_TYPES,
  getJobs,
  getJobById,
  createJob,
  updateJob,
  archiveJob
} = await import('../src/services/hrJobService.js');
const {
  APPLICATION_STATUSES,
  APPLICATION_SOURCES,
  getApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  updateApplicationStatus,
  createApplicationFromEmail,
  getApplicationAuditLogs
} = await import('../src/services/hrApplicationService.js');
const { createJobSchema, updateJobSchema, jobQuerySchema } = await import('../src/validators/hrJobValidator.js');
const {
  createApplicationSchema,
  updateApplicationStatusSchema,
  applicationQuerySchema,
  createApplicationFromEmailSchema
} = await import('../src/validators/hrApplicationValidator.js');

// Mock in-memory Supabase factory for hermetic testing
const createMockSupabase = (initialData = {}) => {
  const jobs = [...(initialData.jobs || [])];
  const applications = [...(initialData.applications || [])];
  const candidates = [...(initialData.candidates || [])];
  const emails = [...(initialData.emails || [])];
  const candidateEmails = [...(initialData.candidateEmails || [])];
  const candidateAuditLogs = [...(initialData.candidateAuditLogs || [])];
  const appAuditLogs = [...(initialData.appAuditLogs || [])];

  return {
    _state: { jobs, applications, candidates, emails, candidateEmails, candidateAuditLogs, appAuditLogs },
    from(table) {
      if (table === 'hr_jobs') {
        return {
          select(columns, opts = {}) {
            let filtered = [...jobs];
            const builder = {
              eq(col, val) {
                filtered = filtered.filter((r) => r[col] === val);
                return builder;
              },
              or(expr) {
                const match = expr.match(/title\.ilike\.%(.*?)%/);
                if (match) {
                  const s = match[1].toLowerCase();
                  filtered = filtered.filter(
                    (r) =>
                      (r.title && r.title.toLowerCase().includes(s)) ||
                      (r.department && r.department.toLowerCase().includes(s)) ||
                      (r.job_code && r.job_code.toLowerCase().includes(s))
                  );
                }
                return builder;
              },
              order(col, { ascending = true } = {}) {
                filtered.sort((a, b) => {
                  const va = a[col];
                  const vb = b[col];
                  if (va < vb) return ascending ? -1 : 1;
                  if (va > vb) return ascending ? 1 : -1;
                  return 0;
                });
                return builder;
              },
              range(from, to) {
                filtered = filtered.slice(from, to + 1);
                return builder;
              },
              maybeSingle: async () => ({
                data: filtered[0] || null,
                error: null
              }),
              single: async () => ({
                data: filtered[0] || null,
                error: filtered[0] ? null : { message: 'Job not found' }
              }),
              then(resolve) {
                resolve({
                  data: filtered,
                  count: opts.count ? jobs.length : filtered.length,
                  error: null
                });
              }
            };
            return builder;
          },
          insert(records) {
            return {
              select() {
                return {
                  single: async () => {
                    const row = {
                      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      ...records[0]
                    };
                    jobs.push(row);
                    return { data: row, error: null };
                  }
                };
              }
            };
          },
          update(fields) {
            return {
              eq(col, val) {
                return {
                  select() {
                    return {
                      single: async () => {
                        const idx = jobs.findIndex((j) => j[col] === val);
                        if (idx === -1) return { data: null, error: { message: 'Job not found' } };
                        jobs[idx] = { ...jobs[idx], ...fields, updated_at: new Date().toISOString() };
                        return { data: jobs[idx], error: null };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'hr_applications') {
        return {
          select(columns, opts = {}) {
            let filtered = [...applications];
            const builder = {
              eq(col, val) {
                filtered = filtered.filter((r) => r[col] === val);
                return builder;
              },
              is(col, val) {
                filtered = filtered.filter((r) => r[col] === val);
                return builder;
              },
              in(col, vals) {
                filtered = filtered.filter((r) => vals.includes(r[col]));
                return builder;
              },
              order(col, { ascending = true } = {}) {
                filtered.sort((a, b) => {
                  const va = a[col];
                  const vb = b[col];
                  if (va < vb) return ascending ? -1 : 1;
                  if (va > vb) return ascending ? 1 : -1;
                  return 0;
                });
                return builder;
              },
              range(from, to) {
                filtered = filtered.slice(from, to + 1);
                return builder;
              },
              maybeSingle: async () => ({
                data: filtered[0] || null,
                error: null
              }),
              single: async () => ({
                data: filtered[0] || null,
                error: filtered[0] ? null : { message: 'Application not found' }
              }),
              then(resolve) {
                const populated = filtered.map((app) => ({
                  ...app,
                  candidate: candidates.find((c) => c.id === app.candidate_id) || null,
                  job: jobs.find((j) => j.id === app.job_id) || null,
                  email: emails.find((e) => e.id === app.email_id) || null
                }));
                resolve({
                  data: populated,
                  count: opts.count ? applications.length : filtered.length,
                  error: null
                });
              }
            };
            return builder;
          },
          insert(records) {
            return {
              select() {
                return {
                  single: async () => {
                    const row = {
                      id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      ...records[0]
                    };
                    applications.push(row);
                    return { data: row, error: null };
                  }
                };
              }
            };
          },
          update(fields) {
            return {
              eq(col, val) {
                return {
                  select() {
                    return {
                      single: async () => {
                        const idx = applications.findIndex((a) => a[col] === val);
                        if (idx === -1) return { data: null, error: { message: 'Application not found' } };
                        applications[idx] = { ...applications[idx], ...fields, updated_at: new Date().toISOString() };
                        return { data: applications[idx], error: null };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'hr_candidates') {
        return {
          select(columns, opts = {}) {
            let filtered = [...candidates];
            const builder = {
              eq(col, val) {
                filtered = filtered.filter((r) => r[col] === val);
                return builder;
              },
              ilike(col, val) {
                const s = String(val).toLowerCase();
                filtered = filtered.filter((r) => String(r[col] || '').toLowerCase() === s);
                return builder;
              },
              maybeSingle: async () => ({ data: filtered[0] || null, error: null }),
              single: async () => ({ data: filtered[0] || null, error: filtered[0] ? null : { message: 'Candidate not found' } })
            };
            return builder;
          },
          insert(records) {
            return {
              select() {
                return {
                  single: async () => {
                    const row = {
                      id: `cand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      ...records[0]
                    };
                    candidates.push(row);
                    return { data: row, error: null };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'hr_candidate_emails') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      then(resolve) {
                        resolve({ data: candidateEmails, error: null });
                      }
                    };
                  }
                };
              }
            };
          },
          insert(records) {
            return {
              select() {
                return {
                  single: async () => {
                    const exists = candidateEmails.some(
                      (l) => l.candidate_id === records[0].candidate_id && l.email_id === records[0].email_id
                    );
                    if (exists) {
                      return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
                    }
                    const row = { id: `link-${Date.now()}`, ...records[0] };
                    candidateEmails.push(row);
                    return { data: row, error: null };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'hr_emails') {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  maybeSingle: async () => {
                    const email = emails.find((e) => e[col] === val);
                    return { data: email || null, error: null };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'hr_application_audit_logs') {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  order() {
                    const logs = appAuditLogs.filter((a) => a[col] === val);
                    return {
                      then(resolve) {
                        resolve({ data: logs, error: null });
                      }
                    };
                  }
                };
              }
            };
          },
          insert: async (records) => {
            records.forEach((r) =>
              appAuditLogs.push({
                id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                created_at: new Date().toISOString(),
                ...r
              })
            );
            return { data: records, error: null };
          }
        };
      }

      if (table === 'hr_candidate_audit_logs') {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  order() {
                    const logs = candidateAuditLogs.filter((a) => a[col] === val);
                    return {
                      then(resolve) {
                        resolve({ data: logs, error: null });
                      }
                    };
                  }
                };
              }
            };
          },
          insert: async (records) => {
            records.forEach((r) => candidateAuditLogs.push(r));
            return { data: records, error: null };
          }
        };
      }

      throw new Error(`Unknown table: ${table}`);
    }
  };
};

// -------------------------------------------------------------------------
// 1. ROLE AUTHORIZATION
// -------------------------------------------------------------------------
test('hrJobRoutes & hrApplicationRoutes: HR and ADMIN roles authorized, EMPLOYEE denied', () => {
  const middleware = authorizeRoles(ROLES.HR, ROLES.ADMIN);

  let hrAllowed = false;
  middleware({ user: { role: 'HR', email: 'hr@kodewar.com' } }, {}, () => { hrAllowed = true; });
  assert.equal(hrAllowed, true);

  let adminAllowed = false;
  middleware({ user: { role: 'ADMIN', email: 'admin@kodewar.com' } }, {}, () => { adminAllowed = true; });
  assert.equal(adminAllowed, true);

  let employeeError = null;
  middleware({ user: { role: 'EMPLOYEE', email: 'emp@kodewar.com' } }, {}, (err) => { employeeError = err; });
  assert.ok(employeeError);
  assert.equal(employeeError.statusCode, 403);
});

// -------------------------------------------------------------------------
// 2. JOB REQUISITION CRUD
// -------------------------------------------------------------------------
test('hrJobService: createJob creates a job requisition with code and defaults', async () => {
  const mockSupabase = createMockSupabase();

  const job = await createJob(
    {
      title: 'Full Stack Engineer',
      department: 'Engineering',
      description: 'Building next-gen portals',
      requiredSkills: ['React', 'Node.js', 'PostgreSQL'],
      location: 'Bengaluru / Remote',
      employmentType: 'FULL_TIME',
      openingsCount: 2
    },
    { email: 'hr.manager@kodewar.com' },
    mockSupabase
  );

  assert.ok(job.id);
  assert.equal(job.title, 'Full Stack Engineer');
  assert.equal(job.department, 'Engineering');
  assert.ok(job.job_code.startsWith('REQ-'));
  assert.equal(job.status, 'OPEN');
  assert.equal(job.openings_count, 2);
  assert.equal(job.created_by, 'hr.manager@kodewar.com');
});

test('hrJobService: getJobs paginates and computes applicationsCount', async () => {
  const initialJobs = [
    { id: 'job-1', job_code: 'REQ-1', title: 'Frontend Engineer', department: 'Engineering', status: 'OPEN' },
    { id: 'job-2', job_code: 'REQ-2', title: 'QA Specialist', department: 'Quality', status: 'OPEN' }
  ];
  const initialApps = [
    { id: 'app-1', job_id: 'job-1', candidate_id: 'cand-1', status: 'APPLIED' },
    { id: 'app-2', job_id: 'job-1', candidate_id: 'cand-2', status: 'INTERVIEW' }
  ];

  const mockSupabase = createMockSupabase({ jobs: initialJobs, applications: initialApps });

  const result = await getJobs({ page: 1, limit: 10 }, mockSupabase);
  assert.equal(result.jobs.length, 2);
  const job1 = result.jobs.find((j) => j.id === 'job-1');
  assert.equal(job1.applicationsCount, 2);
  const job2 = result.jobs.find((j) => j.id === 'job-2');
  assert.equal(job2.applicationsCount, 0);
});

test('hrJobService: updateJob and archiveJob modify requisition status', async () => {
  const initial = { id: 'job-update-1', title: 'DevOps Lead', department: 'Infrastructure', status: 'OPEN' };
  const mockSupabase = createMockSupabase({ jobs: [initial] });

  const updated = await updateJob('job-update-1', { title: 'Lead DevOps & Cloud', openingsCount: 3 }, { email: 'hr@kodewar.com' }, mockSupabase);
  assert.equal(updated.title, 'Lead DevOps & Cloud');
  assert.equal(updated.openings_count, 3);

  const archived = await archiveJob('job-update-1', { email: 'hr@kodewar.com' }, mockSupabase);
  assert.equal(archived.status, 'ARCHIVED');
});

// -------------------------------------------------------------------------
// 3. APPLICATION CREATION, DUPLICATE PREVENTION & MULTIPLE JOBS
// -------------------------------------------------------------------------
test('hrApplicationService: createApplication prevents duplicate applications to the same job', async () => {
  const candidate = { id: 'cand-1', full_name: 'John Doe', email: 'john@example.com' };
  const jobA = { id: 'job-A', title: 'Backend Engineer' };
  const existingApp = { id: 'app-existing-1', candidate_id: 'cand-1', job_id: 'job-A', status: 'APPLIED' };

  const mockSupabase = createMockSupabase({
    candidates: [candidate],
    jobs: [jobA],
    applications: [existingApp]
  });

  // Attempting to apply again to the same job (job-A) must throw 409 Conflict
  await assert.rejects(
    async () => {
      await createApplication(
        { candidateId: 'cand-1', jobId: 'job-A' },
        { email: 'hr@kodewar.com' },
        mockSupabase
      );
    },
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.ok(err.message.includes('already applied'));
      return true;
    }
  );
});

test('hrApplicationService: candidate can apply for DIFFERENT jobs without collision', async () => {
  const candidate = { id: 'cand-mult', full_name: 'Alice Wonder', email: 'alice@example.com' };
  const jobA = { id: 'job-A', title: 'Backend Engineer' };
  const jobB = { id: 'job-B', title: 'Full Stack Engineer' };
  const existingAppJobA = { id: 'app-A', candidate_id: 'cand-mult', job_id: 'job-A', status: 'APPLIED' };

  const mockSupabase = createMockSupabase({
    candidates: [candidate],
    jobs: [jobA, jobB],
    applications: [existingAppJobA]
  });

  // Applying for job-B succeeds because candidate can apply to multiple distinct requisitions
  const appB = await createApplication(
    { candidateId: 'cand-mult', jobId: 'job-B', source: 'CAREERS_PAGE' },
    { email: 'hr@kodewar.com' },
    mockSupabase
  );

  assert.ok(appB.id);
  assert.equal(appB.job_id, 'job-B');
  assert.equal(mockSupabase._state.applications.length, 2);
});

test('hrApplicationService: unassigned job application allowed for HR review', async () => {
  const candidate = { id: 'cand-unassigned', full_name: 'Bob Ambiguous', email: 'bob@example.com' };
  const mockSupabase = createMockSupabase({ candidates: [candidate] });

  const app = await createApplication(
    {
      candidateId: 'cand-unassigned',
      jobId: null, // Left unassigned intentionally
      source: 'EMAIL',
      notes: 'Role ambiguous from email; awaiting HR triage'
    },
    { email: 'hr@kodewar.com' },
    mockSupabase
  );

  assert.ok(app.id);
  assert.equal(app.job_id, null);
  assert.equal(app.status, 'APPLIED');

  // Verify audit log
  const audit = mockSupabase._state.appAuditLogs.find((a) => a.application_id === app.id);
  assert.ok(audit);
  assert.equal(audit.action, 'CREATED');
  assert.ok(audit.reason.includes('unassigned review queue'));
});

// -------------------------------------------------------------------------
// 4. STATUS TRANSITIONS & AUDIT LOGGING
// -------------------------------------------------------------------------
test('hrApplicationService: updateApplicationStatus modifies status and logs audit entry', async () => {
  const candidate = { id: 'cand-stat', full_name: 'Charlie Root' };
  const app = { id: 'app-stat-1', candidate_id: 'cand-stat', job_id: 'job-1', status: 'APPLIED' };
  const mockSupabase = createMockSupabase({ candidates: [candidate], applications: [app] });

  const updated = await updateApplicationStatus(
    'app-stat-1',
    'INTERVIEW',
    'Passed initial HR screen and coding assessment',
    { email: 'interviewer@kodewar.com' },
    mockSupabase
  );

  assert.equal(updated.status, 'INTERVIEW');

  // Verify audit trail
  const audit = mockSupabase._state.appAuditLogs.find((a) => a.action === 'STATUS_CHANGED');
  assert.ok(audit);
  assert.equal(audit.old_values.status, 'APPLIED');
  assert.equal(audit.new_values.status, 'INTERVIEW');
  assert.equal(audit.reason, 'Passed initial HR screen and coding assessment');
  assert.equal(audit.performed_by, 'interviewer@kodewar.com');
});

// -------------------------------------------------------------------------
// 5. INCOMING EMAIL INTEGRATION WORKFLOW
// -------------------------------------------------------------------------
test('hrApplicationService: createApplicationFromEmail records Instagram source when confirmed by HR', async () => {
  const email = {
    id: 'email-ig-1',
    uid: 155,
    subject: 'Saw your Instagram hiring post',
    from_name: 'Diana Prince',
    from_address: 'diana@amazon.com'
  };
  const job = { id: 'job-ig', title: 'Community & Social Lead' };

  const mockSupabase = createMockSupabase({
    emails: [email],
    jobs: [job]
  });

  const app = await createApplicationFromEmail(
    {
      emailId: 'email-ig-1',
      jobId: 'job-ig',
      source: 'INSTAGRAM', // Confirmed from Instagram ad
      notes: 'Candidate referenced Instagram sponsored reel'
    },
    { email: 'hr.social@kodewar.com' },
    mockSupabase
  );

  assert.ok(app.id);
  assert.equal(app.job_id, 'job-ig');
  assert.equal(app.source, 'INSTAGRAM');
  assert.equal(app.email_id, 'email-ig-1');

  // Candidate was automatically created with Diana Prince
  const cand = mockSupabase._state.candidates.find((c) => c.email === 'diana@amazon.com');
  assert.ok(cand);
  assert.equal(cand.full_name, 'Diana Prince');
  assert.equal(cand.source, 'INSTAGRAM');

  // Email linkage recorded
  assert.equal(mockSupabase._state.candidateEmails.length, 1);
});

// -------------------------------------------------------------------------
// 6. VALIDATORS
// -------------------------------------------------------------------------
test('hrJobValidator & hrApplicationValidator reject invalid inputs', () => {
  // Job validator: missing title
  const invalidJob = createJobSchema.safeParse({ department: 'Engineering' });
  assert.equal(invalidJob.success, false);

  // Application validator: invalid status
  const invalidAppStatus = updateApplicationStatusSchema.safeParse({ status: 'CHOSEN_ONE' });
  assert.equal(invalidAppStatus.success, false);

  // Application validator: invalid UUID
  const invalidApp = createApplicationSchema.safeParse({ candidateId: 'not-a-uuid' });
  assert.equal(invalidApp.success, false);
});
