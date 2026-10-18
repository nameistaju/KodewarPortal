import { z } from 'zod';

export const DOCUMENT_STATUSES = [
  'NEEDS_REVIEW',
  'UNDER_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'MORE_INFO_REQUIRED',
  'PENDING',
  'VERIFIED',
  'INCOMPLETE'
];

export const DOCUMENT_CATEGORIES = [
  'RESUME',
  'IDENTITY_DOCUMENT',
  'EDUCATION_CERTIFICATE',
  'EMPLOYMENT_DOCUMENT',
  'OFFER_JOINING_DOCUMENT',
  'PHOTOGRAPH',
  'OTHER',
  'UNCLASSIFIED',
  'GOVT_ID',
  'ID_PHOTO',
  'OFFER_LETTER',
  'DEGREE_CERTIFICATE',
  'MARKSHEET'
];

export const documentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([...DOCUMENT_STATUSES, 'ALL']).optional(),
  category: z.enum([...DOCUMENT_CATEGORIES, 'ALL']).optional(),
  candidateId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['created_at', 'filename', 'status', 'reviewed_at']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const documentIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Invalid document ID format' })
});

export const updateDocumentReviewSchema = z.object({
  status: z.enum(DOCUMENT_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${DOCUMENT_STATUSES.join(', ')}` })
  }),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  reviewNotes: z.string().max(2000, 'Review notes cannot exceed 2000 characters').optional().nullable(),
  candidateId: z.string().uuid('Invalid candidate ID').optional().nullable()
});

export const linkDocumentCandidateSchema = z.object({
  candidateId: z.string().uuid('Invalid candidate ID').optional().nullable()
});
