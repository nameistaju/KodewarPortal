import test from 'node:test';
import assert from 'node:assert/strict';

const {
  mapParsedEmailToRecord,
  syncHrMailbox,
  acquireSyncLock,
  renewSyncLock,
  releaseSyncLock,
  getStoredEmails,
  getStoredEmailById
} = await import('../src/services/hrMailboxIngestionService.js');

const mockConfigFixture = {
  enabled: true,
  mailboxAddress: 'hr@kodewar.com',
  imap: {
    host: 'imap.secureserver.net',
    port: 993,
    secure: true,
    user: 'hr@kodewar.com',
    password: 'secret_test_password'
  },
  smtp: {
    host: 'smtpout.secureserver.net',
    port: 465,
    secure: true,
    user: 'hr@kodewar.com',
    password: 'secret_test_password'
  }
};

test('mapParsedEmailToRecord: extracts headers, bodies, snippet and metadata only without binary attachments', () => {
  const mockMsg = {
    uid: 42,
    internalDate: new Date('2026-10-14T10:00:00Z')
  };

  const mockParsed = {
    messageId: '<applicant-123@example.com>',
    date: new Date('2026-10-14T09:59:00Z'),
    subject: 'Application for Senior Full-Stack Engineer',
    from: {
      value: [{ address: 'candidate@example.com', name: 'John Doe' }]
    },
    to: {
      value: [{ address: 'hr@kodewar.com', name: 'KODEWAR HR' }]
    },
    cc: {
      value: [{ address: 'lead@kodewar.com', name: 'Tech Lead' }]
    },
    bcc: {
      value: []
    },
    replyTo: {
      value: [{ address: 'candidate.alt@example.com' }]
    },
    text: 'Hello HR Team,\n\nPlease find attached my resume for the Senior Full-Stack Engineer role.\n\nBest regards,\nJohn',
    html: '<p>Hello HR Team,</p><p>Please find attached my resume for the Senior Full-Stack Engineer role.</p>',
    attachments: [
      {
        filename: 'John_Doe_Resume.pdf',
        contentType: 'application/pdf',
        size: 1048576,
        contentId: 'resume-1',
        content: Buffer.from('BINARY_CONTENT_NEVER_SAVED')
      }
    ]
  };

  const record = mapParsedEmailToRecord(mockParsed, mockMsg, 'hr@kodewar.com', 'INBOX', 123456);

  assert.equal(record.mailbox_address, 'hr@kodewar.com');
  assert.equal(record.folder, 'INBOX');
  assert.equal(record.uidvalidity, 123456);
  assert.equal(record.uid, 42);
  assert.equal(record.message_id, '<applicant-123@example.com>');
  assert.equal(record.from_address, 'candidate@example.com');
  assert.equal(record.from_name, 'John Doe');
  assert.equal(record.subject, 'Application for Senior Full-Stack Engineer');
  assert.ok(record.body_text.includes('Please find attached my resume'));
  assert.ok(record.body_html.includes('<p>Hello HR Team,</p>'));
  assert.ok(record.snippet.length > 0 && record.snippet.length <= 300);
  assert.equal(record.has_attachments, true);
  assert.equal(record.attachments.length, 1);
  assert.equal(record.attachments[0].filename, 'John_Doe_Resume.pdf');
  assert.equal(record.attachments[0].contentType, 'application/pdf');
  assert.equal(record.attachments[0].size, 1048576);

  // Critical assertion: verify no binary content buffer is stored in attachments
  assert.equal(record.attachments[0].content, undefined);
  assert.equal(record.is_read, false);
  assert.equal(record.processing_status, 'PENDING');
});

