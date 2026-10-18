import { z } from 'zod';

export const syncMailboxSchema = z.object({
  folder: z.string().trim().min(1).max(100).default('INBOX').optional(),
  maxMessages: z.coerce.number().int().min(1).max(5000).optional(),
  batchSize: z.coerce.number().int().min(1).max(200).default(50).optional(),
  dryRun: z.coerce.boolean().default(false).optional()
});

export const emailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20).optional(),
  folder: z.string().trim().default('INBOX').optional(),
  isRead: z.preprocess((v) => {
    if (v === 'true' || v === true) return true;
    if (v === 'false' || v === false) return false;
    return undefined;
  }, z.boolean().optional()),
  processingStatus: z.enum(['PENDING', 'PROCESSED', 'FAILED', 'IGNORED']).optional(),
  category: z.string().trim().optional(),
  search: z.string().trim().max(100).optional()
});

export const emailIdParamSchema = z.object({
  id: z.string().trim().uuid('Invalid email ID format')
});

export const updateCategorySchema = z.object({
  category: z.string().trim().min(1, 'Category is required')
});

