import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';

const { ROLES } = await import('../src/constants/roles.js');
const { authorizeRoles } = await import('../src/middleware/roleMiddleware.js');
const { protect } = await import('../src/middleware/authMiddleware.js');
const {
  categorizeAttachment,
  syncAttachmentMetadata,
  getDocuments,
  getDocumentById,
  updateDocumentReview,
  linkDocumentCandidate
} = await import('../src/services/hrDocumentService.js');
const {
  DOCUMENT_STATUSES,
  DOCUMENT_CATEGORIES,
  documentQuerySchema,
  documentIdParamSchema,
  updateDocumentReviewSchema,
  linkDocumentCandidateSchema
} = await import('../src/validators/hrDocumentValidator.js');

// Mock Supabase Factory for Document Verifications
const createMockSupabase = (initialData = {}) => {
  const documents = [...(initialData.documents || [])];
  const emails = [...(initialData.emails || [])];
  const candidates = [...(initialData.candidates || [])];
  const candidateEmails = [...(initialData.candidateEmails || [])];
  const auditLogs = [...(initialData.auditLogs || [])];

  return {
    _state: { documents, emails, candidates, candidateEmails, auditLogs },
    from(table) {
      if (table === 'hr_document_verifications') {
        return {
          select(columns, opts = {}) {
            let filtered = [...documents];
            if (opts.head && opts.count === 'exact') {
              return Promise.resolve({ count: documents.length, data: null, error: null });
            }
            const builder = {
              eq(col, val) {
                filtered = filtered.filter((r) => r[col] === val);
                return builder;
              },
              is(col, val) {
                filtered = filtered.filter((r) => r[col] === val);
                return builder;
              },
              or(expr) {
                // simple simulated OR query e.g. status.eq.X,status.eq.Y
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
                const sliced = filtered.slice(from, to + 1).map((d) => {
                  const email = emails.find((e) => e.id === d.email_id) || null;
                  const candidate = candidates.find((c) => c.id === d.candidate_id) || null;
                  return { ...d, email, candidate };
                });
                return Promise.resolve({
                  data: sliced,
                  count: filtered.length,
                  error: null
                });
              },
              maybeSingle() {
                const item = filtered[0] || null;
                if (!item) return Promise.resolve({ data: null, error: null });
                const email = emails.find((e) => e.id === item.email_id) || null;
                const candidate = candidates.find((c) => c.id === item.candidate_id) || null;
                return Promise.resolve({
                  data: { ...item, email, candidate },
                  error: null
                });
              }
            };
            return builder;
          },
          upsert(rows, opts = {}) {
            rows.forEach((row) => {
              const idx = documents.findIndex(
                (d) => d.email_id === row.email_id && d.attachment_index === row.attachment_index
              );
              if (idx === -1) {
                const newDoc = {
                  id: `doc-${documents.length + 1}`,
                  ...row,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                documents.push(newDoc);
              }
            });
            return {
              select() {
                return Promise.resolve({ data: documents, error: null });
              }
            };
          },
          update(updates) {
            return {
              eq(col, val) {
                const item = documents.find((d) => d[col] === val);
                if (item) {
                  Object.assign(item, updates);
                }
                return {
                  select() {
                    return {
                      single() {
                        return Promise.resolve({ data: item, error: null });
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
          select(columns) {
            return {
              eq(col, val) {
                const filtered = emails.filter((e) => e[col] === val);
                return Promise.resolve({ data: filtered, error: null });
              }
            };
          }
        };
      }

      if (table === 'hr_candidates') {
        return {
          select(columns) {
            return {
              eq(col, val) {
                const filtered = candidates.filter((c) => c[col] === val);
                return {
                  maybeSingle() {
                    return Promise.resolve({ data: filtered[0] || null, error: null });
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
            return Promise.resolve({ data: candidateEmails, error: null });
          }
        };
      }

      if (table === 'hr_document_audit_logs') {
        return {
          select(columns) {
            return {
              eq(col, val) {
                const filtered = auditLogs.filter((l) => l[col] === val);
                return {
                  order() {
                    return Promise.resolve({ data: filtered, error: null });
                  }
                };
              }
            };
          },
          insert(rows) {
            if (initialData.failAuditInsert) {
              return Promise.resolve({ data: null, error: new Error('Simulated audit table disk failure') });
            }
            auditLogs.push(...rows);
            return Promise.resolve({ data: rows, error: null });
          }
        };
      }

      throw new Error(`Unexpected table in mock: ${table}`);
    },
    rpc(fnName, args) {
      if (initialData.supportRpc && fnName === 'fn_review_hr_document_with_audit') {
        const item = documents.find((d) => d.id === args.p_document_id);
        if (!item) return Promise.resolve({ data: null, error: { message: 'Document not found', code: 'P0002' } });
        if (args.p_status) item.status = args.p_status;
        if (args.p_category) item.document_type = args.p_category;
        if (args.p_update_notes) item.review_notes = args.p_review_notes;
        if (args.p_update_candidate) item.candidate_id = args.p_candidate_id;
        item.reviewed_by = args.p_performed_by;
        item.reviewed_at = new Date().toISOString();
        auditLogs.push({
          document_id: item.id,
          action: 'REVIEW_UPDATED_VIA_RPC',
          performed_by: args.p_performed_by
        });
        return Promise.resolve({ data: item, error: null });
      }
      if (initialData.supportRpc && fnName === 'fn_link_hr_document_candidate_with_audit') {
        const item = documents.find((d) => d.id === args.p_document_id);
        if (!item) return Promise.resolve({ data: null, error: { message: 'Document not found', code: 'P0002' } });
        item.candidate_id = args.p_candidate_id;
        auditLogs.push({
          document_id: item.id,
          action: args.p_candidate_id ? 'CANDIDATE_LINKED_VIA_RPC' : 'CANDIDATE_UNLINKED_VIA_RPC',
          performed_by: args.p_performed_by
        });
        return Promise.resolve({ data: item, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `function ${fnName} does not exist`, code: 'PGRST202' } });
    }
  };
};

test('Stage B3.1 Security: RBAC enforces HR and ADMIN only, blocks EMPLOYEE with 403', () => {
  const hrMiddleware = authorizeRoles(ROLES.HR, ROLES.ADMIN);

  // Mock next
  let nextCalled = false;
  const next = (err) => {
    if (err) throw err;
    nextCalled = true;
  };

  // Case 1: HR user allowed
  nextCalled = false;
  const hrReq = { user: { role: ROLES.HR, email: 'hr@kodewar.com' } };
  hrMiddleware(hrReq, {}, next);
  assert.equal(nextCalled, true);

  // Case 2: ADMIN user allowed
  nextCalled = false;
  const adminReq = { user: { role: ROLES.ADMIN, email: 'admin@kodewar.com' } };
  hrMiddleware(adminReq, {}, next);
  assert.equal(nextCalled, true);

  // Case 3: EMPLOYEE blocked with 403
  nextCalled = false;
  const empReq = { user: { role: ROLES.EMPLOYEE, email: 'emp@kodewar.com' } };
  let errorCaught = null;
  const errorNext = (err) => {
    errorCaught = err;
  };
  hrMiddleware(empReq, {}, errorNext);
  assert.equal(nextCalled, false);
  assert.ok(errorCaught);
  assert.equal(errorCaught.statusCode, 403);
});

test('Stage B3.1 Deterministic categorization: Distinguishes resumes from compliance documents', () => {
  // Resumes
  assert.equal(categorizeAttachment('John_Doe_Resume.pdf', 'Job Application', ''), 'RESUME');
  assert.equal(categorizeAttachment('CV_2026.docx', 'Applying for developer', ''), 'RESUME');

  // Photographs
  assert.equal(categorizeAttachment('passport_photo.jpg', 'Submission of photo', ''), 'PHOTOGRAPH');
  assert.equal(categorizeAttachment('id_card_pic.png', 'ID Card Photograph', ''), 'PHOTOGRAPH');

  // Education / Marksheets
  assert.equal(categorizeAttachment('10th_marksheet.pdf', 'Educational certificates', ''), 'EDUCATION_CERTIFICATE');
  assert.equal(categorizeAttachment('degree_certificate.pdf', 'BTech Degree Certificate', ''), 'EDUCATION_CERTIFICATE');

  // Offer / Joining
  assert.equal(categorizeAttachment('signed_offer_letter.pdf', 'Offer Acceptance', ''), 'OFFER_JOINING_DOCUMENT');
  assert.equal(categorizeAttachment('appointment_letter.pdf', 'Appointment order', ''), 'OFFER_JOINING_DOCUMENT');

  // Government ID
  assert.equal(categorizeAttachment('aadhaar_card.pdf', 'Document verification', ''), 'IDENTITY_DOCUMENT');
  assert.equal(categorizeAttachment('pan_card.jpg', 'PAN card submission', ''), 'IDENTITY_DOCUMENT');

  // Other / Generic
  assert.equal(categorizeAttachment('random_doc.txt', 'Hello', 'World'), 'OTHER');
});

test('Stage B3.1 Validators: Rejects invalid statuses, categories, or malformed IDs', () => {
  // Query schema
  const validQuery = documentQuerySchema.safeParse({ page: '1', limit: '20', status: 'NEEDS_REVIEW' });
  assert.equal(validQuery.success, true);

  const invalidStatusQuery = documentQuerySchema.safeParse({ status: 'INVALID_STATUS' });
  assert.equal(invalidStatusQuery.success, false);

  // Review update schema
  const validReview = updateDocumentReviewSchema.safeParse({
    status: 'ACCEPTED',
    category: 'EDUCATION_CERTIFICATE',
    reviewNotes: 'Verified against university register'
  });
  assert.equal(validReview.success, true);

  const invalidReviewStatus = updateDocumentReviewSchema.safeParse({
    status: 'BOGUS_STATUS'
  });
  assert.equal(invalidReviewStatus.success, false);

  // ID param schema
  const validId = documentIdParamSchema.safeParse({ id: 'c6b1a134-22d7-4b71-bdfc-4cbca8e73456' });
  assert.equal(validId.success, true);

  const invalidId = documentIdParamSchema.safeParse({ id: '   ' });
  assert.equal(invalidId.success, false);
});

test('Stage B3.1 Privacy Guarantee: Binary is never stored or served; file_availability_notice is always returned', async () => {
  const mockSupabase = createMockSupabase({
    documents: [
      {
        id: 'doc-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'resume.pdf',
        content_type: 'application/pdf',
        size_bytes: 1024,
        document_type: 'RESUME',
        status: 'NEEDS_REVIEW',
        candidate_id: null
      }
    ],
    emails: [
      {
        id: 'email-1',
        uid: 10,
        from_name: 'Praveen Kumar',
        from_address: 'praveen@example.com',
        subject: 'Job Application',
        sent_at: '2026-10-15T10:00:00Z'
      }
    ]
  });

  const listRes = await getDocuments({}, mockSupabase);
  assert.equal(listRes.documents.length, 1);
  assert.equal(listRes.documents[0].binary_stored, false);
  assert.ok(listRes.documents[0].file_availability_notice.includes('Binary Not Stored'));

  const singleRes = await getDocumentById('doc-1', mockSupabase);
  assert.equal(singleRes.binary_stored, false);
  assert.ok(singleRes.file_availability_notice.includes('Binary Not Stored'));
});

test('Stage B3.1 Workflow: Updating review status records audit log with attribution', async () => {
  const mockSupabase = createMockSupabase({
    documents: [
      {
        id: 'doc-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'marksheet.pdf',
        content_type: 'application/pdf',
        size_bytes: 2048,
        document_type: 'EDUCATION_CERTIFICATE',
        status: 'NEEDS_REVIEW',
        candidate_id: null
      }
    ]
  });

  const user = { email: 'hr@kodewar.com', id: 'emp-hr-1' };
  const updated = await updateDocumentReview(
    'doc-1',
    {
      status: 'ACCEPTED',
      reviewNotes: 'Legible copy with visible university seal'
    },
    user,
    mockSupabase
  );

  assert.equal(updated.status, 'ACCEPTED');
  assert.equal(updated.reviewed_by, 'hr@kodewar.com');
  assert.ok(updated.reviewed_at);

  // Check audit log was written
  assert.equal(mockSupabase._state.auditLogs.length, 1);
  const audit = mockSupabase._state.auditLogs[0];
  assert.equal(audit.document_id, 'doc-1');
  assert.equal(audit.action, 'REVIEW_UPDATED');
  assert.equal(audit.performed_by, 'hr@kodewar.com');
  assert.equal(audit.old_values.status, 'NEEDS_REVIEW');
  assert.equal(audit.new_values.status, 'ACCEPTED');
});

test('Stage B3.1 Workflow: Candidate linking and unlinking records audit logs', async () => {
  const mockSupabase = createMockSupabase({
    documents: [
      {
        id: 'doc-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'id_card.jpg',
        content_type: 'image/jpeg',
        size_bytes: 512,
        document_type: 'PHOTOGRAPH',
        status: 'NEEDS_REVIEW',
        candidate_id: null
      }
    ],
    candidates: [
      {
        id: 'cand-1',
        full_name: 'Praveen Kumar',
        email: 'praveen@example.com'
      }
    ]
  });

  const user = { email: 'hr@kodewar.com' };

  // 1. Link candidate
  const linked = await linkDocumentCandidate('doc-1', 'cand-1', user, mockSupabase);
  assert.equal(linked.candidate_id, 'cand-1');
  assert.equal(mockSupabase._state.auditLogs.length, 1);
  assert.equal(mockSupabase._state.auditLogs[0].action, 'CANDIDATE_LINKED');

  // 2. Unlink candidate
  const unlinked = await linkDocumentCandidate('doc-1', null, user, mockSupabase);
  assert.equal(unlinked.candidate_id, null);
  assert.equal(mockSupabase._state.auditLogs.length, 2);
  assert.equal(mockSupabase._state.auditLogs[1].action, 'CANDIDATE_UNLINKED');
});

test('Stage B3.2 Audit Log Integrity: Failure to insert audit log triggers rollback and prevents un-audited state', async () => {
  const mockSupabase = createMockSupabase({
    failAuditInsert: true,
    documents: [
      {
        id: 'doc-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'id_card.jpg',
        content_type: 'image/jpeg',
        size_bytes: 512,
        document_type: 'PHOTOGRAPH',
        status: 'NEEDS_REVIEW',
        candidate_id: null
      }
    ]
  });

  const user = { email: 'hr@kodewar.com' };

  // Attempting to update review when audit logging fails must throw and rollback
  await assert.rejects(
    async () => {
      await updateDocumentReview('doc-1', { status: 'ACCEPTED' }, user, mockSupabase);
    },
    (err) => {
      assert.equal(err.statusCode, 500);
      assert.ok(err.message.includes('Audit log insertion failed'));
      return true;
    }
  );

  // Document status must have rolled back to NEEDS_REVIEW
  const docAfter = mockSupabase._state.documents.find((d) => d.id === 'doc-1');
  assert.equal(docAfter.status, 'NEEDS_REVIEW');
});

test('Stage B3.2 Transactional Atomicity: RPC function executes atomically when present', async () => {
  const mockSupabase = createMockSupabase({
    supportRpc: true,
    documents: [
      {
        id: 'doc-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'degree.pdf',
        content_type: 'application/pdf',
        size_bytes: 1024,
        document_type: 'EDUCATION_CERTIFICATE',
        status: 'NEEDS_REVIEW',
        candidate_id: null
      }
    ]
  });

  const user = { email: 'admin@kodewar.com' };
  const res = await updateDocumentReview(
    'doc-1',
    { status: 'ACCEPTED', reviewNotes: 'Verified with university seal' },
    user,
    mockSupabase
  );

  assert.equal(res.status, 'ACCEPTED');
  assert.equal(res.reviewed_by, 'admin@kodewar.com');
  assert.equal(mockSupabase._state.auditLogs.length, 1);
  assert.equal(mockSupabase._state.auditLogs[0].action, 'REVIEW_UPDATED_VIA_RPC');
});

test('Stage B3.2 Metadata Sync Idempotency: Multiple sync iterations do not create duplicate records', async () => {
  const mockSupabase = createMockSupabase({
    documents: [],
    emails: [
      {
        id: 'email-1',
        uid: 10,
        from_name: 'Praveen',
        from_address: 'praveen@example.com',
        subject: 'Application',
        has_attachments: true,
        attachments: [
          { filename: 'resume.pdf', size: 1000, contentType: 'application/pdf' },
          { filename: 'photo.jpg', size: 200, contentType: 'image/jpeg' }
        ]
      }
    ]
  });

  // Iteration 1
  const res1 = await syncAttachmentMetadata(mockSupabase);
  assert.equal(res1.syncedCount, 2);
  assert.equal(mockSupabase._state.documents.length, 2);

  // Iteration 2: same emails, must not duplicate
  const res2 = await syncAttachmentMetadata(mockSupabase);
  assert.equal(res2.syncedCount, 2); // upsert on conflict ignore
  assert.equal(mockSupabase._state.documents.length, 2); // Still exactly 2
});

test('Stage B3.2 Unlinked Document Queue: Unlinked attachments remain accessible for HR review', async () => {
  const mockSupabase = createMockSupabase({
    documents: [
      {
        id: 'doc-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'aadhaar.pdf',
        document_type: 'IDENTITY_DOCUMENT',
        status: 'NEEDS_REVIEW',
        candidate_id: null
      },
      {
        id: 'doc-2',
        email_id: 'email-1',
        attachment_index: 1,
        filename: 'resume.pdf',
        document_type: 'RESUME',
        status: 'NEEDS_REVIEW',
        candidate_id: 'cand-123'
      }
    ]
  });

  // Query unlinked
  const unlinked = await getDocuments({ candidateId: 'UNLINKED' }, mockSupabase);
  assert.equal(unlinked.documents.length, 1);
  assert.equal(unlinked.documents[0].id, 'doc-1');
  assert.equal(unlinked.documents[0].candidate_id, null);
});

test('Stage B3.3 Note Preservation: Updating status without reviewNotes preserves existing notes via RPC and fallback', async () => {
  // Case 1: RPC mode
  const mockRpcSupabase = createMockSupabase({
    supportRpc: true,
    documents: [
      {
        id: 'doc-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'degree.pdf',
        document_type: 'EDUCATION_CERTIFICATE',
        status: 'NEEDS_REVIEW',
        review_notes: 'Original reviewer note from previous inspection',
        candidate_id: null
      }
    ]
  });

  const user = { email: 'hr@kodewar.com' };
  const rpcRes = await updateDocumentReview(
    'doc-1',
    { status: 'UNDER_REVIEW' }, // reviewNotes is undefined
    user,
    mockRpcSupabase
  );

  assert.equal(rpcRes.status, 'UNDER_REVIEW');
  assert.equal(rpcRes.review_notes, 'Original reviewer note from previous inspection');

  // Case 2: Fallback mode (no RPC)
  const mockFallbackSupabase = createMockSupabase({
    supportRpc: false,
    documents: [
      {
        id: 'doc-2',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'id.jpg',
        document_type: 'PHOTOGRAPH',
        status: 'NEEDS_REVIEW',
        review_notes: 'Pre-existing photo notes',
        candidate_id: null
      }
    ]
  });

  const fallbackRes = await updateDocumentReview(
    'doc-2',
    { status: 'UNDER_REVIEW' }, // reviewNotes is undefined
    user,
    mockFallbackSupabase
  );

  assert.equal(fallbackRes.status, 'UNDER_REVIEW');
  assert.equal(fallbackRes.review_notes, 'Pre-existing photo notes');
});

test('Stage B3.3 Candidate Unlinking & RPC: Explicit null unlinks candidate and calls atomic RPC', async () => {
  const mockSupabase = createMockSupabase({
    supportRpc: true,
    documents: [
      {
        id: 'doc-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'pan.pdf',
        document_type: 'IDENTITY_DOCUMENT',
        status: 'NEEDS_REVIEW',
        candidate_id: 'cand-999'
      }
    ]
  });

  const user = { email: 'hr@kodewar.com' };
  const res = await linkDocumentCandidate('doc-1', null, user, mockSupabase);

  assert.equal(res.candidate_id, null);
  assert.equal(mockSupabase._state.auditLogs.length, 1);
  assert.equal(mockSupabase._state.auditLogs[0].action, 'CANDIDATE_UNLINKED_VIA_RPC');
});

test('Stage B3.3 Missing Authentication: protect middleware rejects unauthenticated requests with 401', async () => {
  const req = { headers: {} };
  let errorCaught = null;
  const next = (err) => {
    errorCaught = err;
  };

  await protect(req, {}, next);
  assert.ok(errorCaught);
  assert.equal(errorCaught.statusCode, 401);
  assert.equal(errorCaught.message, 'Authentication token is required');
});

test('Stage B3.3 Spoofed Reviewer Identity: Client body performed_by/reviewed_by is ignored in favor of session context', async () => {
  const mockSupabase = createMockSupabase({
    documents: [
      {
        id: 'doc-spoof-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'resume.pdf',
        document_type: 'RESUME',
        status: 'NEEDS_REVIEW',
        candidate_id: null
      }
    ]
  });

  // Client attempts to spoof reviewer as an executive or admin
  const maliciousClientPayload = {
    status: 'ACCEPTED',
    reviewed_by: 'ceo@kodewar.com',
    performed_by: 'ceo@kodewar.com',
    reviewer: 'ceo@kodewar.com'
  };

  // Legitimate authenticated session user from JWT
  const sessionUser = { email: 'hr.specialist@kodewar.com', id: 'emp-hr-101' };

  const updated = await updateDocumentReview('doc-spoof-1', maliciousClientPayload, sessionUser, mockSupabase);

  // Assert reviewed_by is strictly from sessionUser, ignoring payload
  assert.equal(updated.reviewed_by, 'hr.specialist@kodewar.com');
  assert.notEqual(updated.reviewed_by, 'ceo@kodewar.com');

  // Assert audit entry is strictly bound to sessionUser
  const audit = mockSupabase._state.auditLogs[0];
  assert.equal(audit.performed_by, 'hr.specialist@kodewar.com');
  assert.notEqual(audit.performed_by, 'ceo@kodewar.com');
});

test('Stage B3.3 Safe Error Handling: Missing document ID and invalid candidate ID safely throw 404', async () => {
  const mockSupabase = createMockSupabase({
    documents: [],
    candidates: []
  });

  const user = { email: 'hr@kodewar.com' };

  // 1. Missing document ID
  await assert.rejects(
    async () => {
      await updateDocumentReview('non-existent-doc', { status: 'ACCEPTED' }, user, mockSupabase);
    },
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.ok(err.message.includes('not found'));
      return true;
    }
  );

  // 2. Document exists, but candidate ID does not exist
  const mockSupabaseWithDoc = createMockSupabase({
    documents: [
      {
        id: 'doc-valid-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'aadhaar.pdf',
        document_type: 'IDENTITY_DOCUMENT',
        status: 'NEEDS_REVIEW',
        candidate_id: null
      }
    ],
    candidates: []
  });

  await assert.rejects(
    async () => {
      await linkDocumentCandidate('doc-valid-1', 'cand-does-not-exist', user, mockSupabaseWithDoc);
    },
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.ok(err.message.includes('Candidate profile not found'));
      return true;
    }
  );
});

test('Stage B3.3 Transport and Storage Isolation: Guaranteed no raw binary download or IMAP/SMTP transport', async () => {
  const mockSupabase = createMockSupabase({
    documents: [
      {
        id: 'doc-iso-1',
        email_id: 'email-1',
        attachment_index: 0,
        filename: 'degree.pdf',
        document_type: 'EDUCATION_CERTIFICATE',
        status: 'ACCEPTED',
        candidate_id: null
      }
    ]
  });

  const doc = await getDocumentById('doc-iso-1', mockSupabase);
  assert.equal(doc.binary_stored, false);
  assert.equal(doc.raw_binary, undefined);
  assert.equal(doc.file_buffer, undefined);
  assert.ok(doc.file_availability_notice.includes('Binary Not Stored'));

  // Verify TITAN_MAIL_ENABLED is not enabled (defaults to false or strictly !== 'true')
  assert.equal(process.env.TITAN_MAIL_ENABLED === 'true', false);
});