test('syncHrMailbox: Enforces readOnly: true and never invokes mutating IMAP commands', async () => {
  let mailboxLockOptions = null;
  let flagsAdded = false;
  let messagesDeleted = false;
  let messagesMoved = false;

  const mockImapClient = {
    mailbox: {
      uidValidity: 99999,
      uidNext: 10,
      exists: 5
    },
    connect: async () => {},
    getMailboxLock: async (folder, options) => {
      mailboxLockOptions = options;
      return {
        release: () => {}
      };
    },
    fetch: async function* () {
      // Yield no messages for this test
    },
    messageFlagsAdd: async () => { flagsAdded = true; },
    messageDelete: async () => { messagesDeleted = true; },
    messageMove: async () => { messagesMoved = true; },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'mock-token-uuid', error: null };
      if (fn === 'release_hr_mailbox_lock') return { data: true, error: null };
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 99999, last_synced_uid: 0 },
              error: null
            })
          })
        })
      })
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    dryRun: true,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.ok(mailboxLockOptions, 'getMailboxLock should have been called');
  assert.equal(mailboxLockOptions.readOnly, true, 'Mailbox MUST be opened in readOnly: true mode');
  assert.equal(flagsAdded, false, 'messageFlagsAdd must never be invoked');
  assert.equal(messagesDeleted, false, 'messageDelete must never be invoked');
  assert.equal(messagesMoved, false, 'messageMove must never be invoked');
});

test('syncHrMailbox: Respects TITAN_MAIL_ENABLED=false and skips execution safely', async () => {
  const disabledConfig = { ...mockConfigFixture, enabled: false };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    forceEnabled: false,
    config: disabledConfig
  });

  assert.equal(result.status, 'DISABLED');
  assert.equal(result.syncedCount, 0);
});

test('syncHrMailbox: Halts immediately if lock is currently held by another worker', async () => {
  let imapConnected = false;

  const mockImapClient = {
    connect: async () => { imapConnected = true; }
  };

  const mockSupabase = {
    rpc: async (fn) => {
      if (fn === 'acquire_hr_mailbox_lock') {
        // Return null simulating active lock held by another process
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'LOCKED');
  assert.equal(result.syncedCount, 0);
  assert.equal(imapConnected, false, 'IMAP connection must not be attempted if lock cannot be acquired');
});

test('syncHrMailbox: Detects UIDVALIDITY epoch change and resets lastSyncedUid to 0', async () => {
  let releasedWithLastUid = null;
  let releasedWithUidvalidity = null;

  const mockImapClient = {
    mailbox: {
      uidValidity: 20261015, // New epoch on server
      uidNext: 15,
      exists: 10
    },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {},
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-123', error: null };
      if (fn === 'release_hr_mailbox_lock') {
        releasedWithLastUid = params.p_last_synced_uid;
        releasedWithUidvalidity = params.p_uidvalidity;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 100000, last_synced_uid: 500 }, // Old epoch
              error: null
            })
          })
        })
      })
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    dryRun: true,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.uidvalidity, 20261015);
  assert.equal(releasedWithUidvalidity, 20261015);
});

test('syncHrMailbox: Aborts if lock lease expires or is stolen during batch processing', async () => {
  let releaseCalled = false;

  const mockImapClient = {
    mailbox: {
      uidValidity: 500,
      uidNext: 200,
      exists: 100
    },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      // Yield enough messages to trigger batch flush
      for (let i = 1; i <= 60; i++) {
        yield {
          uid: i,
          internalDate: new Date(),
          source: Buffer.from(`From: user${i}@example.com\r\nSubject: Test ${i}\r\n\r\nBody ${i}`)
        };
      }
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-abc', error: null };
      if (fn === 'renew_hr_mailbox_lock') {
        // Return false simulating lock lease expiration or steal
        return { data: false, error: null };
      }
      if (fn === 'release_hr_mailbox_lock') {
        releaseCalled = true;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 500, last_synced_uid: 0 },
              error: null
            })
          })
        })
      }),
      upsert: async () => ({ error: null })
    })
  };

  await assert.rejects(
    async () => {
      await syncHrMailbox({
        folder: 'INBOX',
        batchSize: 50,
        dryRun: false,
        forceEnabled: true,
        config: mockConfigFixture,
        supabaseClient: mockSupabase,
        imapClientFactory: () => mockImapClient
      });
    },
    { message: /Sync lease expired or stolen/ }
  );

  assert.equal(releaseCalled, true, 'Lock should always be released in finally block');
});

