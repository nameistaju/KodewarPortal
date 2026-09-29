import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Attendance from '../src/models/Attendance.js';
import AttendanceCorrection from '../src/models/AttendanceCorrection.js';
import ClientVisit from '../src/models/ClientVisit.js';
import FieldTrackingSession from '../src/models/FieldTrackingSession.js';
import Leave from '../src/models/Leave.js';

const duplicateGroups = async (model, match, groupId = '$employee') => model.aggregate([
  { $match: match },
  { $group: { _id: groupId, count: { $sum: 1 }, ids: { $push: '$_id' } } },
  { $match: { count: { $gt: 1 } } },
  { $limit: 20 }
]);

const ensureNoDuplicates = async () => {
  const [attendance, tracking, visits, corrections, leaves] = await Promise.all([
    duplicateGroups(Attendance, { attendanceStatus: 'PUNCHED_IN' }),
    duplicateGroups(FieldTrackingSession, { isActive: true }),
    duplicateGroups(ClientVisit, { status: 'IN_PROGRESS' }),
    duplicateGroups(
      AttendanceCorrection,
      { status: 'PENDING' },
      { employee: '$employee', date: '$date', correctionType: '$correctionType' }
    ),
    duplicateGroups(
      Leave,
      { status: 'PENDING' },
      { employee: '$employee', startDate: '$startDate', endDate: '$endDate', leaveType: '$leaveType' }
    )
  ]);
  const conflicts = { attendance, tracking, visits, corrections, leaves };
  const conflictCount = Object.values(conflicts).reduce((sum, items) => sum + items.length, 0);
  if (conflictCount) {
    console.error(JSON.stringify({ message: 'Index migration blocked by duplicate active records', conflicts }, null, 2));
    process.exitCode = 2;
    return false;
  }
  return true;
};

const dropIndexIfPresent = async (collection, name) => {
  const indexes = await collection.indexes();
  if (indexes.some((index) => index.name === name)) await collection.dropIndex(name);
};

try {
  await connectDB();
  if (!(await ensureNoDuplicates())) process.exitCode = 2;
  else {
    await dropIndexIfPresent(FieldTrackingSession.collection, 'employee_1_isActive_1');
    await Promise.all([
      Attendance.collection.createIndex(
        { employee: 1, date: 1 },
        { name: 'employee_1_date_1', unique: true }
      ),
      Attendance.collection.createIndex(
        { employee: 1, attendanceStatus: 1 },
        { name: 'uniq_open_attendance_per_employee', unique: true, partialFilterExpression: { attendanceStatus: 'PUNCHED_IN' } }
      ),
      FieldTrackingSession.collection.createIndex(
        { employee: 1, isActive: 1 },
        { name: 'uniq_active_tracking_per_employee', unique: true, partialFilterExpression: { isActive: true } }
      ),
      FieldTrackingSession.collection.createIndex({ punchInTime: -1 }, { name: 'punchInTime_-1' }),
      ClientVisit.collection.createIndex(
        { employee: 1, status: 1 },
        { name: 'uniq_active_visit_per_employee', unique: true, partialFilterExpression: { status: 'IN_PROGRESS' } }
      ),
      AttendanceCorrection.collection.createIndex(
        { employee: 1, date: 1, correctionType: 1, status: 1 },
        { name: 'uniq_pending_correction_per_type_and_date', unique: true, partialFilterExpression: { status: 'PENDING' } }
      ),
      Leave.collection.createIndex(
        { employee: 1, startDate: 1, endDate: 1, leaveType: 1, status: 1 },
        { name: 'uniq_pending_leave_range', unique: true, partialFilterExpression: { status: 'PENDING' } }
      )
    ]);
    console.log('Production indexes prepared successfully.');
  }
} finally {
  if (mongoose.connection.readyState !== 0) await disconnectDB();
}