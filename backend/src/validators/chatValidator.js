import { z } from 'zod';
import { objectId, paginationQuerySchema } from './commonValidator.js';

const emptyToUndefined = (val) =>
  typeof val === 'string' && val.trim() === ''
    ? undefined
    : val === null || val === 'null' || val === 'undefined'
      ? undefined
      : val;

export const createConversationSchema = z.object({
  recipientId: objectId
});

export const conversationIdParamSchema = z.object({
  conversationId: objectId
});

export const getMessagesQuerySchema = paginationQuerySchema.extend({
  page: z.preprocess((val) => (val ? Number(val) : 1), z.number().int().min(1).default(1)),
  limit: z.preprocess((val) => (val ? Number(val) : 30), z.number().int().min(1).max(100).default(30))
});

export const sendTextMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message content cannot be empty')
    .max(2000, 'Message text cannot exceed 2000 characters')
});

export const sendMediaMessageSchema = z.object({
  messageType: z.enum(['IMAGE', 'VOICE']),
  content: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  duration: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
    z.number().min(0).max(120, 'Voice note duration cannot exceed 2 minutes (120 seconds)').optional()
  )
});
