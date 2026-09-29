import * as authService from '../services/authService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess, sendTokenResponse } from '../utils/apiResponse.js';
import { loginLimiter } from '../middleware/rateLimiters.js';

export const login = catchAsync(async (req, res) => {
  const { accessToken, refreshToken, user } = await authService.login(req.body, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  if (typeof loginLimiter.resetKey === 'function') {
    loginLimiter.resetKey(req.ip);
  }

  return sendTokenResponse(res, 200, 'Login successful', accessToken, refreshToken, user);
});

export const refresh = catchAsync(async (req, res) => {
  const { accessToken, refreshToken, user } = await authService.refresh(
    req.body.refreshToken,
    {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }
  );

  return sendTokenResponse(
    res,
    200,
    'Token refreshed successfully',
    accessToken,
    refreshToken,
    user
  );
});

export const logout = catchAsync(async (req, res) => {
  await authService.logout(req.user._id, req.body?.refreshToken);

  return sendSuccess(res, 200, 'Logout successful');
});

export const getCurrentUser = catchAsync(async (req, res) => {
  const user = await authService.getCurrentUser(req.user._id);

  return sendSuccess(res, 200, 'Current user fetched successfully', { user });
});

export const changePassword = catchAsync(async (req, res) => {
  const { accessToken, refreshToken, user } = await authService.changePassword(
    req.user._id,
    req.body
  );

  return sendTokenResponse(
    res,
    200,
    'Password changed successfully',
    accessToken,
    refreshToken,
    user
  );
});

export const resetEmployeePassword = catchAsync(async (req, res) => {
  const result = await authService.resetEmployeePassword(
    req.params.employeeId,
    req.body?.newPassword,
    req.user
  );

  return sendSuccess(res, 200, 'Employee password reset successfully', result);
});
