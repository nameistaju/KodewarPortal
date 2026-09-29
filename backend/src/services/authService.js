import { supabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';
import { generateTemporaryPassword } from '../utils/password.js';
import {
  createTokenId,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '../utils/jwt.js';
import { comparePassword, hashPassword, mapEmployeeFromDb } from '../utils/supabaseHelpers.js';
import logger from '../utils/logger.js';

export const login = async ({ email, password }, reqMeta = {}) => {
  const { data: userRow, error } = await supabase
    .from('employees')
    .select('*')
    .ilike('email', email.trim())
    .single();

  if (error || !userRow) {
    logger.warn('login_failed', { email, ipAddress: reqMeta.ipAddress });
    throw new AppError('Invalid email or password', 401);
  }

  if (userRow.is_active === false) {
    logger.warn('login_blocked_inactive_account', { email });
    throw new AppError('This account is inactive', 403);
  }

  const isMatch = await comparePassword(password, userRow.password_hash);
  if (!isMatch) {
    logger.warn('login_failed_password_mismatch', { email });
    throw new AppError('Invalid email or password', 401);
  }

  const user = mapEmployeeFromDb(userRow);
  const jti = createTokenId();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, jti);

  return {
    accessToken,
    refreshToken,
    user
  };
};

export const refresh = async (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);

  if (decoded.type !== 'refresh') {
    throw new AppError('Invalid refresh token type', 401);
  }

  const { data: userRow, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', decoded.sub)
    .single();

  if (error || !userRow || userRow.is_active === false) {
    throw new AppError('User is not active', 401);
  }

  const user = mapEmployeeFromDb(userRow);
  const nextJti = createTokenId();

  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user, nextJti),
    user
  };
};

export const getCurrentUser = async (userId) => {
  const { data: userRow, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !userRow) {
    throw new AppError('User not found', 404);
  }

  return mapEmployeeFromDb(userRow);
};

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const { data: userRow, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !userRow) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await comparePassword(currentPassword, userRow.password_hash);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 401);
  }

  const newHash = await hashPassword(newPassword);

  const { data: updatedRow, error: updateError } = await supabase
    .from('employees')
    .update({
      password_hash: newHash,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (updateError || !updatedRow) {
    throw new AppError('Failed to update password', 500);
  }

  const user = mapEmployeeFromDb(updatedRow);
  const jti = createTokenId();

  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user, jti),
    user
  };
};

export const logout = async () => {
  // Stateless JWT logout
  return true;
};

export const resetEmployeePassword = async (employeeId, newPassword = null) => {
  const passwordToUse = newPassword || generateTemporaryPassword();
  const newHash = await hashPassword(passwordToUse);

  const { data: updatedRow, error } = await supabase
    .from('employees')
    .update({
      password_hash: newHash,
      updated_at: new Date().toISOString()
    })
    .eq('id', employeeId)
    .select('*')
    .single();

  if (error || !updatedRow) {
    throw new AppError('Employee not found or update failed', 404);
  }

  return {
    employee: mapEmployeeFromDb(updatedRow),
    temporaryPassword: passwordToUse
  };
};
