import cron from 'node-cron';
import Attendance from '../models/Attendance.js';
import AuditLog from '../models/AuditLog.js';
import { runInTransaction } from '../utils/transaction.js';
import { getZonedParts, zonedDateTimeToUtc } from '../utils/date.js';
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

let cronJob = null;

const getPunchOutTimeForDate = (recordDate) => {
  const parts = getZonedParts(recordDate);
  return zonedDateTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 20,
    minute: 30,
    second: 0,
    millisecond: 0
  });
};

export const autoCloseOrphanedAttendances = async () => {
  logger.info('Starting attendance auto-close job execution');

  try {
    const openRecords = await Attendance.find({
      attendanceStatus: 'PUNCHED_IN',
      'punchIn.time': { $exists: true },
      $or: [
        { 'punchOut.time': { $exists: false } },
        { 'punchOut.time': null }
      ]
    }).populate('employee');

    logger.info(`Found ${openRecords.length} open attendance records to close`);

    for (const record of openRecords) {
      if (!record.employee) {
        logger.error('Auto-close skipped: Attendance record lacks valid employee reference', { attendanceId: record._id });
        continue;
      }

      const punchOutTime = getPunchOutTimeForDate(record.date);

      try {
        await runInTransaction(async (session) => {
          record.attendanceStatus = 'PUNCHED_OUT';
          record.isAutoClosed = true;
          record.punchOut = {
            time: punchOutTime,
            location: {
              latitude: env.defaultOfficeLatitude,
              longitude: env.defaultOfficeLongitude,
              distanceFromOfficeMeters: 0,
              accuracy: 0
            },
            deviceInfo: 'System Auto-Close'
          };

          record.workingHours = Number(((punchOutTime - record.punchIn.time) / 3600000).toFixed(2));

          await record.save({ session });

          await AuditLog.create([{
            employeeEmail: record.employee.email,
            action: 'Attendance Auto-Close',
            adminEmail: 'system@kodewar.com',
            timestamp: new Date(),
            employee: record.employee._id,
            attendanceId: record._id,
            reason: 'System automatically punched out at 8:30 PM due to missing punch out.',
            operatorType: 'SYSTEM'
          }], { session });

          logger.info(`Auto-closed attendance record successfully`, {
            attendanceId: record._id,
            employeeEmail: record.employee.email,
            punchOutTime: punchOutTime.toISOString()
          });
        });
      } catch (txnError) {
        logger.error('Failed to auto-close attendance record inside transaction', {
          attendanceId: record._id,
          employeeEmail: record.employee.email,
          error: txnError.message
        });
      }
    }
  } catch (err) {
    logger.error('Error fetching open attendance records for auto-close job', { error: err.message });
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
