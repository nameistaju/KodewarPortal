import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import AppError from './AppError.js';
import { env } from '../config/env.js';

const getJwtSecret = () => {
  if (!env.jwtSecret) {
    throw new AppError('JWT_SECRET is required', 500);
  }

  return env.jwtSecret;
};

const getRefreshSecret = () => {
  if (!env.jwtRefreshSecret) {
    throw new AppError('JWT_REFRESH_SECRET is required', 500);
  }

  return env.jwtRefreshSecret;
};

export const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
      type: 'access'
    },
    getJwtSecret(),
    {
      expiresIn: env.jwtExpiresIn
    }
  );

export const signRefreshToken = (user, jti) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      tokenVersion: user.tokenVersion || 0,
      jti,
      type: 'refresh'
    },
    getRefreshSecret(),
    {
      expiresIn: env.jwtRefreshExpiresIn
    }
  );

export const signToken = signAccessToken;

export const verifyToken = (token) => jwt.verify(token, getJwtSecret());

export const verifyRefreshToken = (token) => jwt.verify(token, getRefreshSecret());

export const createTokenId = () => crypto.randomUUID();

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const getRefreshTokenExpiry = () => {
  const value = env.jwtRefreshExpiresIn;
  const match = /^(\d+)([smhd])$/.exec(value);

  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return new Date(Date.now() + amount * multipliers[unit]);
};
