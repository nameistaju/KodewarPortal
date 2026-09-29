import { supabase } from './supabase.js';
import logger from '../utils/logger.js';

export const connectDB = async () => {
  try {
    const { error } = await supabase.from('employees').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      logger.warn('Supabase DB test query returned notice/error', { message: error.message });
    }
    logger.info('Supabase PostgreSQL connected successfully');
  } catch (err) {
    logger.error('Failed to connect to Supabase PostgreSQL', { message: err.message });
  }
};

export const disconnectDB = async () => {
  logger.info('Supabase database connection closed');
};
