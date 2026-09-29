import { z } from 'zod';
import { objectId, paginationQuerySchema } from './commonValidator.js';

export const announcementIdParamsSchema = z.object({
  announcementId: objectId
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(180),
  message: z.string().trim().min(5).max(5000),
  isPinned: z.coerce.boolean().optional(),
  priority: z.enum(['Urgent', 'Important', 'General']).optional(),
  visibleFrom: z.coerce.date().optional(),
  visibleUntil: z.coerce.date().optional()
});

export const updateAnnouncementSchema = announcementSchema.partial();

export const announcementQuerySchema = paginationQuerySchema.extend({
  activeOnly: z.coerce.boolean().optional()
});
