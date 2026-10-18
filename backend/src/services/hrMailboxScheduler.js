import cron from 'node-cron';
import { syncHrMailbox } from './hrMailboxIngestionService.js';
import { getTitanMailConfig, sanitizeErrorMessage } from '../config/titanMailConfig.js';
import logger from '../utils/logger.js';

let cronJob = null;
let isJobRunning = false;

const schedulerState = {
  isRunning: false,
  isCronActive: false,
  intervalMinutes: 10,
  cronExpression: '*/10 * * * *',
  lastRunStartedAt: null,
  lastCompletedAt: null,
  lastError: null,
  consecutiveFailures: 0,
  lastSyncResult: null
};

/**
 * Standard sleep helper for backoff delays.
 */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Derives a standard 5-part cron expression from an interval in minutes.
 * @param {number} minutes
 * @returns {string}
 */
export const deriveCronExpression = (minutes) => {
  const m = Math.max(1, Math.min(1440, Math.floor(minutes || 10)));
  if (m === 1) return '* * * * *';
  if (m < 60) return `*/${m} * * * *`;
  const hours = Math.floor(m / 60);
  return `0 */${hours} * * *`;
};

/**
 * Executes a single scheduled synchronization tick with in-process overlap guard,
 * distributed database lease-locking, and bounded retries with exponential backoff.
 * 
 * @param {object} [options]
 * @param {Function} [options.syncFn=syncHrMailbox]
 * @param {Function} [options.sleepFn=defaultSleep]
 * @param {object} [options.configOverride=null]
 * @returns {Promise<object>}
 */
export const executeScheduledSync = async ({
  syncFn = syncHrMailbox,
  sleepFn = defaultSleep,
  configOverride = null,
  supabaseClient = undefined
} = {}) => {
  // 1. Resolve configuration
  let config;
  if (configOverride) {
    config = configOverride;
  } else {
    const configRes = getTitanMailConfig();
    if (!configRes.success) {
      logger.error('HR mailbox scheduled sync aborted: Invalid mail configuration', {
        errors: configRes.errors
      });
      return { skipped: true, reason: 'INVALID_CONFIG', errors: configRes.errors };
    }
    config = configRes.data;
  }

  // 2. Strict disablement check
  const isEnabled = Boolean(config.enabled && config.sync?.enabled);
  if (!isEnabled) {
    logger.info('Scheduled HR mailbox sync skipped: Sync is disabled by configuration (TITAN_MAIL_ENABLED or TITAN_MAIL_SYNC_ENABLED is false)');
    return { skipped: true, reason: 'DISABLED' };
  }

  // 3. In-process overlap protection
  if (isJobRunning) {
    logger.warn('Scheduled HR mailbox sync skipped: Previous sync iteration is still running in this process');
    return { skipped: true, reason: 'OVERLAP' };
  }

  isJobRunning = true;
  schedulerState.isRunning = true;
  schedulerState.lastRunStartedAt = new Date().toISOString();

  const maxRetries = config.sync?.maxRetries ?? 3;
  const baseRetryDelay = config.sync?.retryDelayMs ?? 1000;
  const batchLimit = config.sync?.batchLimit ?? 50;
  const secrets = [config.imap?.password, config.smtp?.password].filter(Boolean);

  let attempt = 0;
  let lastErr = null;

  try {
    while (attempt <= maxRetries) {
      try {
        logger.info('Executing scheduled HR mailbox sync tick', {
          mailboxAddress: config.mailboxAddress,
          attempt: attempt + 1,
          maxAttempts: maxRetries + 1,
          batchLimit
        });

        const syncOptions = {
          folder: 'INBOX',
          maxMessages: batchLimit,
          dryRun: false,
          forceEnabled: false, // Strict: relies on config.enabled === true as secondary defense
          config
        };

        if (supabaseClient) {
          syncOptions.supabaseClient = supabaseClient;
        }

        const result = await syncFn(syncOptions);

        if (result.status === 'LOCKED') {
          logger.info('HR mailbox sync lock held by another process or worker. Scheduled tick deferred cleanly.', {
            mailboxAddress: config.mailboxAddress
          });
          return { skipped: true, reason: 'LOCKED', message: result.message };
        }

        if (result.status === 'DISABLED') {
          return { skipped: true, reason: 'DISABLED' };
        }

        // Success: update scheduler telemetry
        schedulerState.lastCompletedAt = new Date().toISOString();
        schedulerState.lastError = null;
        schedulerState.consecutiveFailures = 0;
        schedulerState.lastSyncResult = {
          status: result.status,
          syncedCount: result.syncedCount,
          insertedCount: result.insertedCount,
          lastSyncedUid: result.lastSyncedUid,
          uidvalidity: result.uidvalidity
        };

        logger.info('Scheduled HR mailbox sync iteration completed successfully', {
          mailboxAddress: config.mailboxAddress,
          syncedCount: result.syncedCount,
          lastSyncedUid: result.lastSyncedUid
        });

        return {
          status: 'SUCCESS',
          attempts: attempt + 1,
          result
        };

      } catch (err) {
        lastErr = err;
        attempt += 1;
        const sanitized = sanitizeErrorMessage(err, secrets);

        if (attempt <= maxRetries) {
          const delay = baseRetryDelay * Math.pow(2, attempt - 1);
          logger.warn('Scheduled HR mailbox sync attempt failed, retrying with exponential backoff', {
            attempt,
            maxRetries,
            nextDelayMs: delay,
            error: sanitized
          });
          await sleepFn(delay);
        } else {
          logger.error('Scheduled HR mailbox sync exhausted all retry attempts', {
            attemptsExhausted: attempt,
            error: sanitized
          });
        }
      }
    }

    // If loop finishes without returning, all attempts failed
    const finalSanitized = sanitizeErrorMessage(lastErr, secrets);
    schedulerState.lastError = finalSanitized;
    schedulerState.consecutiveFailures += 1;

    return {
      status: 'FAILED',
      attempts: attempt,
      error: finalSanitized
    };

  } finally {
    isJobRunning = false;
    schedulerState.isRunning = false;
  }
};