test('syncHrMailbox: Handles malformed MIME messages without crashing worker', async () => {
  const upsertedRecords = [];

  const mockImapClient = {
    mailbox: {
      uidValidity: 111,
      uidNext: 5,
      exists: 2
    },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      // Corrupt buffer that will produce a fallback record
      yield {
        uid: 1,
        internalDate: new Date('2026-10-14T12:00:00Z'),
        source: null // null source triggers parse error
      };
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-xyz', error: null };
      if (fn === 'renew_hr_mailbox_lock') return { data: true, error: null };
      if (fn === 'release_hr_mailbox_lock') return { data: true, error: null };
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 111, last_synced_uid: 0 },
              error: null
            })
          })
        })
      }),
      upsert: (records) => {
        upsertedRecords.push(...records);
        return {
          select: async () => ({ data: records.map((r, i) => ({ id: `rec-${i}` })), error: null })
        };
      }
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    dryRun: false,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.syncedCount, 1);
  assert.equal(upsertedRecords.length, 1);
  assert.equal(upsertedRecords[0].processing_status, 'FAILED');
  assert.equal(upsertedRecords[0].subject, '[MALFORMED MIME MESSAGE]');
});

test('syncHrMailbox: Pre-write lock check blocks persistence if lease expires before write', async () => {
  let upsertCalled = false;
  let releaseCalled = false;

  const mockImapClient = {
    mailbox: { uidValidity: 888, uidNext: 10, exists: 5 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      yield {
        uid: 1,
        internalDate: new Date(),
        source: Buffer.from('From: sender@example.com\r\nSubject: Hi\r\n\r\nHello')
      };
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-pre-write', error: null };
      if (fn === 'renew_hr_mailbox_lock') {
        // Pre-write check fails: simulating lease expiration right after fetch
        return { data: false, error: null };
      }
      if (fn === 'release_hr_mailbox_lock') {
        releaseCalled = true;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 888, last_synced_uid: 0 },
              error: null
            })
          })
        })
      }),
      upsert: () => {
        upsertCalled = true;
        return { select: async () => ({ data: [], error: null }) };
      }
    })
  };

  await assert.rejects(
    async () => {
      await syncHrMailbox({
        folder: 'INBOX',
        dryRun: false,
        forceEnabled: true,
        config: mockConfigFixture,
        supabaseClient: mockSupabase,
        imapClientFactory: () => mockImapClient
      });
    },
    { message: /Sync lease expired or stolen before persisting/ }
  );

  assert.equal(upsertCalled, false, 'Upsert must NEVER be called if lock lease is invalid before write');
  assert.equal(releaseCalled, true, 'Lock must be released in finally block');
});

test('syncHrMailbox: Checkpoint is preserved on failed upsert and does not advance', async () => {
  let releasedWithUid = null;

  const mockImapClient = {
    mailbox: { uidValidity: 999, uidNext: 50, exists: 5 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      yield {
        uid: 25,
        internalDate: new Date(),
        source: Buffer.from('From: test@example.com\r\nSubject: Test\r\n\r\nBody')
      };
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-fail-upsert', error: null };
      if (fn === 'renew_hr_mailbox_lock') return { data: true, error: null };
      if (fn === 'release_hr_mailbox_lock') {
        releasedWithUid = params.p_last_synced_uid;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 999, last_synced_uid: 10 },
              error: null
            })
          })
        })
      }),
      upsert: () => ({
        select: async () => ({ data: null, error: { message: 'Database disk full or constraint violation' } })
      })
    })
  };

  await assert.rejects(
    async () => {
      await syncHrMailbox({
        folder: 'INBOX',
        dryRun: false,
        forceEnabled: true,
        config: mockConfigFixture,
        supabaseClient: mockSupabase,
        imapClientFactory: () => mockImapClient
      });
    },
    { message: /Database final upsert failed/ }
  );

  assert.equal(releasedWithUid, 10, 'Checkpoint must remain at previous value (10) and NOT advance to 25 on failure');
});

