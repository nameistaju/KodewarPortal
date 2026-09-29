import mongoose from 'mongoose';
import { env, isProduction } from './env.js';
import logger from '../utils/logger.js';

export const connectDB = async () => {
  const mongoUri = env.mongoUri;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  mongoose.set('strictQuery', true);

  const connection = await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
    autoIndex: !isProduction
  });

  logger.info('MongoDB connected', {
    host: connection.connection.host,
    database: connection.connection.name
  });

  process.nextTick(async () => {
    try {
      if (mongoose.models.Attendance) {
        await mongoose.models.Attendance.syncIndexes();
        logger.info('Mongoose Attendance unique indexes synchronized');
      }
    } catch (syncError) {
      logger.error('Mongoose unique index synchronization failed', { error: syncError.message });
    }
  });

  return connection;
};

export const disconnectDB = () => mongoose.connection.close(false);
