import Employee from '../models/Employee.js';
import { EMPLOYEE_STATUS } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { verifyToken } from '../utils/jwt.js';

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
};

export const protect = catchAsync(async (req, _res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next(new AppError('Authentication token is required', 401));
  }

  const decoded = verifyToken(token);

  if (decoded.type !== 'access') {
    return next(new AppError('Invalid authentication token type', 401));
  }

  const user = await Employee.findById(decoded.sub).select('+tokenVersion');

  if (!user) {
    return next(new AppError('User belonging to this token no longer exists', 401));
  }

  if (user.status !== EMPLOYEE_STATUS.ACTIVE) {
    return next(new AppError('This account is inactive', 403));
  }

  if (user.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password was changed after this token was issued', 401));
  }

  if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
    return next(new AppError('Authentication token has been revoked', 401));
  }

  const allowedPaths = ['/api/auth/change-password', '/api/auth/me', '/api/auth/logout'];
  const reqPath = req.originalUrl?.split('?')[0];

  if ((user.mustChangePassword || user.forcePasswordChange) && !allowedPaths.includes(reqPath)) {
    return next(
      new AppError('Password change is required before accessing application resources', 403, {
        code: 'MUST_CHANGE_PASSWORD'
      })
    );
  }

  req.user = user;
  next();
});
