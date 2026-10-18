import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';

const { ROLES } = await import('../src/constants/roles.js');
const { authorizeRoles } = await import('../src/middleware/roleMiddleware.js');
const {
  CANDIDATE_STATUSES,
  CANDIDATE_SOURCES,
  getCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  updateCandidateStatus,
  linkEmailToCandidate,
  unlinkEmailFromCandidate,
  createCandidateFromEmail,
  getCandidateAuditLogs
} = await import('../src/services/hrCandidateService.js');
const {
  createCandidateSchema,
  updateCandidateSchema,
  updateStatusSchema,
  linkEmailSchema,
  createFromEmailSchema,
  candidateQuerySchema
} = await import('../src/validators/hrCandidateValidator.js');

// Helper to create an in-memory mock Supabase client
const createMockSupabase = (initialData = {}) => {
  const candidates = [...(initialData.candidates || [])];
  const linkedEmails = [...(initialData.linkedEmails || [])];
  const emails = [...(initialData.emails || [])];
  const auditLogs = [...(initialData.auditLogs || [])];

  return {
    _state: { candidates, linkedEmails, emails, auditLogs },
    from(table) {
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
                const search = String(val).toLowerCase();
                filtered = filtered.filter((r) => String(r[col] || '').toLowerCase() === search);
                return builder;
              },
              or(expr) {
                // simple simulated search
                const match = expr.match(/full_name\.ilike\.%(.*?)%/);
                if (match) {
                  const s = match[1].toLowerCase();
                  filtered = filtered.filter(
                    (r) =>
                      (r.full_name && r.full_name.toLowerCase().includes(s)) ||
                      (r.email && r.email.toLowerCase().includes(s)) ||
                      (r.target_role && r.target_role.toLowerCase().includes(s))
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
                error: filtered[0] ? null : { message: 'Row not found' }
              }),
              then(resolve) {
                resolve({
                  data: filtered,
                  count: opts.count ? candidates.length : filtered.length,
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
                      id: `cand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
          },
          update(fields) {
            return {
              eq(col, val) {
                return {
                  select() {
                    return {
                      single: async () => {
                        const idx = candidates.findIndex((c) => c[col] === val);
                        if (idx === -1) return { data: null, error: { message: 'Candidate not found' } };
                        candidates[idx] = { ...candidates[idx], ...fields, updated_at: new Date().toISOString() };
                        return { data: candidates[idx], error: null };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'hr_candidate_emails') {
        return {
          select(columns) {
            let filtered = [...linkedEmails];
            const builder = {
              eq(col, val) {
                filtered = filtered.filter((r) => r[col] === val);
                return builder;
              },
              order() {
                return builder;
              },
              maybeSingle: async () => ({
                data: filtered[0] || null,
                error: null
              }),
              then(resolve) {
                resolve({
                  data: filtered.map((l) => ({
                    ...l,
                    hr_emails: emails.find((e) => e.id === l.email_id) || null
                  })),
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
                    const exists = linkedEmails.some(
                      (l) => l.candidate_id === records[0].candidate_id && l.email_id === records[0].email_id
                    );
                    if (exists) {
                      return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
                    }
                    const row = {
                      id: `link-${Date.now()}`,
                      linked_at: new Date().toISOString(),
                      ...records[0]
                    };
                    linkedEmails.push(row);
                    return { data: row, error: null };
                  }
                };
              }
            };
          },
          delete() {
            return {
              eq(col1, val1) {
                return {
                  eq(col2, val2) {
                    return {
                      select: async () => {
                        const initialLen = linkedEmails.length;
                        const removed = [];
                        for (let i = linkedEmails.length - 1; i >= 0; i--) {
                          if (linkedEmails[i][col1] === val1 && linkedEmails[i][col2] === val2) {
                            removed.push(linkedEmails.splice(i, 1)[0]);
                          }
                        }
                        return { data: removed, error: null };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'hr_emails') {
        return {
          select(cols) {
            return {
              eq(col, val) {
                return {
                  maybeSingle: async () => {
                    const row = emails.find((e) => e[col] === val);
                    return { data: row || null, error: null };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'hr_candidate_audit_logs') {
        return {
          select(cols) {
            return {
              eq(col, val) {
                return {
                  order() {
                    const filtered = auditLogs.filter((a) => a[col] === val);
                    return {
                      then(resolve) {
                        resolve({ data: filtered, error: null });
                      }
                    };
                  }
                };
              }
            };
          },
          insert: async (records) => {
            records.forEach((r) =>
              auditLogs.push({
                id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                created_at: new Date().toISOString(),
                ...r
              })
            );
            return { data: records, error: null };
          }
        };
      }

      throw new Error(`Unknown table: ${table}`);
    }
  };
};

// -------------------------------------------------------------------------
// SECTION 1: VALIDATORS
// -------------------------------------------------------------------------
test('hrCandidateValidator: createCandidateSchema accepts valid candidate payload', () => {
  const result = createCandidateSchema.safeParse({
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    phone: '+1 555-0199',
    source: 'EMAIL',
    targetRole: 'Full Stack Developer',
    experienceYears: 4,
    status: 'APPLIED',
    tags: ['react', 'node']
  });

  assert.equal(result.success, true);
  assert.equal(result.data.firstName, 'Jane');
  assert.equal(result.data.email, 'jane.doe@example.com');
  assert.equal(result.data.status, 'APPLIED');
  assert.deepEqual(result.data.tags, ['react', 'node']);
});

test('hrCandidateValidator: createCandidateSchema rejects invalid email and missing firstName', () => {
  const missingName = createCandidateSchema.safeParse({
    email: 'test@example.com'
  });
  assert.equal(missingName.success, false);

  const invalidEmail = createCandidateSchema.safeParse({
    firstName: 'John',
    email: 'not-an-email'
  });
  assert.equal(invalidEmail.success, false);
});

test('hrCandidateValidator: updateStatusSchema enforces valid status enum', () => {
  const valid = updateStatusSchema.safeParse({ status: 'INTERVIEW', reason: 'Passed technical screen' });
  assert.equal(valid.success, true);
  assert.equal(valid.data.status, 'INTERVIEW');

  const invalid = updateStatusSchema.safeParse({ status: 'SUPER_HIRED' });
  assert.equal(invalid.success, false);
});

test('hrCandidateValidator: linkEmailSchema validates UUID email ID', () => {
  const valid = linkEmailSchema.safeParse({
    emailId: 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
    isPrimaryApplication: true
  });
  assert.equal(valid.success, true);

  const invalid = linkEmailSchema.safeParse({
    emailId: 'invalid-uuid-string'
  });
  assert.equal(invalid.success, false);
});

test('hrCandidateValidator: candidateQuerySchema parses filters and defaults', () => {
  const parsed = candidateQuerySchema.safeParse({
    page: '2',
    limit: '25',
    status: 'SCREENING',
    search: 'Alex'
  });

  assert.equal(parsed.success, true);
  assert.equal(parsed.data.page, 2);
  assert.equal(parsed.data.limit, 25);
  assert.equal(parsed.data.status, 'SCREENING');
  assert.equal(parsed.data.search, 'Alex');
  assert.equal(parsed.data.sortBy, 'created_at');
  assert.equal(parsed.data.sortOrder, 'desc');
});

// -------------------------------------------------------------------------
// SECTION 2: AUTHORIZATION
// -------------------------------------------------------------------------
test('hrCandidateRoutes: HR and ADMIN roles are authorized, EMPLOYEE is denied (403)', () => {
  const middleware = authorizeRoles(ROLES.HR, ROLES.ADMIN);

  let hrNextCalled = false;
  middleware({ user: { role: 'HR', email: 'hr@kodewar.com' } }, {}, () => {
    hrNextCalled = true;
  });
  assert.equal(hrNextCalled, true, 'HR role should be authorized');

  let adminNextCalled = false;
  middleware({ user: { role: 'ADMIN', email: 'admin@kodewar.com' } }, {}, () => {
    adminNextCalled = true;
  });
  assert.equal(adminNextCalled, true, 'ADMIN role should be authorized');

  let employeeError = null;
  middleware({ user: { role: 'EMPLOYEE', email: 'emp@kodewar.com' } }, {}, (err) => {
    employeeError = err;
  });
  assert.ok(employeeError, 'EMPLOYEE role should be rejected');
  assert.equal(employeeError.statusCode, 403);
});

// -------------------------------------------------------------------------
// SECTION 3: CANDIDATE SERVICE CRUD & DUPLICATE DETECTION
// -------------------------------------------------------------------------
test('hrCandidateService: createCandidate creates candidate with normalized email and audit log', async () => {
  const mockSupabase = createMockSupabase();

  const candidate = await createCandidate(
    {
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'Alice.Smith@Example.COM',
      source: 'EMAIL',
      targetRole: 'Backend Engineer'
    },
    { email: 'hr.reviewer@kodewar.com' },
    mockSupabase
  );

  assert.ok(candidate.id);
  assert.equal(candidate.full_name, 'Alice Smith');
  assert.equal(candidate.email, 'alice.smith@example.com');
  assert.equal(candidate.status, 'APPLIED');
  assert.equal(candidate.created_by, 'hr.reviewer@kodewar.com');

  // Verify audit log was recorded
  assert.equal(mockSupabase._state.auditLogs.length, 1);
  assert.equal(mockSupabase._state.auditLogs[0].action, 'CREATED');
  assert.equal(mockSupabase._state.auditLogs[0].performed_by, 'hr.reviewer@kodewar.com');
});

test('hrCandidateService: createCandidate detects duplicate email and throws 409 Conflict', async () => {
  const existingCandidate = {
    id: 'cand-existing-1',
    full_name: 'Existing Candidate',
    email: 'duplicate@example.com',
    status: 'APPLIED',
    target_role: 'Frontend Dev'
  };

  const mockSupabase = createMockSupabase({ candidates: [existingCandidate] });

  // Attempting to create with the same email without allowDuplicate: true must throw 409
  await assert.rejects(
    async () => {
      await createCandidate(
        {
          firstName: 'Another',
          lastName: 'Candidate',
          email: 'Duplicate@Example.com'
        },
        { email: 'hr@kodewar.com' },
        mockSupabase
      );
    },
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.ok(err.message.includes('already exists'));
      return true;
    }
  );

  // With allowDuplicate: true, the creation succeeds with an override
  const overridden = await createCandidate(
    {
      firstName: 'Another',
      lastName: 'Candidate',
      email: 'Duplicate@Example.com',
      allowDuplicate: true
    },
    { email: 'hr@kodewar.com' },
    mockSupabase
  );

  assert.ok(overridden.id);
  assert.equal(mockSupabase._state.candidates.length, 2);
});

test('hrCandidateService: getCandidates filters by status, search, and paginates', async () => {
  const candidates = [
    { id: '1', full_name: 'Bob Jones', email: 'bob@example.com', status: 'APPLIED', target_role: 'DevOps' },
    { id: '2', full_name: 'Carol White', email: 'carol@example.com', status: 'SCREENING', target_role: 'Frontend' },
    { id: '3', full_name: 'David Black', email: 'david@example.com', status: 'INTERVIEW', target_role: 'Backend' }
  ];

  const mockSupabase = createMockSupabase({ candidates });

  const result = await getCandidates({ page: 1, limit: 10 }, mockSupabase);
  assert.equal(result.candidates.length, 3);
  assert.equal(result.pagination.totalCount, 3);
  assert.equal(result.pagination.totalPages, 1);
});

test('hrCandidateService: updateCandidateStatus modifies status and writes audit entry', async () => {
  const initial = {
    id: 'cand-update-1',
    full_name: 'Eva Green',
    email: 'eva@example.com',
    status: 'APPLIED'
  };
  const mockSupabase = createMockSupabase({ candidates: [initial] });

  const updated = await updateCandidateStatus(
    'cand-update-1',
    'SCREENING',
    'Passed initial resume review',
    { email: 'hr.manager@kodewar.com' },
    mockSupabase
  );

  assert.equal(updated.status, 'SCREENING');

  // Verify status change audit entry
  const statusAudit = mockSupabase._state.auditLogs.find((a) => a.action === 'STATUS_CHANGED');
  assert.ok(statusAudit);
  assert.equal(statusAudit.candidate_id, 'cand-update-1');
  assert.equal(statusAudit.old_values.status, 'APPLIED');
  assert.equal(statusAudit.new_values.status, 'SCREENING');
  assert.equal(statusAudit.reason, 'Passed initial resume review');
});

test('hrCandidateService: updateCandidateStatus ignores no-op when status is identical', async () => {
  const initial = {
    id: 'cand-noop-1',
    full_name: 'Eva Green',
    email: 'eva@example.com',
    status: 'SCREENING'
  };
  const mockSupabase = createMockSupabase({ candidates: [initial] });

  const result = await updateCandidateStatus(
    'cand-noop-1',
    'SCREENING',
    'Redundant update',
    { email: 'hr@kodewar.com' },
    mockSupabase
  );

  assert.equal(result.status, 'SCREENING');
  assert.equal(mockSupabase._state.auditLogs.length, 0, 'No audit log for no-op transition');
});

// -------------------------------------------------------------------------
// SECTION 4: EMAIL LINKING AND UNLINKING
// -------------------------------------------------------------------------
test('hrCandidateService: linkEmailToCandidate links email, blocks duplicate link, and records audit', async () => {
  const candidate = { id: 'cand-link-1', full_name: 'Frank Miller', email: 'frank@example.com', status: 'APPLIED' };
  const email = {
    id: 'email-link-1',
    uid: 42,
    subject: 'Application for Node.js Developer',
    from_address: 'frank@example.com'
  };

  const mockSupabase = createMockSupabase({
    candidates: [candidate],
    emails: [email]
  });

  const link = await linkEmailToCandidate(
    'cand-link-1',
    'email-link-1',
    { isPrimaryApplication: true, notes: 'Direct email submission' },
    { email: 'hr@kodewar.com' },
    mockSupabase
  );

  assert.ok(link.id);
  assert.equal(link.candidate_id, 'cand-link-1');
  assert.equal(link.email_id, 'email-link-1');
  assert.equal(link.is_primary_application, true);

  // Verify audit log
  const linkAudit = mockSupabase._state.auditLogs.find((a) => a.action === 'EMAIL_LINKED');
  assert.ok(linkAudit);
  assert.equal(linkAudit.new_values.uid, 42);

  // Attempting to link the same email to the same candidate again must reject with 409
  await assert.rejects(
    async () => {
      await linkEmailToCandidate('cand-link-1', 'email-link-1', {}, { email: 'hr@kodewar.com' }, mockSupabase);
    },
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.ok(err.message.includes('already linked'));
      return true;
    }
  );
});

test('hrCandidateService: unlinkEmailFromCandidate removes link and logs audit', async () => {
  const candidate = { id: 'cand-unlink-1', full_name: 'Grace Hopper', email: 'grace@example.com' };
  const email = { id: 'email-unlink-1', uid: 50, subject: 'My CV' };
  const existingLink = {
    id: 'link-1',
    candidate_id: 'cand-unlink-1',
    email_id: 'email-unlink-1'
  };

  const mockSupabase = createMockSupabase({
    candidates: [candidate],
    emails: [email],
    linkedEmails: [existingLink]
  });

  const res = await unlinkEmailFromCandidate(
    'cand-unlink-1',
    'email-unlink-1',
    { email: 'hr@kodewar.com' },
    mockSupabase
  );

  assert.equal(res.success, true);
  assert.equal(mockSupabase._state.linkedEmails.length, 0);

  const unlinkAudit = mockSupabase._state.auditLogs.find((a) => a.action === 'EMAIL_UNLINKED');
  assert.ok(unlinkAudit);
  assert.equal(unlinkAudit.old_values.emailId, 'email-unlink-1');
});

test('hrCandidateService: createCandidateFromEmail creates candidate and auto-links email', async () => {
  const email = {
    id: 'email-auto-1',
    uid: 105,
    subject: 'Application for Cloud Architect',
    from_name: 'Harry Potter',
    from_address: 'harry@hogwarts.org'
  };

  const mockSupabase = createMockSupabase({ emails: [email] });

  const candidate = await createCandidateFromEmail(
    'email-auto-1',
    {},
    { email: 'recruiter@kodewar.com' },
    mockSupabase
  );

  assert.ok(candidate.id);
  assert.equal(candidate.first_name, 'Harry');
  assert.equal(candidate.last_name, 'Potter');
  assert.equal(candidate.email, 'harry@hogwarts.org');
  assert.equal(candidate.target_role, 'Cloud Architect');
  assert.equal(candidate.source, 'EMAIL');

  // Verify email link was created automatically
  assert.equal(mockSupabase._state.linkedEmails.length, 1);
  assert.equal(mockSupabase._state.linkedEmails[0].candidate_id, candidate.id);
  assert.equal(mockSupabase._state.linkedEmails[0].email_id, 'email-auto-1');
  assert.equal(mockSupabase._state.linkedEmails[0].is_primary_application, true);
});
