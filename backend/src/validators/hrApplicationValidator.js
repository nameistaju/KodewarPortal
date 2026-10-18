import { z } from 'zod';
import { APPLICATION_STATUSES, APPLICATION_SOURCES } from '../services/hrApplicationService.js';

export const applicationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  status: z.string().trim().optional(),
  source: z.string().trim().optional(),
  jobId: z.string().trim().optional(),
  candidateId: z.string().trim().optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['applied_at', 'created_at', 'updated_at', 'status', 'rating']).default('applied_at').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});

export const applicationIdParamSchema = z.object({
  id: z.string().trim().uuid('Invalid application ID format')
});

export const createApplicationSchema = z.object({
  candidateId: z.string().trim().uuid('Invalid candidate ID format'),
  jobId: z.string().trim().uuid('Invalid job ID format').optional().nullable(),
  source: z.enum(APPLICATION_SOURCES).default('EMAIL').optional(),
  sourceDetails: z.string().trim().max(255).optional().nullable(),
  status: z.enum(APPLICATION_STATUSES).default('APPLIED').optional(),
  emailId: z.string().trim().uuid('Invalid email ID format').optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  allowDuplicate: z.coerce.boolean().default(false).optional()
});

export const updateApplicationSchema = z.object({
  jobId: z.string().trim().uuid('Invalid job ID format').optional().nullable(),
  source: z.enum(APPLICATION_SOURCES).optional(),
  sourceDetails: z.string().trim().max(255).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable()
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${APPLICATION_STATUSES.join(', ')}` })
  }),
  reason: z.string().trim().max(500).optional()
});

export const createApplicationFromEmailSchema = z.object({
  emailId: z.string().trim().uuid('Invalid email ID format'),
  candidateId: z.string().trim().uuid('Invalid candidate ID format').optional().nullable(),
  candidateData: z.object({
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional().nullable(),
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().max(50).optional().nullable(),
    targetRole: z.string().trim().max(100).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable()
  }).optional(),
  jobId: z.string().trim().uuid('Invalid job ID format').optional().nullable(),
  source: z.enum(APPLICATION_SOURCES).default('EMAIL').optional(),
  sourceDetails: z.string().trim().max(255).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  allowDuplicate: z.coerce.boolean().default(false).optional()
});
