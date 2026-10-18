import { z } from 'zod';

const boolPreprocess = (val) => {
  if (val === 'true' || val === true) return true;
  if (val === 'false' || val === false) return false;
  return val;
};

const portPreprocess = (val, defaultPort) => {
  if (val === undefined || val === null || val === '') return defaultPort;
  const num = Number(val);
  return Number.isNaN(num) ? val : num;
};

export const titanMailConfigSchema = z.object({
  enabled: z.preprocess(boolPreprocess, z.boolean().default(false)),
  mailboxAddress: z.string().trim().email('TITAN_MAILBOX_ADDRESS must be a valid email'),
  imap: z.object({
    host: z.string().trim().min(1, 'TITAN_IMAP_HOST is required'),
    port: z.preprocess((v) => portPreprocess(v, 993), z.number().int().min(1).max(65535, 'TITAN_IMAP_PORT must be between 1 and 65535')),
    secure: z.preprocess(boolPreprocess, z.boolean().default(true)),
    user: z.string().trim().min(1, 'TITAN_IMAP_USER is required'),
    password: z.string().min(1, 'TITAN_IMAP_PASSWORD is required')
  }),
  smtp: z.object({
    host: z.string().trim().min(1, 'TITAN_SMTP_HOST is required'),
    port: z.preprocess((v) => portPreprocess(v, 465), z.number().int().min(1).max(65535, 'TITAN_SMTP_PORT must be between 1 and 65535')),
    secure: z.preprocess(boolPreprocess, z.boolean().default(true)),
    user: z.string().trim().min(1, 'TITAN_SMTP_USER is required'),
    password: z.string().min(1, 'TITAN_SMTP_PASSWORD is required')
  }),
  sync: z.object({
    enabled: z.preprocess(boolPreprocess, z.boolean().default(false)),
    intervalMinutes: z.preprocess((v) => (v === undefined || v === null || v === '' ? 10 : Number(v)), z.number().int().min(1).max(1440).default(10)),
    batchLimit: z.preprocess((v) => (v === undefined || v === null || v === '' ? 50 : Number(v)), z.number().int().min(1).max(500).default(50)),
    maxRetries: z.preprocess((v) => (v === undefined || v === null || v === '' ? 3 : Number(v)), z.number().int().min(0).max(10).default(3)),
    retryDelayMs: z.preprocess((v) => (v === undefined || v === null || v === '' ? 1000 : Number(v)), z.number().int().min(100).max(60000).default(1000))
  }).default({})
});

/**
 * Parses and validates environment variables for Titan Mailbox.
 * @param {NodeJS.ProcessEnv} envObj
 * @returns {{ success: boolean, data?: z.infer<typeof titanMailConfigSchema>, errors?: string[] }}
 */
export const getTitanMailConfig = (envObj = process.env) => {
  const raw = {
    enabled: envObj.TITAN_MAIL_ENABLED ?? false,
    mailboxAddress: envObj.TITAN_MAILBOX_ADDRESS || 'hr@kodewar.com',
    imap: {
      host: envObj.TITAN_IMAP_HOST || '',
      port: envObj.TITAN_IMAP_PORT,
      secure: envObj.TITAN_IMAP_SECURE ?? true,
      user: envObj.TITAN_IMAP_USER || '',
      password: envObj.TITAN_IMAP_PASSWORD || ''
    },
    smtp: {
      host: envObj.TITAN_SMTP_HOST || '',
      port: envObj.TITAN_SMTP_PORT,
      secure: envObj.TITAN_SMTP_SECURE ?? true,
      user: envObj.TITAN_SMTP_USER || '',
      password: envObj.TITAN_SMTP_PASSWORD || ''
    },
    sync: {
      enabled: envObj.TITAN_MAIL_SYNC_ENABLED ?? false,
      intervalMinutes: envObj.TITAN_MAIL_SYNC_INTERVAL_MINUTES,
      batchLimit: envObj.TITAN_MAIL_SYNC_BATCH_LIMIT,
      maxRetries: envObj.TITAN_MAIL_SYNC_MAX_RETRIES,
      retryDelayMs: envObj.TITAN_MAIL_SYNC_RETRY_DELAY_MS
    }
  };

  const parsed = titanMailConfigSchema.safeParse(raw);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const fieldPath = issue.path.join('.');
      return `${fieldPath}: ${issue.message}`;
    });
    return { success: false, errors };
  }

  return { success: true, data: parsed.data };
};

/**
 * Sanitizes errors or string messages to ensure passwords and sensitive credentials are never exposed.
 * @param {any} err - Error object, string, or arbitrary value
 * @param {string[]} secretsToRedact - Array of secret strings to scrub
 * @returns {string}
 */
export const sanitizeErrorMessage = (err, secretsToRedact = []) => {
  if (!err) return 'Unknown error';
  let message = typeof err === 'string' ? err : err.message || err.toString();

  // Strip ANSI color codes if present
  message = message.replace(/\u001b\[[0-9;]*m/g, '');

  for (const secret of secretsToRedact) {
    if (secret && typeof secret === 'string' && secret.trim().length > 0) {
      // Escape regex special chars in secret
      const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      message = message.replace(new RegExp(escaped, 'g'), '[REDACTED]');
    }
  }

  // Redact potential password tokens in URI or auth lines like (PASS ... or AUTH LOGIN ...)
  message = message.replace(/password[:=]\s*[^\s,]+/gi, 'password=[REDACTED]');
  message = message.replace(/auth\s+[a-zA-Z0-9+/=]+/gi, 'auth [REDACTED]');
  message = message.replace(/PASS\s+[^\r\n]+/gi, 'PASS [REDACTED]');

  return message;
};
