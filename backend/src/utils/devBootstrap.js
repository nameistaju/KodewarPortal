import { supabase } from '../config/supabase.js';
import { hashPassword } from './supabaseHelpers.js';
import logger from './logger.js';

export const runDevelopmentBootstrap = async () => {
  try {
    const { data: existingAdmin } = await supabase
      .from('employees')
      .select('id, email')
      .ilike('email', 'admin@sharpkode.com')
      .maybeSingle();

    if (!existingAdmin) {
      const adminPasswordHash = await hashPassword('Admin@SharpKode2026');
      await supabase.from('employees').insert({
        employee_code: 'EMP-0001',
        name: 'SharpKode Admin',
        email: 'admin@sharpkode.com',
        password_hash: adminPasswordHash,
        department: 'ADMIN',
        designation: 'Administrator',
        joining_date: '2023-01-01',
        role: 'admin',
        leave_balance_casual: 12,
        leave_balance_sick: 12,
        is_active: true
      });
      logger.info('Created bootstrap admin account in Supabase (admin@sharpkode.com)');
    }

    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id, email')
      .ilike('email', 'rahulmarketing@sharpkode.com')
      .maybeSingle();

    if (!existingEmployee) {
      const empPasswordHash = await hashPassword('Employee@SharpKode2026');
      await supabase.from('employees').insert({
        employee_code: 'EMP-0002',
        name: 'Rahul Test',
        email: 'rahulmarketing@sharpkode.com',
        password_hash: empPasswordHash,
        department: 'MARKETING',
        designation: 'Executive',
        joining_date: '2023-01-01',
        role: 'employee',
        leave_balance_casual: 12,
        leave_balance_sick: 12,
        is_active: true
      });
      logger.info('Created bootstrap employee account in Supabase (rahulmarketing@sharpkode.com)');
    }
  } catch (err) {
    logger.warn('Development bootstrap skipped or encountered PGRST notice', { message: err.message });
  }
};
