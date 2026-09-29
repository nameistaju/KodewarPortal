import mongoose from 'mongoose';
import { z } from 'zod';
import { isStrongPassword } from '../utils/password.js';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password cannot exceed 72 characters')
  .refine(isStrongPassword, {
    message:
      'Password must include uppercase, lowercase, number, and special character'
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required')
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from current password'
  });

export const resetPasswordParamsSchema = z.object({
  employeeId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'A valid employeeId is required'
  })
});

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema.optional()
});
