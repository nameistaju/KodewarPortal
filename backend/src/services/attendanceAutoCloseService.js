import cron from 'node-cron';
import { supabase } from '../config/supabase.js';
import { WORKDAY_CONFIG } from '../config/attendanceConfig.js';
import { getZonedParts, zonedDateTimeToUtc } from '../utils/date.js';
import logger from '../utils/logger.js';

export const processAutoPunchOuts = async () => {
  try {
    const { data: openRecords, error } = await supabase
      .from('attendance')
      .select('*')
      .not('punch_in', 'is', null)
      .is('punch_out', null);

    if (error) {
      logger.error('Error fetching open attendance records for auto-close', { error: error.message });
      return [];
    }

    if (!openRecords || openRecords.length === 0) {
      return [];
    }

    const timeZone = WORKDAY_CONFIG.timezone || 'Asia/Kolkata';
    const now = new Date();
    const currentZonedParts = getZonedParts(now, timeZone);
    const currentTodayStr = `${currentZonedParts.year}-${String(currentZonedParts.month).padStart(2, '0')}-${String(currentZonedParts.day).padStart(2, '0')}`;

    const updatedRecords = [];

    for (const record of openRecords) {
      // Idempotency check: Skip if punch_out is already present or status is already AUTO_PUNCHED_OUT
      if (record.punch_out || (record.status && record.status.toUpperCase() === 'AUTO_PUNCHED_OUT')) {
        continue;
      }

      const dateStr = record.attendance_date;
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        continue;
      }

      const [year, month, day] = dateStr.split('-').map(Number);
      const cutoffDate = zonedDateTimeToUtc(
        {
          year,
          month,
          day,
          hour: WORKDAY_CONFIG.cutoffHour,
          minute: WORKDAY_CONFIG.cutoffMinute,
          second: 0,
          millisecond: 0
        },
        timeZone
      );

      const isPastDay = dateStr < currentTodayStr;
      const isToday = dateStr === currentTodayStr;
      const isPastCutoffToday = isToday && (
        currentZonedParts.hour > WORKDAY_CONFIG.cutoffHour ||
        (currentZonedParts.hour === WORKDAY_CONFIG.cutoffHour && currentZonedParts.minute >= WORKDAY_CONFIG.cutoffMinute)
      );

      if (isPastDay || isPastCutoffToday) {
        let finalPunchOutDate = cutoffDate;
        if (record.punch_in) {
          const punchInDate = new Date(record.punch_in);
          if (punchInDate.getTime() > cutoffDate.getTime()) {
            finalPunchOutDate = punchInDate;
          }
        }

        const punchOutIso = finalPunchOutDate.toISOString();

        const { data: updated, error: updateError } = await supabase
          .from('attendance')
          .update({
            punch_out: punchOutIso,
            status: 'AUTO_PUNCHED_OUT',
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id)
          .is('punch_out', null)
          .select('*')
          .maybeSingle();

        if (!updateError && updated) {
          logger.info('Auto-closed attendance record successfully', {
            id: record.id,
            employeeId: record.employee_id,
            attendanceDate: record.attendance_date,
            punchOut: punchOutIso
          });
          updatedRecords.push(updated);
        }
      }
    }

    return updatedRecords;
  } catch (err) {
    logger.error('Error executing processAutoPunchOuts', { error: err.message });
    return [];
  }
};

export const autoCloseOrphanedAttendances = processAutoPunchOuts;

let cronJob = null;

export const startAutoCloseScheduler = () => {
  if (cronJob) {
    logger.warn('Attendance auto-close scheduler already running');
    return;
  }

  const cronExpression = `${WORKDAY_CONFIG.cutoffMinute} ${WORKDAY_CONFIG.cutoffHour} * * *`;

  logger.info('Registering attendance auto-close job cron scheduler', { cronExpression });

  cronJob = cron.schedule(cronExpression, async () => {
    try {
      await processAutoPunchOuts();
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
