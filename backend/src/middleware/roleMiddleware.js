import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

export const authorizeRoles =
  (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication is required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('authorization_denied', {
        userId: req.user._id,
        role: req.user.role,
        allowedRoles,
        method: req.method,
        path: req.originalUrl
      });
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    next();
  };