test('syncHrMailbox: Duplicate messages do not inflate total_messages_synced count', async () => {
  let deltaCommitted = null;

  const mockImapClient = {
    mailbox: { uidValidity: 777, uidNext: 20, exists: 3 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      for (let i = 1; i <= 3; i++) {
        yield {
          uid: i,
          internalDate: new Date(),
          source: Buffer.from(`From: user${i}@example.com\r\nSubject: Hi ${i}\r\n\r\nContent`)
        };
      }
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-dup-check', error: null };
      if (fn === 'renew_hr_mailbox_lock') return { data: true, error: null };
      if (fn === 'release_hr_mailbox_lock') {
        deltaCommitted = params.p_messages_synced_delta;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 777, last_synced_uid: 0, total_messages_synced: 100 },
              error: null
            })
          })
        })
      }),
      upsert: () => ({
        // Simulate ON CONFLICT DO NOTHING: 3 rows processed, but 0 actually inserted (all duplicates)
        select: async () => ({ data: [], error: null })
      })
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    dryRun: false,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.processedCount, 3, '3 messages should be reported as processed');
  assert.equal(result.insertedCount, 0, '0 messages should be reported as newly inserted');
  assert.equal(deltaCommitted, 0, 'Delta committed to database must be 0 to avoid inflating total_messages_synced');
  assert.equal(result.lastSyncedUid, 3, 'Last synced UID still advances to 3 since all 3 are verified');
});

test('getStoredEmails: Calculates pagination and boundaries correctly', async () => {
  let rangePassed = null;

  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            range: (from, to) => {
              rangePassed = { from, to };
              return Promise.resolve({
                data: [{ id: 'email-1', subject: 'Candidate A' }],
                error: null,
                count: 45
              });
            }
          })
        })
      })
    })
  };

  const res = await getStoredEmails({ page: 2, limit: 10, folder: 'INBOX' }, mockSupabase);

  assert.equal(res.emails.length, 1);
  assert.equal(res.pagination.page, 2);
  assert.equal(res.pagination.limit, 10);
  assert.equal(res.pagination.totalCount, 45);
  assert.equal(res.pagination.totalPages, 5);
  assert.deepEqual(rangePassed, { from: 10, to: 19 });
});

test('getStoredEmailById: Returns email when found and throws 404 when absent', async () => {
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: async () => {
            if (val === 'valid-id') {
              return { data: { id: 'valid-id', subject: 'Found Subject', body_text: 'Body content' }, error: null };
            }
            return { data: null, error: null };
          }
        })
      })
    })
  };

  const email = await getStoredEmailById('valid-id', mockSupabase);
  assert.equal(email.id, 'valid-id');
  assert.equal(email.subject, 'Found Subject');

  await assert.rejects(
    async () => {
      await getStoredEmailById('non-existent-id', mockSupabase);
    },
    { statusCode: 404, message: 'Email not found' }
  );
});

test('syncHrMailbox: Non-contiguous UID sequence with gaps advances checkpoint to highest observed UID', async () => {
  let releasedWithLastUid = null;
  const upsertedUids = [];

  const mockImapClient = {
    mailbox: { uidValidity: 2, uidNext: 200, exists: 4 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      // Simulate non-contiguous UIDs with large gaps: 35, 42, 78, 120
      const gappedUids = [35, 42, 78, 120];
      for (const u of gappedUids) {
        yield {
          uid: u,
          internalDate: new Date(),
          source: Buffer.from(`From: user${u}@example.com\r\nSubject: Gap ${u}\r\n\r\nBody`)
        };
      }
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-gap', error: null };
      if (fn === 'renew_hr_mailbox_lock') return { data: true, error: null };
      if (fn === 'release_hr_mailbox_lock') {
        releasedWithLastUid = params.p_last_synced_uid;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 2, last_synced_uid: 30 },
              error: null
            })
          })
        })
      }),
      upsert: (records) => {
        upsertedUids.push(...records.map(r => r.uid));
        return { select: async () => ({ data: records.map(r => ({ id: `rec-${r.uid}` })), error: null }) };
      }
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    dryRun: false,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.deepEqual(upsertedUids, [35, 42, 78, 120]);
  assert.equal(result.lastSyncedUid, 120, 'Checkpoint must advance to the highest observed UID (120)');
  assert.equal(releasedWithLastUid, 120);
});

