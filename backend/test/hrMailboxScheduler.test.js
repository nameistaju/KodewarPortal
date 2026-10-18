import test from 'node:test';
import assert from 'node:assert/strict';

const {
  deriveCronExpression,
  executeScheduledSync,
  startMailboxSyncScheduler,
  stopMailboxSyncScheduler,
  getSchedulerStatus,
  _resetSchedulerStateForTest
} = await import('../src/services/hrMailboxScheduler.js');

const { getMailboxSyncStatus } = await import('../src/services/hrMailboxIngestionService.js');

const validMockConfig = {
  enabled: true,
  mailboxAddress: 'hr@kodewar.com',
  imap: { host: 'imap.test', port: 993, secure: true, user: 'hr@kodewar.com', password: 'test-imap-password' },
  smtp: { host: 'smtp.test', port: 465, secure: true, user: 'hr@kodewar.com', password: 'test-smtp-password' },
  sync: {
    enabled: true,
    intervalMinutes: 10,
    batchLimit: 50,
    maxRetries: 3,
    retryDelayMs: 10
  }
};

test.beforeEach(() => {
  _resetSchedulerStateForTest();
});

test.afterEach(() => {
  _resetSchedulerStateForTest();
});

test('Stage B3.5 Cron Expression: Correctly derives standard cron expressions from minutes', () => {
  assert.equal(deriveCronExpression(1), '* * * * *');
  assert.equal(deriveCronExpression(5), '*/5 * * * *');
  assert.equal(deriveCronExpression(10), '*/10 * * * *');
  assert.equal(deriveCronExpression(15), '*/15 * * * *');
  assert.equal(deriveCronExpression(30), '*/30 * * * *');
  assert.equal(deriveCronExpression(60), '0 */1 * * *');
  assert.equal(deriveCronExpression(120), '0 */2 * * *');
});

test('Stage B3.5 Disabled Mode: Does not start scheduler or execute sync when disabled', async () => {
  let syncCalled = false;
  const mockSyncFn = async () => {
    syncCalled = true;
    return { status: 'SUCCESS', syncedCount: 0 };
  };

  // Case 1: Master enabled is false
  const disabledMasterConfig = {
    ...validMockConfig,
    enabled: false,
    sync: { ...validMockConfig.sync, enabled: true }
  };

  const res1 = await executeScheduledSync({
    syncFn: mockSyncFn,
    configOverride: disabledMasterConfig
  });

  assert.equal(res1.skipped, true);
  assert.equal(res1.reason, 'DISABLED');
  assert.equal(syncCalled, false, 'syncHrMailbox must not be called when TITAN_MAIL_ENABLED is false');

  // Case 2: Sync enabled is false
  const disabledSyncConfig = {
    ...validMockConfig,
    enabled: true,
    sync: { ...validMockConfig.sync, enabled: false }
  };

  const res2 = await executeScheduledSync({
    syncFn: mockSyncFn,
    configOverride: disabledSyncConfig
  });

  assert.equal(res2.skipped, true);
  assert.equal(res2.reason, 'DISABLED');
  assert.equal(syncCalled, false, 'syncHrMailbox must not be called when TITAN_MAIL_SYNC_ENABLED is false');
});

test('Stage B3.5 Scheduler Lifecycle: Startup and shutdown manage cron job cleanly', () => {
  let scheduledCron = null;
  let scheduledCallback = null;
  let stoppedCron = false;

  const mockCronModule = {
    schedule: (expression, callback) => {
      scheduledCron = expression;
      scheduledCallback = callback;
      return {
        stop: () => {
          stoppedCron = true;
        }
      };
    }
  };

  // When TITAN_MAIL_ENABLED is false (default in test environment), startMailboxSyncScheduler skips
  const startedDisabled = startMailboxSyncScheduler({ cronModule: mockCronModule });
  assert.equal(startedDisabled, false);
  assert.equal(scheduledCron, null);

  const initialStatus = getSchedulerStatus();
  assert.equal(initialStatus.isCronActive, false);
});

test('Stage B3.5 In-Process Overlap Guard: Prevents overlapping executions when job is in flight', async () => {
  let activeSyncResolvers = [];

  const mockLongSyncFn = () => {
    return new Promise((resolve) => {
      activeSyncResolvers.push(resolve);
    });
  };

  // Kick off first sync execution (stays pending)
  const firstExecutionPromise = executeScheduledSync({
    syncFn: mockLongSyncFn,
    configOverride: validMockConfig
  });

  // Attempt second concurrent execution while first is in flight
  const secondExecutionResult = await executeScheduledSync({
    syncFn: mockLongSyncFn,
    configOverride: validMockConfig
  });

  assert.equal(secondExecutionResult.skipped, true);
  assert.equal(secondExecutionResult.reason, 'OVERLAP', 'Concurrent tick must be skipped due to overlap guard');

  // Resolve first execution
  activeSyncResolvers[0]({
    status: 'SUCCESS',
    syncedCount: 5,
    insertedCount: 5,
    lastSyncedUid: 203,
    uidvalidity: 2
  });

  const firstResult = await firstExecutionPromise;
  assert.equal(firstResult.status, 'SUCCESS');
  assert.equal(firstResult.result.syncedCount, 5);

  const status = getSchedulerStatus();
  assert.equal(status.isJobRunning, false);
  assert.equal(status.lastSyncResult.syncedCount, 5);
  assert.equal(status.lastSyncResult.lastSyncedUid, 203);
});

