import cron from 'node-cron';
import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

let cronJob = null;

export const autoCloseOrphanedAttendances = async () => {
  logger.info('Starting attendance auto-close job execution');

  try {
    const { data: openRecords, error } = await supabase
      .from('attendance')
      .select('*')
      .not('punch_in', 'is', null)
      .is('punch_out', null);

    if (error) {
      logger.error('Error fetching open attendance records for auto-close job', { error: error.message });
      return;
    }

    logger.info(`Found ${(openRecords || []).length} open attendance records to close`);

    for (const record of (openRecords || [])) {
      const punchOutTime = new Date().toISOString();

      await supabase
        .from('attendance')
        .update({
          punch_out: punchOutTime,
          status: 'PUNCHED_OUT',
          updated_at: punchOutTime
        })
        .eq('id', record.id);

      logger.info('Auto-closed attendance record successfully', { id: record.id });
    }
  } catch (err) {
    logger.error('Error executing auto-close job', { error: err.message });
  }
};

export const startAutoCloseScheduler = () => {
  if (cronJob) {
    logger.warn('Attendance auto-close scheduler already running');
    return;
  }

  const cronExpression = '30 20 * * *';

  logger.info('Registering attendance auto-close job cron scheduler', { cronExpression });

  cronJob = cron.schedule(cronExpression, async () => {
    try {
      await autoCloseOrphanedAttendances();
    } catch (jobError) {
      logger.error('Attendance auto-close cron job failed', { error: jobError.message });
    }
  });
};

export const stopAutoCloseScheduler = () => {
  if (cronJob) {
    logger.info('Stopping attendance auto-close job cron scheduler');
    cronJob.stop();
    cronJob = null;
  }
};