test('syncHrMailbox [Counter Bug Regression]: Batch smaller than flush threshold commits delta once on release', async () => {
  const deltasRenewed = [];
  let deltaReleased = null;
  let finalLastUid = null;

  const mockImapClient = {
    mailbox: { uidValidity: 2, uidNext: 30, exists: 20 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      for (let i = 1; i <= 20; i++) {
        yield {
          uid: i,
          internalDate: new Date(),
          source: Buffer.from(`From: user${i}@example.com\r\nSubject: Msg ${i}\r\n\r\nBody`)
        };
      }
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-small', error: null };
      if (fn === 'renew_hr_mailbox_lock') {
        if (params.p_messages_synced_delta > 0) deltasRenewed.push(params.p_messages_synced_delta);
        return { data: true, error: null };
      }
      if (fn === 'release_hr_mailbox_lock') {
        deltaReleased = params.p_messages_synced_delta;
        finalLastUid = params.p_last_synced_uid;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 2, last_synced_uid: 0, total_messages_synced: 0 },
              error: null
            })
          })
        })
      }),
      upsert: (records) => ({
        select: async () => ({ data: records.map(r => ({ id: `rec-${r.uid}` })), error: null })
      })
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    batchSize: 50, // Threshold is 50, but we process only 20
    dryRun: false,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.syncedCount, 20);
  assert.equal(deltasRenewed.length, 0, 'No intermediate renew with delta should occur below batch threshold');
  assert.equal(deltaReleased, 20, 'Final release must commit the remaining 20 messages');
  assert.equal(finalLastUid, 20);
});

test('syncHrMailbox [Counter Bug Regression]: Batch exactly at flush threshold does not double-count on release', async () => {
  const deltasRenewed = [];
  let deltaReleased = null;
  let finalLastUid = null;

  const mockImapClient = {
    mailbox: { uidValidity: 2, uidNext: 60, exists: 50 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      for (let i = 1; i <= 50; i++) {
        yield {
          uid: i,
          internalDate: new Date(),
          source: Buffer.from(`From: user${i}@example.com\r\nSubject: Msg ${i}\r\n\r\nBody`)
        };
      }
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-exact', error: null };
      if (fn === 'renew_hr_mailbox_lock') {
        if (params.p_messages_synced_delta > 0) deltasRenewed.push(params.p_messages_synced_delta);
        return { data: true, error: null };
      }
      if (fn === 'release_hr_mailbox_lock') {
        deltaReleased = params.p_messages_synced_delta;
        finalLastUid = params.p_last_synced_uid;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 2, last_synced_uid: 0, total_messages_synced: 0 },
              error: null
            })
          })
        })
      }),
      upsert: (records) => ({
        select: async () => ({ data: records.map(r => ({ id: `rec-${r.uid}` })), error: null })
      })
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    batchSize: 50, // Exactly 50 items with batchSize 50
    dryRun: false,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.syncedCount, 50);
  assert.deepEqual(deltasRenewed, [50], 'Intermediate renew must commit exactly 50 messages');
  assert.equal(deltaReleased, 0, 'Final release delta MUST be 0 to avoid double counting!');
  const totalDeltaCommitted = deltasRenewed.reduce((a, b) => a + b, 0) + deltaReleased;
  assert.equal(totalDeltaCommitted, 50, 'Total delta committed to database must be exactly 50');
  assert.equal(finalLastUid, 50);
});

test('syncHrMailbox [Counter Bug Regression]: Batch spanning multiple flushes commits each item exactly once', async () => {
  const deltasRenewed = [];
  let deltaReleased = null;
  let finalLastUid = null;

  const mockImapClient = {
    mailbox: { uidValidity: 2, uidNext: 75, exists: 65 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      for (let i = 1; i <= 65; i++) {
        yield {
          uid: i,
          internalDate: new Date(),
          source: Buffer.from(`From: user${i}@example.com\r\nSubject: Msg ${i}\r\n\r\nBody`)
        };
      }
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-multi', error: null };
      if (fn === 'renew_hr_mailbox_lock') {
        if (params.p_messages_synced_delta > 0) deltasRenewed.push(params.p_messages_synced_delta);
        return { data: true, error: null };
      }
      if (fn === 'release_hr_mailbox_lock') {
        deltaReleased = params.p_messages_synced_delta;
        finalLastUid = params.p_last_synced_uid;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 2, last_synced_uid: 0, total_messages_synced: 0 },
              error: null
            })
          })
        })
      }),
      upsert: (records) => ({
        select: async () => ({ data: records.map(r => ({ id: `rec-${r.uid}` })), error: null })
      })
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    batchSize: 25, // 65 items with batchSize 25 => 25 + 25 + 15
    dryRun: false,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.syncedCount, 65);
  assert.deepEqual(deltasRenewed, [25, 25], 'Intermediate flushes must commit [25, 25]');
  assert.equal(deltaReleased, 15, 'Final release must commit remaining 15');
  const totalDeltaCommitted = deltasRenewed.reduce((a, b) => a + b, 0) + deltaReleased;
  assert.equal(totalDeltaCommitted, 65, 'Total delta committed to database must be exactly 65');
  assert.equal(finalLastUid, 65);
});

