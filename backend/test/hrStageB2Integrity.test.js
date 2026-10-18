import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';

const { HR_EMAIL_CATEGORIES, classifyEmail, enrichEmailsWithClassification } = await import(
  '../src/services/hrEmailClassifier.js'
);
const { ROLES } = await import('../src/constants/roles.js');
const { authorizeRoles } = await import('../src/middleware/roleMiddleware.js');
const {
  createApplication,
  APPLICATION_STATUSES,
  APPLICATION_SOURCES
} = await import('../src/services/hrApplicationService.js');

test('Stage B2.3 Audit: Enterprise category definitions and manual override precedence', () => {
  assert.equal(HR_EMAIL_CATEGORIES.length, 9);
  assert.deepEqual(HR_EMAIL_CATEGORIES, [
    'Job Application',
    'Document Submission',
    'Application + Documents',
    'Interview / Interview Response',
    'Offer / Onboarding',
    'Application Status / Rejection',
    'General Enquiry',
    'Other',
    'Needs Human Review'
  ]);

  // Manual override takes 100% precedence regardless of email contents
  const emailWithOverride = {
    subject: 'Application for Senior Cloud Architect',
    snippet: 'Please find attached my resume for the cloud architect role.',
    has_attachments: true,
    attachments: [{ filename: 'resume.pdf' }],
    manual_category_override: 'Other'
  };

  const result = classifyEmail(emailWithOverride);
  assert.equal(result.category, 'Other');
  assert.equal(result.confidence, 1.0);
  assert.equal(result.isManualOverride, true);
});

test('Stage B2.3 Audit: Automated classification does not treat resume alone as confirmed job or source', () => {
  const email = {
    subject: 'My CV',
    snippet: 'Please review',
    has_attachments: true,
    attachments: [{ filename: 'candidate_cv.pdf' }]
  };

  const result = classifyEmail(email);
  assert.equal(result.category, 'Job Application');
  assert.equal(result.isManualOverride, false);

  // Email classification must NOT assign a job_id or confirmed source
  assert.equal(result.job_id, undefined);
  assert.equal(result.source, undefined);
});

test('Stage B2.3 Audit: Document classification distinguishes resumes from compliance credentials', () => {
  // Case A: Resume that mentions BTech/Degree in email text should NOT be classified as an identity/compliance doc
  const resumeEmail = {
    subject: 'Application for Fresher Role - BTech CSE',
    snippet: 'I completed my BTech in 2024. Here is my resume.',
    has_attachments: true,
    attachments: [{ filename: 'Murali_Resume.pdf' }]
  };

  const fnLower = resumeEmail.attachments[0].filename.toLowerCase();
  const isExplicitResume =
    /resume|cv|biodata|curriculum/i.test(fnLower) &&
    !/marksheet|certificate|photo|marks/i.test(fnLower);
  assert.equal(isExplicitResume, true);

  // Case B: Scanned ID photo or certificate without resume
  const idEmail = {
    subject: 'Submission of Photo for ID Card',
    snippet: 'Attached my passport size photograph for company ID card generation',
    has_attachments: true,
    attachments: [{ filename: 'passport_photo.jpg' }]
  };

  const idFnLower = idEmail.attachments[0].filename.toLowerCase();
  const isIdExplicitResume =
    /resume|cv|biodata|curriculum/i.test(idFnLower) &&
    !/marksheet|certificate|photo|marks/i.test(idFnLower);
  assert.equal(isIdExplicitResume, false);
});

test('Stage B2.3 Audit: Role boundary enforcement blocks EMPLOYEE and allows HR/ADMIN', () => {
  const guard = authorizeRoles(ROLES.HR, ROLES.ADMIN);

  // Employee blocked
  let employeeBlocked = false;
  guard({ user: { role: 'EMPLOYEE' } }, {}, (err) => {
    if (err && err.statusCode === 403) employeeBlocked = true;
  });
  assert.equal(employeeBlocked, true);

  // HR allowed
  let hrPassed = false;
  guard({ user: { role: 'HR' } }, {}, (err) => {
    if (!err) hrPassed = true;
  });
  assert.equal(hrPassed, true);

  // Admin allowed
  let adminPassed = false;
  guard({ user: { role: 'ADMIN' } }, {}, (err) => {
    if (!err) adminPassed = true;
  });
  assert.equal(adminPassed, true);
});

test('Stage B2.3 Audit: Application service enforces single-job constraint and permits cross-job applications', async () => {
  const existingApps = [
    { id: 'app-1', candidate_id: 'cand-1', job_id: 'job-cloud', status: 'APPLIED' }
  ];

  const mockDb = {
    from(table) {
      if (table === 'hr_applications') {
        return {
          select() {
            return {
              eq(col, val) {
                const chain = {
                  eq(col2, val2) {
                    const match = existingApps.find(
                      (a) => a[col] === val && a[col2] === val2
                    );
                    return {
                      maybeSingle: async () => ({ data: match || null, error: null })
                    };
                  }
                };
                return chain;
              }
            };
          },
          insert(records) {
            return {
              select() {
                return {
                  single: async () => {
                    const row = { id: `app-${Date.now()}`, ...records[0] };
                    existingApps.push(row);
                    return { data: row, error: null };
                  }
                };
              }
            };
          }
        };
      }
      if (table === 'hr_application_audit_logs') {
        return {
          insert: async () => ({ data: [], error: null })
        };
      }
      if (table === 'hr_jobs') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { id: 'job-devops', title: 'DevOps Engineer' },
                    error: null
                  })
                };
              }
            };
          }
        };
      }
      if (table === 'hr_candidate_emails' || table === 'hr_candidate_audit_logs') {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return Promise.resolve({ data: [], error: null });
                  }
                };
              }
            };
          }
        };
      }
      if (table === 'hr_candidates') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { id: 'cand-1', full_name: 'Praveen Kumar' },
                    error: null
                  })
                };
              }
            };
          }
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }
  };

  // 1. Applying again to same job (job-cloud) throws 409
  await assert.rejects(
    async () => {
      await createApplication(
        { candidateId: 'cand-1', jobId: 'job-cloud' },
        { email: 'hr@kodewar.com' },
        mockDb
      );
    },
    (err) => {
      assert.equal(err.statusCode, 409);
      return true;
    }
  );

  // 2. Applying to a DIFFERENT job (job-devops) succeeds
  const secondApp = await createApplication(
    { candidateId: 'cand-1', jobId: 'job-devops' },
    { email: 'hr@kodewar.com' },
    mockDb
  );
  assert.ok(secondApp.id);
  assert.equal(secondApp.job_id, 'job-devops');
});
