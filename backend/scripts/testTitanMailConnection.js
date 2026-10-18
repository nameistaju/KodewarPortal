import '../src/config/loadEnv.js';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { getTitanMailConfig, sanitizeErrorMessage } from '../src/config/titanMailConfig.js';
import logger from '../src/utils/logger.js';

const TIMEOUT_MS = 15000;

/**
 * Verifies IMAP connectivity, TLS handshake, authentication, and lists folders.
 * Does NOT fetch, download, modify, or mark messages as read.
 * @param {object} config
 * @returns {Promise<{ ok: boolean, folders?: string[], totalMessages?: number, error?: string }>}
 */
export const verifyImapConnection = async (config, customClient = null) => {
  const secrets = [config.imap.password, config.smtp.password].filter(Boolean);
  const client = customClient || new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: {
      user: config.imap.user,
      pass: config.imap.password
    },
    tls: {
      rejectUnauthorized: true, // Strictly enforce TLS certificate verification
      minVersion: 'TLSv1.2'
    },
    logger: false, // Suppress raw socket protocol logging
    clientInfo: {
      name: 'KODEWAR Workforce Portal - Verification Client',
      version: '1.0.0'
    }
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`IMAP connection timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
  );

  try {
    // Race connection with timeout
    await Promise.race([client.connect(), timeoutPromise]);

    // List mailbox folders without opening mailboxes or modifying flags
    const folderList = [];
    const listResult = await client.list();
    if (Array.isArray(listResult)) {
      for (const item of listResult) {
        if (item && item.path) {
          folderList.push(item.path);
        }
      }
    }

    // Safely query mailbox status for INBOX without changing state (EXAMINE or STATUS)
    let inboxMessages = null;
    try {
      const statusRes = await client.status('INBOX', { messages: true, unseen: true });
      if (statusRes && typeof statusRes.messages === 'number') {
        inboxMessages = statusRes.messages;
      }
    } catch {
      // If server does not support STATUS on INBOX, we gracefully report limitation
      inboxMessages = null;
    }

    return {
      ok: true,
      folders: folderList,
      inboxMessages
    };
  } catch (err) {
    return {
      ok: false,
      error: sanitizeErrorMessage(err, secrets)
    };
  } finally {
    // Always cleanly disconnect socket in finally block
    try {
      if (typeof client.logout === 'function') {
        await client.logout();
      } else if (typeof client.close === 'function') {
        await client.close();
      }
    } catch {
      // Ignore disconnect cleanup errors
    }
  }
};

/**
 * Verifies SMTP connectivity, TLS handshake, and credentials using nodemailer.verify().
 * Does NOT send any email message.
 * @param {object} config
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export const verifySmtpConnection = async (config, customTransporter = null) => {
  const secrets = [config.imap.password, config.smtp.password].filter(Boolean);
  const transporter = customTransporter || nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.password
    },
    tls: {
      rejectUnauthorized: true, // Strictly enforce TLS certificate verification
      minVersion: 'TLSv1.2'
    },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS
  });

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: sanitizeErrorMessage(err, secrets)
    };
  } finally {
    try {
      if (typeof transporter.close === 'function') {
        transporter.close();
      }
    } catch {
      // Ignore cleanup error
    }
  }
};

/**
 * Main execution routine for the CLI verification script.
 */
export const runConnectionVerification = async (envObj = process.env, options = {}) => {
  const isImapOnly = Boolean(options.imapOnly || (typeof process !== 'undefined' && process.argv?.includes('--imap-only')));

  console.log('\n============================================================');
  console.log('  KODEWAR HR — TITAN MAILBOX CONNECTION VERIFICATION');
  console.log('  Target Mailbox: hr@kodewar.com');
  if (isImapOnly) {
    console.log('  Mode: READ-ONLY IMAP VERIFICATION (SMTP SKIPPED)');
  }
  console.log('============================================================\n');

  console.log('[1/3] Validating Environment Configuration...');
  const validation = getTitanMailConfig(envObj);

  if (!validation.success) {
    console.error('❌ Configuration validation FAILED:');
    for (const err of validation.errors) {
      console.error(`  - ${err}`);
    }
    console.error('\nPlease verify your .env file contains all required TITAN_* settings.\n');
    return { success: false, exitCode: 1 };
  }

  const { data: config } = validation;
  console.log('  - TITAN_MAIL_ENABLED:', config.enabled ? 'true' : 'false (verification running in on-demand mode)');
  console.log('  - TITAN_MAILBOX_ADDRESS:', config.mailboxAddress);
  console.log(`  - IMAP Host/Port: ${config.imap.host}:${config.imap.port} (TLS: ${config.imap.secure})`);
  if (!isImapOnly) {
    console.log(`  - SMTP Host/Port: ${config.smtp.host}:${config.smtp.port} (TLS: ${config.smtp.secure})`);
  } else {
    console.log('  - SMTP Host/Port: [SKIPPED FOR READ-ONLY STAGE]');
  }
  console.log('  - Passwords: [CONFIGURED - NEVER LOGGED OR EXPOSED]');
  console.log('✔ Configuration format: PASS\n');

  // Verify IMAP
  console.log('[2/3] Verifying IMAP Connectivity & Authentication (Read-only)...');
  const imapResult = await verifyImapConnection(config);

  if (!imapResult.ok) {
    console.error('❌ IMAP Verification: FAIL');
    console.error(`   Reason: ${imapResult.error}\n`);
  } else {
    console.log('✔ IMAP Verification: PASS');
    console.log(`  - Discovered Folders (${imapResult.folders.length}): ${imapResult.folders.join(', ') || 'None reported'}`);
    if (imapResult.inboxMessages !== null) {
      console.log(`  - INBOX Message Count (Non-state-changing query): ${imapResult.inboxMessages}`);
    } else {
      console.log('  - INBOX Message Count: Server does not support non-state-changing STATUS count.');
    }
    console.log('  - Mailbox state altered: NO (Read-only check)\n');
  }

  // Verify SMTP
  let smtpResult = { ok: true, skipped: true };
  if (isImapOnly) {
    console.log('[3/3] SMTP Verification: SKIPPED (--imap-only mode active)\n');
  } else {
    console.log('[3/3] Verifying SMTP Connectivity & Authentication (No email sent)...');
    smtpResult = await verifySmtpConnection(config);

    if (!smtpResult.ok) {
      console.error('❌ SMTP Verification: FAIL');
      console.error(`   Reason: ${smtpResult.error}\n`);
    } else {
      console.log('✔ SMTP Verification: PASS');
      console.log('  - Handshake & AUTH: Verified via nodemailer.verify()');
      console.log('  - Test email sent: NO (Strict zero-dispatch policy)\n');
    }
  }

  // Summary
  console.log('============================================================');
  console.log('  FINAL VERIFICATION SUMMARY');
  console.log('============================================================');
  console.log(`  Configuration Format : PASS`);
  console.log(`  IMAP Connectivity    : ${imapResult.ok ? 'PASS' : 'FAIL'}`);
  console.log(`  SMTP Connectivity    : ${smtpResult.skipped ? 'SKIPPED (Read-Only Mode)' : (smtpResult.ok ? 'PASS' : 'FAIL')}`);

  const allPassed = imapResult.ok && smtpResult.ok;
  if (allPassed) {
    console.log('\n🎉 ALL CHECKS PASSED. Mailbox is reachable and authenticated safely.\n');
    return { success: true, exitCode: 0, imapResult, smtpResult };
  } else {
    console.log('\n⚠️ ONE OR MORE CHECKS FAILED. Please review the sanitized error logs above.\n');
    return { success: false, exitCode: 1, imapResult, smtpResult };
  }
};

// Execute if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('testTitanMailConnection.js')) {
  runConnectionVerification().then(({ exitCode }) => {
    process.exit(exitCode);
  });
}
