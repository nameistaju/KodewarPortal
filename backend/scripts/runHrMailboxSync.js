#!/usr/bin/env node

/**
 * Controlled manual runner for KODEWAR HR Mailbox Synchronization.
 * Usage:
 *   node scripts/runHrMailboxSync.js [options]
 *
 * Options:
 *   --dry-run       Fetch and parse messages without saving to Supabase (DEFAULT)
 *   --execute       Perform actual database insertion and checkpoint updates
 *   --limit <N>     Maximum number of messages to process (default: 50)
 *   --folder <name> IMAP folder to sync (default: INBOX)
 *   --force         Bypass TITAN_MAIL_ENABLED=false check for testing
 */

import '../src/config/loadEnv.js';
import { syncHrMailbox, getMailboxSyncStatus } from '../src/services/hrMailboxIngestionService.js';
import { getTitanMailConfig, sanitizeErrorMessage } from '../src/config/titanMailConfig.js';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    dryRun: true,
    limit: 50,
    folder: 'INBOX',
    force: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--execute') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10) || 50;
    } else if (arg === '--folder' && args[i + 1]) {
      options.folder = args[++i];
    }
  }

  return options;
};

const main = async () => {
  const options = parseArgs();

  console.log('='.repeat(60));
  console.log('  KODEWAR HR — TITAN MAILBOX INGESTION RUNNER');
  console.log('='.repeat(60));
  console.log(`Mode:    ${options.dryRun ? 'DRY-RUN (Read-only parse, no database writes)' : 'LIVE EXECUTION (Database commits enabled)'}`);
  console.log(`Folder:  ${options.folder}`);
  console.log(`Limit:   ${options.limit} messages`);
  console.log(`Force:   ${options.force ? 'YES' : 'NO'}`);
  console.log('-'.repeat(60));

  const configRes = getTitanMailConfig();
  if (!configRes.success) {
    console.error('❌ Configuration validation failed:');
    configRes.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  const config = configRes.data;
  console.log(`Target Mailbox: ${config.mailboxAddress}`);
  console.log(`Mail Enabled:   ${config.enabled}`);

  try {
    console.log('\n[1/2] Checking current database sync status...');
    const status = await getMailboxSyncStatus(config.mailboxAddress, options.folder);
    if (status.syncState) {
      console.log(`  - Last Synced UID:       ${status.syncState.last_synced_uid}`);
      console.log(`  - Total Messages Synced: ${status.syncState.total_messages_synced}`);
      console.log(`  - Current Status:        ${status.syncState.status}`);
      console.log(`  - Last Sync Completed:   ${status.syncState.last_sync_completed_at || 'Never'}`);
    } else {
      console.log('  - No prior sync state found (Initial sync).');
    }

    console.log('\n[2/2] Initiating mailbox synchronization...');
    const result = await syncHrMailbox({
      folder: options.folder,
      maxMessages: options.limit,
      dryRun: options.dryRun,
      forceEnabled: options.force
    });

    console.log('\n' + '='.repeat(60));
    console.log('  SYNCHRONIZATION RESULT');
    console.log('='.repeat(60));
    console.log(`Status:            ${result.status}`);
    console.log(`Processed:         ${result.processedCount ?? result.syncedCount}`);
    console.log(`New Inserted:      ${result.insertedCount ?? result.syncedCount}`);
    console.log(`Last UID:          ${result.lastSyncedUid}`);
    console.log(`UIDVALIDITY:       ${result.uidvalidity || 'N/A'}`);
    console.log(`Dry-Run:           ${result.dryRun}`);
    console.log(`Checkpoint Saved:  ${result.checkpointCommitted ? 'YES (Committed to Supabase)' : 'NO (Read-only, no database writes)'}`);
    console.log('='.repeat(60));

    if (result.status === 'DISABLED') {
      console.log('\nNOTE: TITAN_MAIL_ENABLED is false. Set TITAN_MAIL_ENABLED=true in .env or pass --force to run.');
    }
  } catch (err) {
    const sanitized = sanitizeErrorMessage(err, [config.imap.password, config.smtp.password]);
    console.error('\n❌ Ingestion error occurred:');
    console.error(sanitized);
    process.exit(1);
  }
};

main();
