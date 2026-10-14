import test from 'node:test';
import assert from 'node:assert/strict';

const { getTitanMailConfig, sanitizeErrorMessage, titanMailConfigSchema } = await import('../src/config/titanMailConfig.js');
const { verifyImapConnection, verifySmtpConnection, runConnectionVerification } = await import('../scripts/testTitanMailConnection.js');

test('titanMailConfig: Fails when required configuration variables are missing', () => {
  const emptyEnv = {};
  const res = getTitanMailConfig(emptyEnv);
  assert.equal(res.success, false);
  assert.ok(res.errors.length > 0);
  assert.ok(res.errors.some((e) => e.includes('imap.host')));
  assert.ok(res.errors.some((e) => e.includes('smtp.host')));
});

test('titanMailConfig: Validates invalid ports and non-boolean flags safely', () => {
  const invalidEnv = {
    TITAN_MAIL_ENABLED: 'invalid_bool',
    TITAN_MAILBOX_ADDRESS: 'not-an-email',
    TITAN_IMAP_HOST: 'imap.titan.email',
    TITAN_IMAP_PORT: '99999', // Out of port range
    TITAN_IMAP_USER: 'hr@kodewar.com',
    TITAN_IMAP_PASSWORD: 'secretpassword123',
    TITAN_SMTP_HOST: 'smtp.titan.email',
    TITAN_SMTP_PORT: '-5', // Negative port
    TITAN_SMTP_USER: 'hr@kodewar.com',
    TITAN_SMTP_PASSWORD: 'secretsmtppassword'
  };

  const res = getTitanMailConfig(invalidEnv);
  assert.equal(res.success, false);
  assert.ok(res.errors.some((e) => e.includes('mailboxAddress')));
  assert.ok(res.errors.some((e) => e.includes('imap.port')));
  assert.ok(res.errors.some((e) => e.includes('smtp.port')));
});

test('titanMailConfig: Successfully parses valid configuration', () => {
  const validEnv = {
    TITAN_MAIL_ENABLED: 'true',
    TITAN_MAILBOX_ADDRESS: 'hr@kodewar.com',
    TITAN_IMAP_HOST: 'imap.titan.email',
    TITAN_IMAP_PORT: '993',
    TITAN_IMAP_SECURE: 'true',
    TITAN_IMAP_USER: 'hr@kodewar.com',
    TITAN_IMAP_PASSWORD: 'SuperSecretPassword123!',
    TITAN_SMTP_HOST: 'smtp.titan.email',
    TITAN_SMTP_PORT: '465',
    TITAN_SMTP_SECURE: 'true',
    TITAN_SMTP_USER: 'hr@kodewar.com',
    TITAN_SMTP_PASSWORD: 'SuperSecretPassword123!'
  };

  const res = getTitanMailConfig(validEnv);
  assert.equal(res.success, true);
  assert.equal(res.data.enabled, true);
  assert.equal(res.data.imap.port, 993);
  assert.equal(res.data.smtp.port, 465);
  assert.equal(res.data.imap.secure, true);
});

test('sanitizeErrorMessage: Completely redacts passwords and secrets from error strings', () => {
  const secretPassword = 'MySecretMailboxPassword999';
  const rawError = new Error(`Connection to imap.titan.email failed with credentials user=hr@kodewar.com pass=${secretPassword}`);

  const cleaned = sanitizeErrorMessage(rawError, [secretPassword]);
  assert.ok(!cleaned.includes(secretPassword), 'Secret password must not be present in sanitized output');
  assert.ok(cleaned.includes('[REDACTED]'), 'Secret should be replaced with [REDACTED]');
});

test('sanitizeErrorMessage: Redacts generic PASS and auth command patterns', () => {
  const line = 'IMAP socket write failed at command: PASS TopSecret1234!';
  const cleaned = sanitizeErrorMessage(line);
  assert.ok(!cleaned.includes('TopSecret1234!'));
  assert.ok(cleaned.includes('PASS [REDACTED]'));
});

test('verifyImapConnection: Handles connection failure with sanitized error and clean closure', async () => {
  let closeCalled = false;
  let logoutCalled = false;

  const mockClient = {
    connect: async () => {
      throw new Error('Connection refused at imap.titan.email:993 with secret=SensitivePass123');
    },
    logout: async () => {
      logoutCalled = true;
    },
    close: async () => {
      closeCalled = true;
    }
  };

  const mockConfig = {
    imap: { host: 'imap.titan.email', port: 993, secure: true, user: 'hr@kodewar.com', password: 'SensitivePass123' },
    smtp: { host: 'smtp.titan.email', port: 465, secure: true, user: 'hr@kodewar.com', password: 'SensitivePass123' }
  };

  const result = await verifyImapConnection(mockConfig, mockClient);
  assert.equal(result.ok, false);
  assert.ok(!result.error.includes('SensitivePass123'), 'Sensitive password must be redacted on error');
  assert.ok(logoutCalled || closeCalled, 'Client cleanup/logout must be called in finally block');
});

test('verifyImapConnection: Queries folders and status in read-only mode without fetching bodies', async () => {
  let fetchCalled = false;
  let logoutCalled = false;

  const mockClient = {
    connect: async () => true,
    list: async () => [
      { path: 'INBOX' },
      { path: 'Sent' },
      { path: 'Trash' },
      { path: 'Archive' }
    ],
    status: async (mailbox, options) => {
      assert.equal(mailbox, 'INBOX');
      assert.equal(options.messages, true);
      return { messages: 42, unseen: 3 };
    },
    fetch: () => {
      fetchCalled = true;
      throw new Error('fetch should not be called in verification mode');
    },
    logout: async () => {
      logoutCalled = true;
    }
  };

  const mockConfig = {
    imap: { host: 'imap.titan.email', port: 993, secure: true, user: 'hr@kodewar.com', password: 'pass' },
    smtp: { host: 'smtp.titan.email', port: 465, secure: true, user: 'hr@kodewar.com', password: 'pass' }
  };

  const result = await verifyImapConnection(mockConfig, mockClient);
  assert.equal(result.ok, true);
  assert.equal(result.folders.length, 4);
  assert.deepEqual(result.folders, ['INBOX', 'Sent', 'Trash', 'Archive']);
  assert.equal(result.inboxMessages, 42);
  assert.equal(fetchCalled, false, 'No message body fetching must occur');
  assert.equal(logoutCalled, true, 'Clean logout must be called');
});

test('verifySmtpConnection: Verifies SMTP credentials without sending emails', async () => {
  let sendMailCalled = false;
  let verifyCalled = false;
  let closeCalled = false;

  const mockTransporter = {
    verify: async () => {
      verifyCalled = true;
      return true;
    },
    sendMail: async () => {
      sendMailCalled = true;
      throw new Error('sendMail must NEVER be called');
    },
    close: () => {
      closeCalled = true;
    }
  };

  const mockConfig = {
    imap: { host: 'imap.titan.email', port: 993, secure: true, user: 'hr@kodewar.com', password: 'pass' },
    smtp: { host: 'smtp.titan.email', port: 465, secure: true, user: 'hr@kodewar.com', password: 'pass' }
  };

  const result = await verifySmtpConnection(mockConfig, mockTransporter);
  assert.equal(result.ok, true);
  assert.equal(verifyCalled, true);
  assert.equal(sendMailCalled, false, 'sendMail must never be called during connection check');
  assert.equal(closeCalled, true);
});

test('runConnectionVerification: Exits with code 1 if configuration is missing', async () => {
  const result = await runConnectionVerification({});
  assert.equal(result.success, false);
  assert.equal(result.exitCode, 1);
});
