import { z } from 'zod';
import { JOB_STATUSES, EMPLOYMENT_TYPES } from '../services/hrJobService.js';

export const jobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  status: z.string().trim().optional(),
  department: z.string().trim().optional(),
  employmentType: z.string().trim().optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'title', 'department', 'status', 'openings_count']).default('created_at').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional()
});

export const jobIdParamSchema = z.object({
  id: z.string().trim().uuid('Invalid job ID format')
});

export const createJobSchema = z.object({
  title: z.string().trim().min(1, 'Job title is required').max(200),
  department: z.string().trim().min(1, 'Department is required').max(100),
  description: z.string().trim().max(10000).optional().nullable(),
  requiredSkills: z.array(z.string().trim().max(50)).max(50).optional().default([]),
  qualifications: z.string().trim().max(5000).optional().nullable(),
  location: z.string().trim().max(100).default('Remote').optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).default('FULL_TIME').optional(),
  openingsCount: z.coerce.number().int().min(1).default(1).optional(),
  hiringManager: z.string().trim().max(200).optional().nullable(),
  status: z.enum(JOB_STATUSES).default('OPEN').optional(),
  jobCode: z.string().trim().max(50).optional().nullable()
});

export const updateJobSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  department: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(10000).optional().nullable(),
  requiredSkills: z.array(z.string().trim().max(50)).max(50).optional(),
  qualifications: z.string().trim().max(5000).optional().nullable(),
  location: z.string().trim().max(100).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  openingsCount: z.coerce.number().int().min(1).optional(),
  hiringManager: z.string().trim().max(200).optional().nullable(),
  status: z.enum(JOB_STATUSES).optional()
});