test('syncHrMailbox [Counter Bug Regression]: Failure after intermediate flush preserves committed count and checkpoint without extra delta', async () => {
  const deltasRenewed = [];
  let deltaReleased = null;
  let finalLastUid = null;
  let finalStatusError = null;
  let upsertCount = 0;

  const mockImapClient = {
    mailbox: { uidValidity: 2, uidNext: 50, exists: 40 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      for (let i = 1; i <= 40; i++) {
        yield {
          uid: i,
          internalDate: new Date(),
          source: Buffer.from(`From: user${i}@example.com\r\nSubject: Msg ${i}\r\n\r\nBody`)
        };
      }
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-fail-inter', error: null };
      if (fn === 'renew_hr_mailbox_lock') {
        if (params.p_messages_synced_delta > 0) deltasRenewed.push(params.p_messages_synced_delta);
        return { data: true, error: null };
      }
      if (fn === 'release_hr_mailbox_lock') {
        deltaReleased = params.p_messages_synced_delta;
        finalLastUid = params.p_last_synced_uid;
        finalStatusError = params.p_error_message;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 2, last_synced_uid: 0, total_messages_synced: 0 },
              error: null
            })
          })
        })
      }),
      upsert: (records) => {
        upsertCount++;
        if (upsertCount === 2) {
          // Fail on the second batch
          return { select: async () => ({ data: null, error: new Error('Simulated DB disk failure on batch 2') }) };
        }
        return { select: async () => ({ data: records.map(r => ({ id: `rec-${r.uid}` })), error: null }) };
      }
    })
  };

  await assert.rejects(
    async () => {
      await syncHrMailbox({
        folder: 'INBOX',
        batchSize: 20, // 40 items with batchSize 20: batch 1 succeeds (20 items), batch 2 fails
        dryRun: false,
        forceEnabled: true,
        config: mockConfigFixture,
        supabaseClient: mockSupabase,
        imapClientFactory: () => mockImapClient
      });
    },
    { message: /Database batch upsert failed/ }
  );

  assert.deepEqual(deltasRenewed, [20], 'First batch must have committed 20 items');
  assert.equal(deltaReleased, 0, 'Release delta on failure must be 0, not unpersisted rows');
  assert.equal(finalLastUid, 20, 'Checkpoint must stay at 20 (from first successful batch)');
  assert.ok(finalStatusError.includes('Database batch upsert failed'));
  const totalDeltaCommitted = deltasRenewed.reduce((a, b) => a + b, 0) + deltaReleased;
  assert.equal(totalDeltaCommitted, 20, 'Total delta committed remains exactly 20 from the first batch');
});

test('Stage B3.4: Incremental Sync resumes from UID 198 and requests range 199:*', async () => {
  let requestedRange = null;
  const upsertedUids = [];
  let committedLastUid = null;
  let committedDelta = null;

  const mockImapClient = {
    mailbox: { uidValidity: 2, uidNext: 251, exists: 2136 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* (range) {
      requestedRange = range;
      // Simulate UIDs starting after checkpoint 198: 199, 200, 201, 202, 203
      for (let u = 199; u <= 203; u++) {
        yield {
          uid: u,
          internalDate: new Date(),
          source: Buffer.from(`From: user${u}@example.com\r\nSubject: Candidate ${u}\r\n\r\nApplication`)
        };
      }
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-inc-198', error: null };
      if (fn === 'renew_hr_mailbox_lock') return { data: true, error: null };
      if (fn === 'release_hr_mailbox_lock') {
        committedLastUid = params.p_last_synced_uid;
        committedDelta = params.p_messages_synced_delta;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              // Current verified database state: UIDVALIDITY 2, last_synced_uid 198, total 180
              data: { uidvalidity: 2, last_synced_uid: 198, total_messages_synced: 180 },
              error: null
            })
          })
        })
      }),
      upsert: (records) => {
        upsertedUids.push(...records.map((r) => r.uid));
        return { select: async () => ({ data: records.map((r) => ({ id: `rec-${r.uid}` })), error: null }) };
      }
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    dryRun: false,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(requestedRange, '199:*', 'Incremental range must start at checkpoint + 1');
  assert.deepEqual(upsertedUids, [199, 200, 201, 202, 203]);
  assert.equal(result.syncedCount, 5);
  assert.equal(committedLastUid, 203, 'Checkpoint committed must be the highest UID processed (203)');
  assert.equal(committedDelta, 5);
});