/**
 * Initializes and starts the background mailbox sync cron scheduler.
 * @param {object} [options]
 * @param {object} [options.cronModule=cron]
 * @param {Function} [options.syncFn=syncHrMailbox]
 * @returns {boolean} Whether scheduler was started
 */
export const startMailboxSyncScheduler = ({
  cronModule = cron,
  syncFn = syncHrMailbox
} = {}) => {
  const configRes = getTitanMailConfig();
  if (!configRes.success) {
    logger.warn('HR mailbox scheduler cannot start: Invalid Titan configuration', {
      errors: configRes.errors
    });
    return false;
  }

  const config = configRes.data;
  const isEnabled = Boolean(config.enabled && config.sync?.enabled);

  if (!isEnabled) {
    logger.info('HR mailbox sync scheduler is disabled by configuration (TITAN_MAIL_ENABLED or TITAN_MAIL_SYNC_ENABLED is false). Skipping registration.');
    return false;
  }

  if (cronJob) {
    logger.warn('HR mailbox sync scheduler is already active');
    return true;
  }

  const intervalMinutes = config.sync?.intervalMinutes || 10;
  const cronExpression = deriveCronExpression(intervalMinutes);

  schedulerState.intervalMinutes = intervalMinutes;
  schedulerState.cronExpression = cronExpression;
  schedulerState.isCronActive = true;

  logger.info('Registering automated HR mailbox synchronization cron scheduler', {
    mailboxAddress: config.mailboxAddress,
    intervalMinutes,
    cronExpression,
    batchLimit: config.sync?.batchLimit || 50
  });

  cronJob = cronModule.schedule(cronExpression, async () => {
    try {
      await executeScheduledSync({ syncFn });
    } catch (unexpectedError) {
      logger.error('Unexpected error in HR mailbox scheduler tick wrapper', {
        error: sanitizeErrorMessage(unexpectedError)
      });
    }
  });

  return true;
};

/**
 * Stops and unregisters the mailbox sync cron scheduler.
 * Optionally waits for any in-progress sync iteration to complete cleanly.
 * @param {number} [timeoutMs=5000]
 */
export const stopMailboxSyncScheduler = async (timeoutMs = 5000) => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    schedulerState.isCronActive = false;
    logger.info('Stopped HR mailbox sync scheduler');
  }

  if (isJobRunning) {
    logger.info('Waiting for active HR mailbox sync to complete cleanly before shutdown...', { timeoutMs });
    const start = Date.now();
    while (isJobRunning && (Date.now() - start < timeoutMs)) {
      await defaultSleep(200);
    }
    if (isJobRunning) {
      logger.warn('Active HR mailbox sync did not finish within shutdown timeout. Proceeding with shutdown.');
    } else {
      logger.info('Active HR mailbox sync finished cleanly before shutdown.');
    }
  }
};

/**
 * Retrieves safe scheduler telemetry for administrators.
 * Guarantees zero credential exposure.
 */
export const getSchedulerStatus = () => {
  return {
    isCronActive: schedulerState.isCronActive,
    isJobRunning,
    intervalMinutes: schedulerState.intervalMinutes,
    cronExpression: schedulerState.cronExpression,
    lastRunStartedAt: schedulerState.lastRunStartedAt,
    lastCompletedAt: schedulerState.lastCompletedAt,
    lastError: schedulerState.lastError,
    consecutiveFailures: schedulerState.consecutiveFailures,
    lastSyncResult: schedulerState.lastSyncResult
  };
};

/**
 * Reset scheduler state (intended for test teardown).
 */
export const _resetSchedulerStateForTest = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  isJobRunning = false;
  schedulerState.isRunning = false;
  schedulerState.isCronActive = false;
  schedulerState.lastRunStartedAt = null;
  schedulerState.lastCompletedAt = null;
  schedulerState.lastError = null;
  schedulerState.consecutiveFailures = 0;
  schedulerState.lastSyncResult = null;
};
