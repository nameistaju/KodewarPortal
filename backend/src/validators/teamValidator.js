import { z } from 'zod';
import { objectId, paginationQuerySchema } from './commonValidator.js';
import { TEAM_STATUS } from '../models/Team.js';

const optionalText = (max = 1000) => z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().trim().max(max).optional()
);

export const teamIdParamsSchema = z.object({
  id: objectId
});

export const teamSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText(1000),
  status: z.enum(Object.values(TEAM_STATUS)).default(TEAM_STATUS.ACTIVE)
});

export const updateTeamSchema = teamSchema.partial();

export const teamQuerySchema = paginationQuerySchema.extend({
  status: z.enum(Object.values(TEAM_STATUS)).optional(),
  search: z.string().trim().max(120).optional()
});
