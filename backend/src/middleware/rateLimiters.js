import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import logger from '../utils/logger.js';

const rateLimitHandler = (name) => (req, res) => {
  logger.warn('rate_limit_exceeded', {
    limiter: name,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userId: req.user?._id?.toString()
  });

  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later'
  });
};

const keyGenerator = (req, res) => {
  if (req.user?._id) {
    return `user:${req.user._id.toString()}`;
  }
  return ipKeyGenerator(req, res);
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5000,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('api')
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitHandler('login')
});

export const authSensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('auth_sensitive')
});

export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('write')
});

export const attendanceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 500,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('attendance')
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 200,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('upload')
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('refresh')
});

export const trackingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 1000,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler('tracking')
});

