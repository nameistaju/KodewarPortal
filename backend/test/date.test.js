import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/sharpkode-test';
process.env.JWT_SECRET ||= 'test-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret';
process.env.ORGANIZATION_TIMEZONE = 'Asia/Kolkata';

const { addDays, calculateDaysInclusive, endOfDay, isLaterThanLocalTime, startOfDay } = await import('../src/utils/date.js');

test('organization day boundaries are independent of server timezone', () => {
  assert.equal(startOfDay('2026-06-29').toISOString(), '2026-06-28T18:30:00.000Z');
  assert.equal(endOfDay('2026-06-29').toISOString(), '2026-06-29T18:29:59.999Z');
});

test('UTC instants resolve to the correct organization workday', () => {
  assert.equal(startOfDay(new Date('2026-06-28T20:00:00.000Z')).toISOString(), '2026-06-28T18:30:00.000Z');
  assert.equal(startOfDay(new Date('2026-06-29T18:00:00.000Z')).toISOString(), '2026-06-28T18:30:00.000Z');
});

test('calendar operations remain stable across day and month boundaries', () => {
  assert.equal(addDays('2026-06-30', 1).toISOString(), '2026-06-30T18:30:00.000Z');
  assert.equal(calculateDaysInclusive('2026-06-29', '2026-07-01'), 3);
});

test('late cutoff is evaluated in organization local time', () => {
  assert.equal(isLaterThanLocalTime(new Date('2026-06-29T04:00:00.000Z'), 9, 30), false);
  assert.equal(isLaterThanLocalTime(new Date('2026-06-29T04:01:00.000Z'), 9, 30), true);
});
