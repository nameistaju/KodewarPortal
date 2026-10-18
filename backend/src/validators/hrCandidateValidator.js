import { z } from 'zod';
import { CANDIDATE_STATUSES, CANDIDATE_SOURCES } from '../services/hrCandidateService.js';

export const candidateQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  status: z.string().trim().optional(),
  source: z.string().trim().optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'full_name', 'email', 'status', 'rating', 'target_role']).default('created_at').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});

export const candidateIdParamSchema = z.object({
  id: z.string().trim().uuid('Invalid candidate ID format')
});

export const createCandidateSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email('Invalid email address').max(255),
  phone: z.string().trim().max(50).optional().nullable(),
  source: z.enum(CANDIDATE_SOURCES).default('OTHER').optional(),
  sourceDetails: z.string().trim().max(255).optional().nullable(),
  targetRole: z.string().trim().max(100).optional().nullable(),
  experienceYears: z.coerce.number().min(0).max(50).optional().nullable(),
  currentCompany: z.string().trim().max(150).optional().nullable(),
  currentTitle: z.string().trim().max(150).optional().nullable(),
  status: z.enum(CANDIDATE_STATUSES).default('APPLIED').optional(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  tags: z.array(z.string().trim().max(50)).max(20).optional().default([]),
  allowDuplicate: z.coerce.boolean().default(false).optional()
});

export const updateCandidateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email('Invalid email address').max(255).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  source: z.enum(CANDIDATE_SOURCES).optional(),
  sourceDetails: z.string().trim().max(255).optional().nullable(),
  targetRole: z.string().trim().max(100).optional().nullable(),
  experienceYears: z.coerce.number().min(0).max(50).optional().nullable(),
  currentCompany: z.string().trim().max(150).optional().nullable(),
  currentTitle: z.string().trim().max(150).optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  tags: z.array(z.string().trim().max(50)).max(20).optional()
});

export const updateStatusSchema = z.object({
  status: z.enum(CANDIDATE_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${CANDIDATE_STATUSES.join(', ')}` })
  }),
  reason: z.string().trim().max(500).optional()
});

export const linkEmailSchema = z.object({
  emailId: z.string().trim().uuid('Invalid email ID format'),
  isPrimaryApplication: z.coerce.boolean().default(false).optional(),
  notes: z.string().trim().max(500).optional()
});

export const unlinkEmailParamSchema = z.object({
  id: z.string().trim().uuid('Invalid candidate ID format'),
  emailId: z.string().trim().uuid('Invalid email ID format')
});

export const createFromEmailSchema = z.object({
  emailId: z.string().trim().uuid('Invalid email ID format'),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email('Invalid email address').max(255).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  source: z.enum(CANDIDATE_SOURCES).default('EMAIL').optional(),
  sourceDetails: z.string().trim().max(255).optional().nullable(),
  targetRole: z.string().trim().max(100).optional().nullable(),
  status: z.enum(CANDIDATE_STATUSES).default('APPLIED').optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  allowDuplicate: z.coerce.boolean().default(false).optional()
});
