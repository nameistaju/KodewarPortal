import { z } from 'zod';
import { objectId, paginationQuerySchema } from './commonValidator.js';

export const holidayIdParamsSchema = z.object({
  holidayId: objectId
});

export const holidaySchema = z.object({
  name: z.string().trim().min(2).max(160),
  date: z.coerce.date(),
  description: z.string().trim().max(500).optional(),
  isOptional: z.coerce.boolean().optional()
});

export const updateHolidaySchema = holidaySchema.partial();

export const holidayQuerySchema = paginationQuerySchema.extend({
  year: z.coerce.number().int().min(2000).max(2100).optional()
});