test('Stage B3.4: Dry-run parses new messages without modifying database checkpoints or delta', async () => {
  let releaseCalledParams = null;
  let upsertCalled = false;

  const mockImapClient = {
    mailbox: { uidValidity: 2, uidNext: 251, exists: 2136 },
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* () {
      for (let u = 199; u <= 205; u++) {
        yield {
          uid: u,
          internalDate: new Date(),
          source: Buffer.from(`From: user${u}@example.com\r\nSubject: Test ${u}\r\n\r\nBody`)
        };
      }
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-dry-run', error: null };
      if (fn === 'release_hr_mailbox_lock') {
        releaseCalledParams = params;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 2, last_synced_uid: 198, total_messages_synced: 180 },
              error: null
            })
          })
        })
      }),
      upsert: () => {
        upsertCalled = true;
        return { select: async () => ({ data: [], error: null }) };
      }
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    dryRun: true,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.dryRun, true);
  assert.equal(result.checkpointCommitted, false);
  assert.equal(result.processedCount, 7);
  assert.equal(result.syncedCount, 0, 'Dry-run syncedCount must report 0 saved');
  assert.equal(result.insertedCount, 0, 'Dry-run insertedCount must report 0 inserted');
  assert.equal(result.lastSyncedUid, 205, 'Highest parsed UID is reported for operator visibility');
  assert.equal(upsertCalled, false, 'No database upsert must occur in dry-run mode');
  assert.equal(releaseCalledParams.p_last_synced_uid, null, 'Dry run must pass NULL to release_hr_mailbox_lock for last_synced_uid');
  assert.equal(releaseCalledParams.p_messages_synced_delta, 0, 'Dry run must pass 0 delta to release_hr_mailbox_lock');
});

test('Stage B3.4: UIDVALIDITY Epoch Boundary cleanly separates epochs and resets startUid to 1', async () => {
  let requestedRange = null;
  const upsertedRecords = [];
  let finalReleasedUidvalidity = null;

  const mockImapClient = {
    mailbox: { uidValidity: 3, uidNext: 50, exists: 40 }, // Server changed from 2 to 3
    connect: async () => {},
    getMailboxLock: async () => ({ release: () => {} }),
    fetch: async function* (range) {
      requestedRange = range;
      yield {
        uid: 1,
        internalDate: new Date(),
        source: Buffer.from('From: cand@example.com\r\nSubject: New Epoch\r\n\r\nBody')
      };
    },
    logout: async () => {}
  };

  const mockSupabase = {
    rpc: async (fn, params) => {
      if (fn === 'acquire_hr_mailbox_lock') return { data: 'token-epoch-change', error: null };
      if (fn === 'renew_hr_mailbox_lock') return { data: true, error: null };
      if (fn === 'release_hr_mailbox_lock') {
        finalReleasedUidvalidity = params.p_uidvalidity;
        return { data: true, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { uidvalidity: 2, last_synced_uid: 198, total_messages_synced: 180 },
              error: null
            })
          })
        })
      }),
      upsert: (records) => {
        upsertedRecords.push(...records);
        return { select: async () => ({ data: records.map((r) => ({ id: `rec-${r.uid}` })), error: null }) };
      }
    })
  };

  const result = await syncHrMailbox({
    folder: 'INBOX',
    dryRun: false,
    forceEnabled: true,
    config: mockConfigFixture,
    supabaseClient: mockSupabase,
    imapClientFactory: () => mockImapClient
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(requestedRange, '1:*', 'Epoch change must reset range to 1:*');
  assert.equal(upsertedRecords.length, 1);
  assert.equal(upsertedRecords[0].uidvalidity, 3, 'Upserted record must carry new epoch UIDVALIDITY 3');
  assert.equal(finalReleasedUidvalidity, 3, 'Committed UIDVALIDITY must match new server epoch 3');
});



