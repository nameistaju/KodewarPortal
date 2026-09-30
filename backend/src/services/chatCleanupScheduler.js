import cron from 'node-cron';
import { cleanupExpiredMessages } from './chatService.js';
import logger from '../utils/logger.js';

let cronJob = null;

export const startChatCleanupScheduler = () => {
  if (cronJob) {
    logger.warn('Chat cleanup scheduler already running');
    return;
  }

  // Run every 15 minutes
  const cronExpression = '*/15 * * * *';

  logger.info('Registering expired chat messages cleanup cron scheduler', { cronExpression });

  cronJob = cron.schedule(cronExpression, async () => {
    try {
      await cleanupExpiredMessages();
    } catch (jobError) {
      logger.error('Expired chat messages cleanup cron job failed', { error: jobError.message });
    }
  });
};

export const stopChatCleanupScheduler = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info('Stopped chat cleanup scheduler');
  }
};
