import { z } from 'zod';

export const objectId = z.string().trim().min(1, 'A valid record ID is required');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().trim().optional(),
  search: z.string().trim().optional()
});

export const idParamsSchema = z.object({
  id: objectId
});
