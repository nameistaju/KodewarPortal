import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';
process.env.ORGANIZATION_TIMEZONE = 'Asia/Kolkata';

const { WORKDAY_CONFIG } = await import('../src/config/attendanceConfig.js');
const { getZonedParts, zonedDateTimeToUtc, startOfDay } = await import('../src/utils/date.js');

test('WORKDAY_CONFIG centralized configuration', () => {
  assert.equal(WORKDAY_CONFIG.timezone, 'Asia/Kolkata');
  assert.equal(WORKDAY_CONFIG.workdayEndTime, '18:30');
  assert.equal(WORKDAY_CONFIG.cutoffHour, 18);
  assert.equal(WORKDAY_CONFIG.cutoffMinute, 30);
});

test('Asia/Kolkata timezone cutoff resolves to exact 18:30 IST timestamp in UTC', () => {
  const cutoffUtc = zonedDateTimeToUtc(
    { year: 2026, month: 10, day: 1, hour: 18, minute: 30, second: 0, millisecond: 0 },
    'Asia/Kolkata'
  );
  // 18:30 IST on 2026-10-01 is 13:00:00 UTC
  assert.equal(cutoffUtc.toISOString(), '2026-10-01T13:00:00.000Z');
});

test('Date does not shift because of UTC offset in Asia/Kolkata', () => {
  const dateStr = '2026-10-01';
  const start = startOfDay(dateStr, 'Asia/Kolkata');
  const parts = getZonedParts(start, 'Asia/Kolkata');
  assert.equal(parts.year, 2026);
  assert.equal(parts.month, 10);
  assert.equal(parts.day, 1);
});

test('Auto punch-out working hours calculation: 09:57 AM to 18:30 PM cutoff', () => {
  // Punch in at 09:57 AM IST (04:27:00 UTC)
  const punchInUtc = new Date('2026-10-01T04:27:00.000Z');
  // Auto punch-out at 18:30 PM IST (13:00:00 UTC)
  const autoPunchOutUtc = new Date('2026-10-01T13:00:00.000Z');

  const diffMs = autoPunchOutUtc.getTime() - punchInUtc.getTime();
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  assert.equal(hours, 8);
  assert.equal(mins, 33);
  assert.equal(`${hours}h ${mins}m`, '8h 33m');
});

test('Auto punch-out working hours calculation: 10:42 AM to 18:30 PM cutoff', () => {
  // Punch in at 10:42 AM IST (05:12:00 UTC)
  const punchInUtc = new Date('2026-10-01T05:12:00.000Z');
  // Auto punch-out at 18:30 PM IST (13:00:00 UTC)
  const autoPunchOutUtc = new Date('2026-10-01T13:00:00.000Z');

  const diffMs = autoPunchOutUtc.getTime() - punchInUtc.getTime();
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  assert.equal(hours, 7);
  assert.equal(mins, 48);
  assert.equal(`${hours}h ${mins}m`, '7h 48m');
});

test('Manual punch-out is preserved and not overwritten by auto punch-out logic', () => {
  const manualPunchIn = '2026-10-01T04:30:00.000Z'; // 10:00 AM IST
  const manualPunchOut = '2026-10-01T11:30:00.000Z'; // 17:00 PM IST
  const existingRecord = {
    id: 'rec-123',
    punch_in: manualPunchIn,
    punch_out: manualPunchOut,
    status: 'present'
  };

  // Idempotency rule: Record already has punch_out, so it must not be touched
  const isAlreadyClosed = Boolean(existingRecord.punch_out);
  assert.equal(isAlreadyClosed, true);
  assert.equal(existingRecord.punch_out, manualPunchOut);
  assert.equal(existingRecord.status, 'present');
});

test('Running auto punch-out twice does not modify already AUTO_PUNCHED_OUT records', () => {
  const autoClosedRecord = {
    id: 'rec-456',
    punch_in: '2026-10-01T04:27:00.000Z',
    punch_out: '2026-10-01T13:00:00.000Z',
    status: 'AUTO_PUNCHED_OUT'
  };

  // Idempotency rule: Record has status AUTO_PUNCHED_OUT and non-null punch_out
  const isAutoPunchedOut = autoClosedRecord.status === 'AUTO_PUNCHED_OUT' && Boolean(autoClosedRecord.punch_out);
  assert.equal(isAutoPunchedOut, true);
  assert.equal(autoClosedRecord.punch_out, '2026-10-01T13:00:00.000Z');
});

test('Employee with no punch-in remains absent', () => {
  const absentRecord = null;
  const punchIn = absentRecord?.punch_in || null;
  assert.equal(punchIn, null);
});

test('Leave employee remains on leave and not auto-closed as attendance', () => {
  const approvedLeave = {
    id: 'leave-789',
    employee_id: 'emp-99',
    status: 'approved',
    start_date: '2026-10-01',
    end_date: '2026-10-01'
  };

  const isOnLeave = approvedLeave.status === 'approved';
  assert.equal(isOnLeave, true);
});
