import * as hrMailboxService from '../services/hrMailboxIngestionService.js';
import { getSchedulerStatus } from '../services/hrMailboxScheduler.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const getSyncStatus = catchAsync(async (req, res) => {
  const mailboxAddress = req.query.mailboxAddress || undefined;
  const folder = req.query.folder || 'INBOX';
  const status = await hrMailboxService.getMailboxSyncStatus(mailboxAddress, folder);
  const scheduler = getSchedulerStatus();
  sendSuccess(res, 200, 'HR Mailbox sync status fetched successfully', {
    ...status,
    scheduler
  });
});

export const triggerSync = catchAsync(async (req, res) => {
  const options = {
    folder: req.body.folder || 'INBOX',
    maxMessages: req.body.maxMessages || null,
    batchSize: req.body.batchSize || 50,
    dryRun: req.body.dryRun || false
  };

  const result = await hrMailboxService.syncHrMailbox(options);

  if (result.status === 'DISABLED') {
    return sendSuccess(res, 200, 'Mailbox sync is currently disabled by configuration', result);
  }

  if (result.status === 'LOCKED') {
    return sendSuccess(res, 409, 'Mailbox sync is already running in another process', result);
  }

  sendSuccess(res, 200, 'HR Mailbox synchronization completed successfully', result);
});

export const getEmails = catchAsync(async (req, res) => {
  const result = await hrMailboxService.getStoredEmails(req.validatedQuery || req.query);
  sendSuccess(res, 200, 'HR emails fetched successfully', result);
});

export const getEmailById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const email = await hrMailboxService.getStoredEmailById(id);
  sendSuccess(res, 200, 'HR email fetched successfully', email);
});

export const updateEmailCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { category } = req.body;
  const updatedBy = req.user?.name || req.user?.email || 'HR';
  const updated = await hrMailboxService.updateEmailCategory(id, category, updatedBy);
  sendSuccess(res, 200, 'Email category updated successfully', updated);
});

