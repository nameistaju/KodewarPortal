import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import logger from '../utils/logger.js';

const supabaseUrl = env.supabaseUrl || 'https://dummy.supabase.co';
const supabaseKey = env.supabaseServiceRoleKey || 'dummy_key';

if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
  logger.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Using fallback configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
