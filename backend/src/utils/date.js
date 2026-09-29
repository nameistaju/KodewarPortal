import { env } from '../config/env.js';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatterCache = new Map();
const getFormatter = (timeZone) => {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(timeZone, new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }));
  }
  return formatterCache.get(timeZone);
};

export const getZonedParts = (date = new Date(), timeZone = env.organizationTimezone) => {
  const values = {};
  getFormatter(timeZone).formatToParts(new Date(date)).forEach(({ type, value }) => {
    if (type !== 'literal') values[type] = Number(value);
  });
  return values;
};

export const zonedDateTimeToUtc = (parts, timeZone = env.organizationTimezone) => {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0, parts.millisecond || 0);
  let guess = target;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedParts(new Date(guess), timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, parts.millisecond || 0);
    const adjustment = target - represented;
    guess += adjustment;
    if (adjustment === 0) break;
  }

  return new Date(guess);
};

const calendarParts = (date, timeZone = env.organizationTimezone) => {
  if (typeof date === 'string') {
    const match = DATE_ONLY.exec(date);
    if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  const parts = getZonedParts(date, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
};

const addCalendarDays = ({ year, month, day }, days) => {
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
};

export const addDays = (date, days, timeZone = env.organizationTimezone) =>
  zonedDateTimeToUtc(addCalendarDays(calendarParts(date, timeZone), days), timeZone);

export const startOfMonth = (date = new Date(), timeZone = env.organizationTimezone) => {
  const parts = calendarParts(date, timeZone);
  return zonedDateTimeToUtc({ year: parts.year, month: parts.month, day: 1 }, timeZone);
};

export const getDayOfWeek = (date, timeZone = env.organizationTimezone) => {
  const parts = calendarParts(date, timeZone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
};

export const formatInTimeZone = (date, options, timeZone = env.organizationTimezone) =>
  new Intl.DateTimeFormat('en-IN', { ...options, timeZone }).format(new Date(date));
export const startOfDay = (date = new Date(), timeZone = env.organizationTimezone) =>
  zonedDateTimeToUtc(calendarParts(date, timeZone), timeZone);

export const endOfDay = (date = new Date(), timeZone = env.organizationTimezone) => {
  const nextDay = addCalendarDays(calendarParts(date, timeZone), 1);
  return new Date(zonedDateTimeToUtc(nextDay, timeZone).getTime() - 1);
};

export const getMonthRange = (year, month, timeZone = env.organizationTimezone) => {
  const start = zonedDateTimeToUtc({ year: Number(year), month: Number(month), day: 1 }, timeZone);
  const nextMonth = Number(month) === 12
    ? { year: Number(year) + 1, month: 1, day: 1 }
    : { year: Number(year), month: Number(month) + 1, day: 1 };
  const end = new Date(zonedDateTimeToUtc(nextMonth, timeZone).getTime() - 1);
  return { start, end };
};

export const calculateDaysInclusive = (startDate, endDate, timeZone = env.organizationTimezone) => {
  const start = calendarParts(startDate, timeZone);
  const end = calendarParts(endDate, timeZone);
  const startOrdinal = Date.UTC(start.year, start.month - 1, start.day);
  const endOrdinal = Date.UTC(end.year, end.month - 1, end.day);
  return Math.floor((endOrdinal - startOrdinal) / 86400000) + 1;
};

export const isLaterThanLocalTime = (date, hour, minute = 0, timeZone = env.organizationTimezone) => {
  const parts = getZonedParts(date, timeZone);
  return parts.hour > hour || (parts.hour === hour && parts.minute > minute);
};
