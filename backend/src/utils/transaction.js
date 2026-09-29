import mongoose from 'mongoose';
import AppError from './AppError.js';
import { env, isProduction } from '../config/env.js';
import logger from './logger.js';

const transactionOptions = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary'
};

const transactionUnavailable = (error) =>
  error?.code === 20 || /Transaction numbers are only allowed|replica set|mongos|retryable writes/i.test(error?.message || '');

export const runInTransaction = async (work, failureMessage = 'Database transaction failed') => {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      result = await work(session);
    }, transactionOptions);
    return result;
  } catch (error) {
    if (transactionUnavailable(error) && !isProduction && env.allowNonTransactionalDevelopment) {
      logger.warn('transactions_unavailable_development_fallback', {
        message: 'MongoDB is not transaction-capable; executing without a transaction in development only.'
      });
      return work(null);
    }
    if (error?.isOperational || ['ValidationError', 'CastError'].includes(error?.name)) throw error;
    if (error?.code === 11000) {
      throw new AppError('A duplicate operation was prevented', 409, { code: 'DUPLICATE_OPERATION' });
    }
    const code = transactionUnavailable(error) ? 'TRANSACTIONS_UNAVAILABLE' : 'TRANSACTION_FAILED';
    logger.error('database_transaction_failed', {
      code,
      reason: error?.message || 'unknown'
    });
    throw new AppError(failureMessage, 503, { code });
  } finally {
    await session.endSession();
  }
};
