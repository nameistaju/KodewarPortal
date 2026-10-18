import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { supabase as defaultSupabase } from '../config/supabase.js';
import { getTitanMailConfig, sanitizeErrorMessage } from '../config/titanMailConfig.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { HR_EMAIL_CATEGORIES, classifyEmail, enrichEmailsWithClassification } from './hrEmailClassifier.js';

const MAX_BODY_TEXT_LENGTH = 200000; // 200 KB
const MAX_BODY_HTML_LENGTH = 500000; // 500 KB
const SNIPPET_MAX_LENGTH = 300;

/**
 * Creates an ImapFlow client configured for strict read-only operation.
 * @param {object} imapConfig
 * @returns {ImapFlow}
 */
export const createReadOnlyImapClient = (imapConfig) => {
  return new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: imapConfig.secure,
    auth: {
      user: imapConfig.user,
      pass: imapConfig.password
    },
    logger: false, // Prevents dumping raw authentication strings or message payloads to logs
    emitLogs: false
  });
};

/**
 * Maps a parsed MIME message and IMAP metadata to the public.hr_emails schema.
 * Note: Only attachment metadata (filename, contentType, size, contentId) is extracted.
 * Binary contents are strictly omitted.
 */
export const mapParsedEmailToRecord = (parsed, msg, mailboxAddress, folder, uidvalidity) => {
  const fromObj = parsed.from?.value?.[0];
  const fromAddress = fromObj?.address ? fromObj.address.trim().toLowerCase() : 'unknown@unknown.com';
  const fromName = fromObj?.name ? fromObj.name.trim() : null;

  const toAddresses = (parsed.to?.value || []).map((t) => ({
    address: t.address?.trim()?.toLowerCase() || '',
    name: t.name?.trim() || null
  })).filter((t) => t.address.length > 0);

  const ccAddresses = (parsed.cc?.value || []).map((t) => ({
    address: t.address?.trim()?.toLowerCase() || '',
    name: t.name?.trim() || null
  })).filter((t) => t.address.length > 0);

  const bccAddresses = (parsed.bcc?.value || []).map((t) => ({
    address: t.address?.trim()?.toLowerCase() || '',
    name: t.name?.trim() || null
  })).filter((t) => t.address.length > 0);

  const replyTo = parsed.replyTo?.value?.[0]?.address
    ? parsed.replyTo.value[0].address.trim().toLowerCase()
    : null;

  let bodyText = typeof parsed.text === 'string' ? parsed.text : '';
  if (bodyText.length > MAX_BODY_TEXT_LENGTH) {
    bodyText = bodyText.slice(0, MAX_BODY_TEXT_LENGTH) + '\n... [TRUNCATED]';
  }

  let bodyHtml = typeof parsed.html === 'string' ? parsed.html : null;
  if (bodyHtml && bodyHtml.length > MAX_BODY_HTML_LENGTH) {
    bodyHtml = bodyHtml.slice(0, MAX_BODY_HTML_LENGTH) + '\n<!-- [TRUNCATED] -->';
  }

  // Derive human-readable snippet from plain text
  const cleanSnippetText = (bodyText || parsed.textAsHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const snippet = cleanSnippetText.slice(0, SNIPPET_MAX_LENGTH) || null;

  const attachmentsMeta = (parsed.attachments || []).map((att) => ({
    filename: att.filename || 'attachment',
    contentType: att.contentType || 'application/octet-stream',
    size: Number(att.size) || (att.content ? att.content.length : 0),
    contentId: att.contentId || null
  }));

  const sentAt = parsed.date
    ? new Date(parsed.date).toISOString()
    : msg.internalDate
      ? new Date(msg.internalDate).toISOString()
      : new Date().toISOString();

  return {
    mailbox_address: mailboxAddress,
    folder,
    uidvalidity: Number(uidvalidity),
    uid: Number(msg.uid),
    message_id: parsed.messageId ? parsed.messageId.trim().slice(0, 500) : null,
    from_address: fromAddress.slice(0, 255),
    from_name: fromName ? fromName.slice(0, 255) : null,
    to_addresses: toAddresses,
    cc_addresses: ccAddresses,
    bcc_addresses: bccAddresses,
    reply_to: replyTo ? replyTo.slice(0, 255) : null,
    subject: parsed.subject ? parsed.subject.trim() : '(No Subject)',
    sent_at: sentAt,
    body_text: bodyText || null,
    body_html: bodyHtml,
    snippet,
    has_attachments: attachmentsMeta.length > 0,
    attachments: attachmentsMeta,
    is_read: false,
    is_starred: false,
    is_archived: false,
    processing_status: 'PENDING'
  };
};

/**
 * Acquires the database sync lock via atomic PostgreSQL stored procedure.
 */
export const acquireSyncLock = async (supabase, mailboxAddress, folder, leaseSeconds = 300) => {
  const { data, error } = await supabase.rpc('acquire_hr_mailbox_lock', {
    p_mailbox_address: mailboxAddress,
    p_folder: folder,
    p_lease_seconds: leaseSeconds
  });

  if (error) {
    throw new AppError(`Failed to acquire mailbox sync lock: ${error.message}`, 500);
  }

  return data; // Returns UUID lock token if acquired, or null if locked
};

/**
 * Renews the sync lease and optionally advances checkpoints.
 */
export const renewSyncLock = async (
  supabase,
  mailboxAddress,
  folder,
  lockToken,
  leaseSeconds = 300,
  lastSyncedUid = null,
  messagesSyncedDelta = 0
) => {
  const { data, error } = await supabase.rpc('renew_hr_mailbox_lock', {
    p_mailbox_address: mailboxAddress,
    p_folder: folder,
    p_lock_token: lockToken,
    p_lease_seconds: leaseSeconds,
    p_last_synced_uid: lastSyncedUid !== null ? Number(lastSyncedUid) : null,
    p_messages_synced_delta: Number(messagesSyncedDelta)
  });

  if (error) {
    throw new AppError(`Failed to renew mailbox sync lock: ${error.message}`, 500);
  }

  return Boolean(data);
};

/**
 * Releases the sync lease and commits final checkpoints and UIDVALIDITY.
 */
export const releaseSyncLock = async (
  supabase,
  mailboxAddress,
  folder,
  lockToken,
  lastSyncedUid = null,
  messagesSyncedDelta = 0,
  errorMessage = null,
  uidvalidity = null
) => {
  const { data, error } = await supabase.rpc('release_hr_mailbox_lock', {
    p_mailbox_address: mailboxAddress,
    p_folder: folder,
    p_lock_token: lockToken,
    p_last_synced_uid: lastSyncedUid !== null ? Number(lastSyncedUid) : null,
    p_messages_synced_delta: Number(messagesSyncedDelta),
    p_error_message: errorMessage,
    p_uidvalidity: uidvalidity !== null ? Number(uidvalidity) : null
  });

  if (error) {
    logger.error('Failed to release mailbox sync lock', { error: error.message });
    return false;
  }

  return Boolean(data);
};

/**
 * Core ingestion worker: synchronizes messages from Titan IMAP to public.hr_emails in strict read-only mode.
 * @param {object} options
 * @param {string} [options.folder='INBOX'] - Mailbox folder
 * @param {number|null} [options.maxMessages=null] - Maximum messages to process in this run
 * @param {number} [options.batchSize=50] - Number of messages to batch per database upsert
 * @param {boolean} [options.dryRun=false] - If true, fetches and parses without database insertion
 * @param {boolean} [options.forceEnabled=false] - If true, bypasses TITAN_MAIL_ENABLED guard for testing
 * @param {object} [options.supabaseClient=defaultSupabase] - Injected Supabase client
 * @param {Function} [options.imapClientFactory=createReadOnlyImapClient] - Injected IMAP client factory
 * @returns {Promise<object>} Sync summary
 */
export const syncHrMailbox = async ({
  folder = 'INBOX',
  maxMessages = null,
  batchSize = 50,
  dryRun = false,
  forceEnabled = false,
  supabaseClient = defaultSupabase,
  imapClientFactory = createReadOnlyImapClient,
  config: injectedConfig = null
} = {}) => {
  let config;
  if (injectedConfig) {
    config = injectedConfig;
  } else {
    const configRes = getTitanMailConfig();
    if (!configRes.success) {
      throw new AppError(`Titan mail configuration error: ${configRes.errors.join('; ')}`, 500);
    }
    config = configRes.data;
  }

  const secrets = [config.imap?.password, config.smtp?.password].filter(Boolean);

  if (!config.enabled && !forceEnabled) {
    logger.warn('Mailbox sync skipped: TITAN_MAIL_ENABLED is false');
    return {
      status: 'DISABLED',
      message: 'Titan mailbox integration is currently disabled (TITAN_MAIL_ENABLED=false).',
      syncedCount: 0
    };
  }

  const mailboxAddress = config.mailboxAddress;
  const leaseSeconds = 300;

  // 1. Acquire atomic lease lock
  const lockToken = await acquireSyncLock(supabaseClient, mailboxAddress, folder, leaseSeconds);
  if (!lockToken) {
    logger.warn('Mailbox sync locked by another active worker', { mailboxAddress, folder });
    return {
      status: 'LOCKED',
      message: 'Sync lock is currently held by another worker. Interrupted or parallel run prevented.',
      syncedCount: 0
    };
  }

  logger.info('Acquired HR mailbox sync lock', { mailboxAddress, folder, leaseSeconds });

  let client = null;
  let mailboxLock = null;
  let syncedInThisRun = 0;
  let processedInThisRun = 0;
  let uncommittedSyncedDelta = 0;
  let currentLastSyncedUid = 0;
  let serverUidvalidity = null;
  let finalStatus = 'SUCCESS';
  let failureError = null;

  try {
    // 2. Fetch existing checkpoint from database
    const { data: syncState, error: stateErr } = await supabaseClient
      .from('hr_mailbox_sync_state')
      .select('uidvalidity, last_synced_uid, total_messages_synced')
      .eq('mailbox_address', mailboxAddress)
      .eq('folder', folder)
      .maybeSingle();

    if (stateErr) {
      throw new AppError(`Failed to read sync checkpoint: ${stateErr.message}`, 500);
    }

    const recordedUidvalidity = syncState?.uidvalidity ? Number(syncState.uidvalidity) : 0;
    currentLastSyncedUid = syncState?.last_synced_uid ? Number(syncState.last_synced_uid) : 0;

    // 3. Connect to IMAP server in strict read-only mode
    client = imapClientFactory(config.imap);
    await client.connect();

    // 4. Open folder with readOnly: true (issues IMAP EXAMINE command)
    mailboxLock = await client.getMailboxLock(folder, { readOnly: true });

    serverUidvalidity = Number(client.mailbox.uidValidity);
    const serverUidNext = Number(client.mailbox.uidNext || 0);
    const serverTotalExists = Number(client.mailbox.exists || 0);

    logger.info('Connected to mailbox in read-only mode', {
      mailboxAddress,
      folder,
      serverUidvalidity,
      serverUidNext,
      serverTotalExists,
      recordedUidvalidity,
      recordedLastSyncedUid: currentLastSyncedUid
    });

    // 5. Handle UIDVALIDITY change per RFC 3501
    if (recordedUidvalidity > 0 && serverUidvalidity !== recordedUidvalidity) {
      logger.warn('IMAP UIDVALIDITY epoch changed. Resetting checkpoint to 0.', {
        oldUidvalidity: recordedUidvalidity,
        newUidvalidity: serverUidvalidity
      });
      currentLastSyncedUid = 0;
    }

    // 6. Determine UID range to fetch
    const startUid = currentLastSyncedUid + 1;
    const hasNewMessages = serverTotalExists > 0 && (serverUidNext === 0 || startUid < serverUidNext);

    if (!hasNewMessages && currentLastSyncedUid > 0) {
      logger.info('Mailbox is already up to date', { mailboxAddress, folder, currentLastSyncedUid });
      return {
        status: 'UP_TO_DATE',
        message: 'Mailbox is already up to date.',
        syncedCount: 0,
        insertedCount: 0,
        processedCount: 0,
        lastSyncedUid: currentLastSyncedUid,
        totalExists: serverTotalExists
      };
    }

    const range = `${startUid}:*`;
    const messageBatch = [];
    let batchHighestUid = currentLastSyncedUid;

    // 7. Fetch messages with source stream for MIME parsing
    // { readOnly: true } ensures no flags or states are modified
    for await (const msg of client.fetch(range, { uid: true, internalDate: true, source: true }, { uid: true })) {
      if (Number(msg.uid) <= currentLastSyncedUid) {
        continue; // Protect against range wrapping
      }

      try {
        const parsed = await simpleParser(msg.source);
        const record = mapParsedEmailToRecord(parsed, msg, mailboxAddress, folder, serverUidvalidity);
        messageBatch.push(record);
      } catch (mimeErr) {
        logger.error('Failed to parse MIME message, storing fallback record', {
          uid: msg.uid,
          error: sanitizeErrorMessage(mimeErr, secrets)
        });
        messageBatch.push({
          mailbox_address: mailboxAddress,
          folder,
          uidvalidity: serverUidvalidity,
          uid: Number(msg.uid),
          from_address: 'unknown@malformed.mime',
          subject: '[MALFORMED MIME MESSAGE]',
          sent_at: msg.internalDate ? new Date(msg.internalDate).toISOString() : new Date().toISOString(),
          snippet: '[Unparseable message payload]',
          body_text: null,
          body_html: null,
          has_attachments: false,
          attachments: [],
          is_read: false,
          processing_status: 'FAILED'
        });
      }

      batchHighestUid = Math.max(batchHighestUid, Number(msg.uid));

      // 8. Flush batch if threshold reached
      if (messageBatch.length >= batchSize) {
        let batchInsertedCount = messageBatch.length;
        if (!dryRun) {
          // Pre-write lock check: verify worker still owns unexpired lease immediately before persisting
          const leaseActive = await renewSyncLock(
            supabaseClient,
            mailboxAddress,
            folder,
            lockToken,
            leaseSeconds
          );
          if (!leaseActive) {
            throw new AppError('Sync lease expired or stolen before persisting email batch. Halting worker.', 409);
          }

          const upsertQuery = supabaseClient
            .from('hr_emails')
            .upsert(messageBatch, { onConflict: 'mailbox_address,folder,uidvalidity,uid', ignoreDuplicates: true });

          const { data: upsertData, error: upsertErr } = typeof upsertQuery?.select === 'function'
            ? await upsertQuery.select('id')
            : await upsertQuery;

          if (upsertErr) {
            throw new AppError(`Database batch upsert failed: ${upsertErr.message}`, 500);
          }

          batchInsertedCount = Array.isArray(upsertData) ? upsertData.length : messageBatch.length;

          // Extend lease and commit intermediate checkpoint with actual inserted count
          const renewed = await renewSyncLock(
            supabaseClient,
            mailboxAddress,
            folder,
            lockToken,
            leaseSeconds,
            batchHighestUid,
            batchInsertedCount
          );

          if (!renewed) {
            throw new AppError('Sync lease expired or stolen during batch checkpoint update. Halting worker.', 409);
          }
        }

        syncedInThisRun += batchInsertedCount;
        processedInThisRun += messageBatch.length;
        currentLastSyncedUid = batchHighestUid;
        messageBatch.length = 0; // Clear array
      }

      if (maxMessages && processedInThisRun + messageBatch.length >= maxMessages) {
        logger.info('Reached maxMessages limit for this sync run', { maxMessages });
        break;
      }
    }

    // 9. Flush remaining batch
    if (messageBatch.length > 0) {
      let batchInsertedCount = messageBatch.length;
      if (!dryRun) {
        // Pre-write lock check: verify worker still owns unexpired lease immediately before persisting
        const leaseActive = await renewSyncLock(
          supabaseClient,
          mailboxAddress,
          folder,
          lockToken,
          leaseSeconds
        );
        if (!leaseActive) {
          throw new AppError('Sync lease expired or stolen before persisting final email batch. Halting worker.', 409);
        }

        const upsertQuery = supabaseClient
          .from('hr_emails')
          .upsert(messageBatch, { onConflict: 'mailbox_address,folder,uidvalidity,uid', ignoreDuplicates: true });

        const { data: upsertData, error: upsertErr } = typeof upsertQuery?.select === 'function'
          ? await upsertQuery.select('id')
          : await upsertQuery;

        if (upsertErr) {
          throw new AppError(`Database final upsert failed: ${upsertErr.message}`, 500);
        }

        batchInsertedCount = Array.isArray(upsertData) ? upsertData.length : messageBatch.length;
      }

      syncedInThisRun += batchInsertedCount;
      uncommittedSyncedDelta += batchInsertedCount;
      processedInThisRun += messageBatch.length;
      currentLastSyncedUid = batchHighestUid;
    }

    logger.info('Mailbox sync iteration completed successfully', {
      mailboxAddress,
      folder,
      syncedInThisRun,
      processedInThisRun,
      currentLastSyncedUid,
      dryRun
    });

  } catch (err) {
    finalStatus = 'ERROR';
    failureError = sanitizeErrorMessage(err, secrets);
    logger.error('Mailbox sync encountered an error', { error: failureError });
    throw err;
  } finally {
    // 10. Clean up IMAP connection
    if (mailboxLock) {
      try {
        mailboxLock.release();
      } catch {
        // Ignore lock release errors
      }
    }

    if (client) {
      try {
        await client.logout().catch(() => client.close());
      } catch {
        // Ignore logout errors
      }
    }

    // 11. Release atomic sync lock
    await releaseSyncLock(
      supabaseClient,
      mailboxAddress,
      folder,
      lockToken,
      dryRun ? null : (currentLastSyncedUid !== null ? currentLastSyncedUid : null),
      dryRun ? 0 : uncommittedSyncedDelta,
      failureError,
      serverUidvalidity
    );
  }

  return {
    status: finalStatus,
    mailboxAddress,
    folder,
    syncedCount: dryRun ? 0 : syncedInThisRun,
    insertedCount: dryRun ? 0 : syncedInThisRun,
    processedCount: processedInThisRun,
    lastSyncedUid: currentLastSyncedUid,
    uidvalidity: serverUidvalidity,
    checkpointCommitted: !dryRun,
    dryRun
  };
};

/**
 * Retrieves the current synchronization status from hr_mailbox_sync_state.
 */
export const getMailboxSyncStatus = async (
  mailboxAddress = 'hr@kodewar.com',
  folder = 'INBOX',
  supabaseClient = defaultSupabase
) => {
  const configRes = getTitanMailConfig();
  const isEnabled = configRes.success ? configRes.data.enabled : false;

  // 1. Fetch sync checkpoint state
  const { data, error } = await supabaseClient
    .from('hr_mailbox_sync_state')
    .select('*')
    .eq('mailbox_address', mailboxAddress)
    .eq('folder', folder)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch mailbox sync status: ${error.message}`, 500);
  }

  // 2. Query stored email count
  let storedEmailCount = null;
  try {
    const countRes = await supabaseClient
      .from('hr_emails')
      .select('*', { count: 'exact', head: true })
      .eq('mailbox_address', mailboxAddress)
      .eq('folder', folder);
    if (!countRes.error && typeof countRes.count === 'number') {
      storedEmailCount = countRes.count;
    }
  } catch {
    // Graceful fallback to checkpoint count if count query is unavailable
  }

  const isLockActive = Boolean(
    data?.status === 'SYNCING' &&
    data?.lock_expires_at &&
    new Date(data.lock_expires_at) > new Date()
  );

  let currentStatus = data?.status || 'IDLE';
  if (currentStatus === 'SYNCING' && !isLockActive) {
    currentStatus = 'IDLE'; // Expired lock returns to IDLE
  }

  return {
    enabled: isEnabled,
    mailboxAddress,
    folder,
    currentStatus,
    lastSuccessfulSync: data?.last_sync_completed_at || null,
    lastSyncStartedAt: data?.last_sync_started_at || null,
    lastError: data?.error_message || null,
    checkpoint: {
      lastSyncedUid: Number(data?.last_synced_uid || 0),
      uidvalidity: Number(data?.uidvalidity || 0)
    },
    totalMessagesSynced: Number(data?.total_messages_synced || 0),
    storedEmailCount: storedEmailCount !== null ? storedEmailCount : Number(data?.total_messages_synced || 0),
    isLockActive,
    syncState: data || null
  };
};

/**
 * Retrieves paginated stored emails for the HR workspace with deterministic classification and filtering.
 */
const LIST_COLUMNS =
  'id, mailbox_address, folder, uid, uidvalidity, message_id, from_address, from_name, to_addresses, subject, sent_at, snippet, has_attachments, attachments, is_read, is_starred, is_archived, processing_status, category, classification_confidence, classification_reason, manual_category_override, created_at';

export const getStoredEmails = async (
  {
    page = 1,
    limit = 20,
    folder = 'INBOX',
    isRead,
    processingStatus,
    category,
    search
  } = {},
  supabaseClient = defaultSupabase
) => {
  const offset = (page - 1) * limit;

  let query = supabaseClient
    .from('hr_emails')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('folder', folder)
    .order('sent_at', { ascending: false });

  if (typeof isRead === 'boolean') {
    query = query.eq('is_read', isRead);
  }

  if (processingStatus) {
    query = query.eq('processing_status', processingStatus);
  }

  if (category && category !== 'ALL') {
    query = query.eq('category', category);
  }

  if (search) {
    query = query.or(`subject.ilike.%${search}%,from_address.ilike.%${search}%,snippet.ilike.%${search}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new AppError(`Failed to fetch stored emails: ${error.message}`, 500);
  }

  const enriched = enrichEmailsWithClassification(data || []);

  return {
    emails: enriched,
    pagination: {
      page,
      limit,
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / limit) || 1
    }
  };
};

