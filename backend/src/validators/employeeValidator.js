import { z } from 'zod';
import { DEPARTMENTS, EMPLOYEE_STATUS, ROLES } from '../constants/index.js';
import { objectId, paginationQuerySchema } from './commonValidator.js';

const profilePhotoSchema = z
  .object({
    url: z.string().url().optional(),
    publicId: z.string().trim().optional()
  })
  .optional();

export const employeeIdParamsSchema = z.object({
  employeeId: objectId
});

export const employeeQuerySchema = paginationQuerySchema.extend({
  department: z.enum(Object.values(DEPARTMENTS)).optional(),
  status: z.enum(Object.values(EMPLOYEE_STATUS)).optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  teamId: objectId.optional()
});

const passwordComplexitySchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .refine((val) => /[A-Z]/.test(val), 'Password must contain at least one uppercase letter')
  .refine((val) => /[a-z]/.test(val), 'Password must contain at least one lowercase letter')
  .refine((val) => /[0-9]/.test(val), 'Password must contain at least one number')
  .refine((val) => /[^A-Za-z0-9]/.test(val), 'Password must contain at least one special character');

const employeeBaseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(20).optional(),
  email: z.string().trim().toLowerCase().email(),
  department: z.enum(Object.values(DEPARTMENTS)).optional(),
  dob: z.coerce.date().optional(),
  joinDate: z.coerce.date().optional(),
  role: z.enum(Object.values(ROLES)).default(ROLES.EMPLOYEE),
  teamId: z.preprocess((value) => (value === '' || value === null ? undefined : value), objectId.optional()),
  status: z.enum(Object.values(EMPLOYEE_STATUS)).optional(),
  profilePhoto: profilePhotoSchema,
  assignedClients: z.array(objectId).optional(),
  autoGeneratePassword: z.boolean().optional(),
  tracksAttendance: z.boolean().optional(),
  password: passwordComplexitySchema.optional()
});

export const createEmployeeSchema = employeeBaseSchema.refine((data) => data.autoGeneratePassword || data.password, {
  path: ['password'],
  message: 'Password is required when auto-generation is disabled'
});

export const updateEmployeeSchema = employeeBaseSchema
  .partial()
  .omit({ email: true, password: true })
  .extend({
    assignedClients: z.array(objectId).optional(),
    password: passwordComplexitySchema.optional(),
    forcePasswordChange: z.boolean().optional()
  });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  profilePhoto: profilePhotoSchema
});

