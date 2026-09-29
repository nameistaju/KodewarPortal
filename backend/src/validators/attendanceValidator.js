import { z } from 'zod';
import { objectId, paginationQuerySchema } from './commonValidator.js';

export const punchSchema = z.object({
  latitude: z.any().optional(),
  longitude: z.any().optional(),
  notes: z.string().trim().max(500).optional(),
  deviceInfo: z.string().trim().optional(),
  accuracy: z.coerce.number().min(0).optional()
});

export const attendanceSettingSchema = z.object({
  officeLatitude: z.coerce.number().min(-90).max(90),
  officeLongitude: z.coerce.number().min(-180).max(180),
  allowedRadiusMeters: z.coerce.number().int().min(1).max(5000),
  autoCloseTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid autoCloseTime format. Must be HH:MM').optional()
});

export const attendanceHistoryQuerySchema = paginationQuerySchema.extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  employeeId: objectId.optional()
});

export const monthlySummaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  employeeId: objectId.optional()
});

export const adminAttendanceQuerySchema = paginationQuerySchema.extend({
  employeeId: objectId.optional(),
  search: z.string().trim().optional(),
  employeeName: z.string().trim().optional(),
  department: z.string().trim().optional(),
  date: z.coerce.date().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE']).optional(),
  format: z.enum(['csv', 'excel']).optional()
});