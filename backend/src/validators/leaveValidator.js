import { z } from 'zod';
import { LEAVE_TYPES, REQUEST_STATUS } from '../constants/index.js';
import { objectId, paginationQuerySchema } from './commonValidator.js';

export const leaveIdParamsSchema = z.object({
  leaveId: objectId
});

export const applyLeaveSchema = z
  .object({
    leaveType: z.enum(Object.values(LEAVE_TYPES)),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().min(5).max(1000)
  })
  .refine((data) => data.endDate >= data.startDate, {
    path: ['endDate'],
    message: 'End date must be greater than or equal to start date'
  });

export const cancelLeaveSchema = z.object({
  cancellationReason: z.string().trim().max(500).optional()
});

export const reviewLeaveSchema = z.object({
  reviewRemarks: z.string().trim().max(1000).optional()
});

export const leaveQuerySchema = paginationQuerySchema.extend({
  status: z.enum(Object.values(REQUEST_STATUS)).optional(),
  leaveType: z.enum(Object.values(LEAVE_TYPES)).optional(),
  employeeId: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});
