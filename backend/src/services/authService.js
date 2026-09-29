import Employee from '../models/Employee.js';
import RefreshToken from '../models/RefreshToken.js';
import AuditLog from '../models/AuditLog.js';
import Team from '../models/Team.js';
import { EMPLOYEE_STATUS } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import { generateTemporaryPassword } from '../utils/password.js';
import {
  createTokenId,
  getRefreshTokenExpiry,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '../utils/jwt.js';
import logger from '../utils/logger.js';

const publicEmployeeFields =
  '_id name phone email department teamId dob joinDate profilePhoto role status forcePasswordChange mustChangePassword assignedClients leaveBalances createdAt updatedAt';

const sanitizeUser = (user) => {
  const object = user.toObject ? user.toObject() : { ...user };

  delete object.password;
  delete object.passwordResetToken;
  delete object.passwordResetExpires;
  delete object.tokenVersion;

  return object;
};

const createRefreshTokenRecord = async (user, reqMeta = {}) => {
  const jti = createTokenId();
  const refreshToken = signRefreshToken(user, jti);

  await RefreshToken.create({
    employee: user._id,
    jti,
    tokenHash: hashToken(refreshToken),
    expiresAt: getRefreshTokenExpiry(),
    ipAddress: reqMeta.ipAddress,
    userAgent: reqMeta.userAgent
  });

  return refreshToken;
};

const issueTokenPair = async (user, reqMeta) => {
  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshTokenRecord(user, reqMeta);

  return { accessToken, refreshToken };
};

export const login = async ({ email, password }, reqMeta = {}) => {
  const user = await Employee.findOne({ email }).select('+password +tokenVersion +loginAttempts +lockUntil');

  if (!user) {
    logger.warn('login_failed', {
      email,
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent
    });
    throw new AppError('Invalid email or password', 401);
  }

  if (user.lockUntil && user.lockUntil > Date.now()) {
    logger.warn('login_locked_account', {
      email,
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent
    });
    const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
    throw new AppError(`Account is temporarily locked due to too many failed login attempts. Please try again in ${minutesLeft} minutes.`, 401);
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      logger.warn('account_locked', { email });
    }
    await user.save();

    logger.warn('login_failed', {
      email,
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent
    });
    throw new AppError('Invalid email or password', 401);
  }

  // Reset lockout counters on success
  if (user.loginAttempts > 0 || user.lockUntil) {
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  }

  await user.populate('teamId', 'name status description');

  if (user.status !== EMPLOYEE_STATUS.ACTIVE) {
    logger.warn('login_blocked_inactive_account', {
      userId: user._id,
      email,
      ipAddress: reqMeta.ipAddress,
      userAgent: reqMeta.userAgent
    });
    throw new AppError('This account is inactive', 403);
  }
  const { accessToken, refreshToken } = await issueTokenPair(user, reqMeta);

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user)
  };
};

export const refresh = async (refreshToken, reqMeta = {}) => {
  const decoded = verifyRefreshToken(refreshToken);

  if (decoded.type !== 'refresh') {
    throw new AppError('Invalid refresh token type', 401);
  }

  const tokenHash = hashToken(refreshToken);

  const user = await Employee.findById(decoded.sub).select('+tokenVersion');

  if (!user || user.status !== EMPLOYEE_STATUS.ACTIVE) {
    throw new AppError('User is not active', 401);
  }

  if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
    throw new AppError('Refresh token has been revoked', 401);
  }

  const nextJti = createTokenId();
  const nextRefreshToken = signRefreshToken(user, nextJti);

  const storedToken = await RefreshToken.findOneAndUpdate(
    {
      employee: decoded.sub,
      jti: decoded.jti,
      tokenHash,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() }
    },
    {
      $set: {
        revokedAt: new Date(),
        replacedByJti: nextJti
      }
    },
    { returnDocument: 'after' }
  );

  if (!storedToken) {
    throw new AppError('Refresh token is invalid or expired', 401);
  }

  await RefreshToken.create({
    employee: user._id,
    jti: nextJti,
    tokenHash: hashToken(nextRefreshToken),
    expiresAt: getRefreshTokenExpiry(),
    ipAddress: reqMeta.ipAddress,
    userAgent: reqMeta.userAgent
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken: nextRefreshToken,
    user: sanitizeUser(user)
  };
};

export const getCurrentUser = async (userId) => {
  const user = await Employee.findById(userId).select(publicEmployeeFields).populate('teamId', 'name status description');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return sanitizeUser(user);
};

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await Employee.findById(userId).select('+password +tokenVersion');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 401);
  }

  user.password = newPassword;
  user.forcePasswordChange = false;
  user.mustChangePassword = false;
  user.tokenVersion = (user.tokenVersion || 0) + 1;

  await user.save();

  await RefreshToken.updateMany(
    { employee: user._id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );

  const { accessToken, refreshToken } = await issueTokenPair(user);

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user)
  };
};

export const logout = async (userId, refreshToken = null) => {
  const user = await Employee.findById(userId).select('+tokenVersion');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save({ validateBeforeSave: false });

  const filter = { employee: userId, revokedAt: { $exists: false } };

  if (refreshToken) {
    filter.tokenHash = hashToken(refreshToken);
  }

  await RefreshToken.updateMany(filter, { $set: { revokedAt: new Date() } });
};

export const resetEmployeePassword = async (employeeId, newPassword = null, adminUser = null) => {
  const employee = await Employee.findById(employeeId).select('+tokenVersion');

  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  const passwordToUse = newPassword || generateTemporaryPassword();

  if (!passwordToUse) {
    throw new AppError('Cannot generate temporary password', 400);
  }

  employee.password = passwordToUse;
  employee.forcePasswordChange = true;
  employee.mustChangePassword = true;
  employee.tokenVersion = (employee.tokenVersion || 0) + 1;

  await employee.save();

  await RefreshToken.deleteMany({ employee: employee._id });

  if (adminUser) {
    const timestamp = new Date();
    await AuditLog.create({
      employeeEmail: employee.email,
      action: 'Password Reset',
      adminEmail: adminUser.email,
      timestamp
    });

    logger.info('password_reset_audit', {
      Employee: employee.email,
      Action: 'Password Reset',
      Admin: adminUser.email,
      Timestamp: timestamp.toISOString()
    });
  }

  return {
    employee: sanitizeUser(employee),
    temporaryPassword: passwordToUse
  };
};