/**
 * Retrieves a single stored email record by UUID including body text, HTML, and classification.
 */
export const getStoredEmailById = async (id, supabaseClient = defaultSupabase) => {
  const { data, error } = await supabaseClient
    .from('hr_emails')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to fetch email: ${error.message}`, 500);
  }

  if (!data) {
    throw new AppError('Email not found', 404);
  }

  const [enriched] = enrichEmailsWithClassification([data]);
  return enriched;
};

/**
 * Updates an email's category with an authorized HR manual override.
 */
export const updateEmailCategory = async (emailId, category, updatedBy = 'HR', supabaseClient = defaultSupabase) => {
  if (!HR_EMAIL_CATEGORIES.includes(category)) {
    throw new AppError(`Invalid email category: ${category}`, 400);
  }

  const { data: existing, error: findError } = await supabaseClient
    .from('hr_emails')
    .select('id, uid, subject')
    .eq('id', emailId)
    .maybeSingle();

  if (findError) {
    throw new AppError(`Failed to fetch email: ${findError.message}`, 500);
  }
  if (!existing) {
    throw new AppError('Email not found', 404);
  }

  const { data, error } = await supabaseClient
    .from('hr_emails')
    .update({
      category,
      manual_category_override: category,
      classification_reason: `Manual override by ${updatedBy}`,
      classification_confidence: 1.0,
      classified_at: new Date().toISOString()
    })
    .eq('id', emailId)
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST204' || (error.message && error.message.includes('column'))) {
      const appErr = new AppError(
        'Database migration required: The classification columns have not been created yet in public.hr_emails. Please run backend/src/db/migrations/000_stage_b2_consolidated_migration.sql in Supabase SQL Editor.',
        503
      );
      appErr.code = 'SCHEMA_MIGRATION_PENDING';
      appErr.table = 'hr_emails';
      appErr.migrationFile = 'backend/src/db/migrations/000_stage_b2_consolidated_migration.sql';
      throw appErr;
    }
    throw new AppError(`Failed to update email category: ${error.message}`, 500);
  }

  const [enriched] = enrichEmailsWithClassification([data]);
  return enriched;
};