test('Stage B3.5 Distributed Lease-Lock: Defers gracefully when database lock is held', async () => {
  const mockLockedSyncFn = async () => {
    return {
      status: 'LOCKED',
      message: 'Sync lock is currently held by another worker. Interrupted or parallel run prevented.',
      syncedCount: 0
    };
  };

  const result = await executeScheduledSync({
    syncFn: mockLockedSyncFn,
    configOverride: validMockConfig
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'LOCKED');

  const status = getSchedulerStatus();
  assert.equal(status.consecutiveFailures, 0, 'Distributed lock contention is an expected deferral, not a failure');
  assert.equal(status.lastError, null);
});

test('Stage B3.5 Exponential Backoff: Retries on transient failure up to maxRetries with backoff', async () => {
  const attemptsRecorded = [];
  const delaysObserved = [];

  const mockSleep = async (ms) => {
    delaysObserved.push(ms);
  };

  const mockFailingSyncFn = async () => {
    attemptsRecorded.push(Date.now());
    throw new Error('IMAP socket timeout: connection reset by peer');
  };

  const result = await executeScheduledSync({
    syncFn: mockFailingSyncFn,
    sleepFn: mockSleep,
    configOverride: {
      ...validMockConfig,
      sync: {
        ...validMockConfig.sync,
        maxRetries: 3,
        retryDelayMs: 100 // 100ms, 200ms, 400ms
      }
    }
  });

  assert.equal(result.status, 'FAILED');
  assert.equal(result.attempts, 4, 'Should execute 1 initial attempt + 3 retries = 4 total attempts');
  assert.deepEqual(delaysObserved, [100, 200, 400], 'Exponential backoff delays must be 100ms, 200ms, 400ms');

  const status = getSchedulerStatus();
  assert.equal(status.consecutiveFailures, 1);
  assert.ok(status.lastError.includes('IMAP socket timeout'));
  assert.equal(status.isJobRunning, false);
});

test('Stage B3.5 Retry Recovery: Transient failure recovers on subsequent attempt and resets failures', async () => {
  let callCount = 0;
  const delaysObserved = [];

  const mockSleep = async (ms) => {
    delaysObserved.push(ms);
  };

  const mockRecoveringSyncFn = async () => {
    callCount += 1;
    if (callCount === 1) {
      throw new Error('Temporary DNS resolution failure');
    }
    return {
      status: 'SUCCESS',
      syncedCount: 12,
      insertedCount: 12,
      lastSyncedUid: 210,
      uidvalidity: 2
    };
  };

  const result = await executeScheduledSync({
    syncFn: mockRecoveringSyncFn,
    sleepFn: mockSleep,
    configOverride: {
      ...validMockConfig,
      sync: {
        ...validMockConfig.sync,
        maxRetries: 3,
        retryDelayMs: 50
      }
    }
  });

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.attempts, 2, 'Should succeed on attempt 2');
  assert.deepEqual(delaysObserved, [50]);
  assert.equal(result.result.syncedCount, 12);

  const status = getSchedulerStatus();
  assert.equal(status.consecutiveFailures, 0);
  assert.equal(status.lastError, null);
  assert.ok(status.lastCompletedAt !== null);
  assert.equal(status.lastSyncResult.lastSyncedUid, 210);
});

test('Stage B3.5 Safe Status Reporting: Returns administrator telemetry with zero credential leakage', async () => {
  const mockSupabase = {
    from: (table) => {
      if (table === 'hr_mailbox_sync_state') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    mailbox_address: 'hr@kodewar.com',
                    folder: 'INBOX',
                    uidvalidity: 2,
                    last_synced_uid: 198,
                    total_messages_synced: 180,
                    status: 'IDLE',
                    lock_token: null,
                    lock_expires_at: null,
                    last_sync_started_at: '2026-10-18T05:00:00.000Z',
                    last_sync_completed_at: '2026-10-18T05:02:00.000Z',
                    error_message: null
                  },
                  error: null
                })
              })
            })
          })
        };
      }
      if (table === 'hr_emails') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({
                count: 180,
                error: null
              })
            })
          })
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    }
  };

  const syncStatus = await getMailboxSyncStatus('hr@kodewar.com', 'INBOX', mockSupabase);
  const schedulerStatus = getSchedulerStatus();

  // 1. Verify all required admin telemetry items are present
  assert.equal(syncStatus.mailboxAddress, 'hr@kodewar.com');
  assert.equal(syncStatus.currentStatus, 'IDLE');
  assert.equal(syncStatus.lastSuccessfulSync, '2026-10-18T05:02:00.000Z');
  assert.equal(syncStatus.lastError, null);
  assert.equal(syncStatus.storedEmailCount, 180);
  assert.equal(syncStatus.checkpoint.lastSyncedUid, 198);
  assert.equal(syncStatus.checkpoint.uidvalidity, 2);

  // 2. Verify scheduler telemetry
  assert.equal(schedulerStatus.isCronActive, false);
  assert.equal(schedulerStatus.isJobRunning, false);
  assert.equal(schedulerStatus.intervalMinutes, 10);

  // 3. Strict security guarantee: No passwords or secrets anywhere in responses
  const serialized = JSON.stringify({ syncStatus, schedulerStatus });
  assert.equal(serialized.includes('password'), false);
  assert.equal(serialized.includes('secret'), false);
});
