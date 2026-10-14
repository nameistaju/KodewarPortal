import { supabase } from '../config/supabase.js';
import { hashPassword } from './supabaseHelpers.js';
import logger from './logger.js';

import { isProduction } from '../config/env.js';

export const runDevelopmentBootstrap = async () => {
  try {
    if (isProduction && process.env.ENABLE_BOOTSTRAP_IN_PRODUCTION !== 'true') {
      logger.info('Development bootstrap skipped in production mode');
      return;
    }

    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'admin123';
    const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@kodewar.com').trim().toLowerCase();

    const { data: existingAdmin } = await supabase
      .from('employees')
      .select('id, email')
      .ilike('email', adminEmail)
      .maybeSingle();

    if (!existingAdmin) {
      const adminHash = await hashPassword(adminPassword);
      await supabase.from('employees').insert({
        employee_code: 'EMP-0001',
        name: 'KODEWAR Admin',
        email: adminEmail,
        password_hash: adminHash,
        department: 'ADMIN',
        designation: 'Administrator',
        joining_date: '2024-01-01',
        role: 'admin',
        leave_balance_casual: 12,
        leave_balance_sick: 12,
        is_active: true
      });
      logger.info(`Created bootstrap admin account in Supabase (${adminEmail})`);
    } else {
      logger.info(`Bootstrap admin account already exists; preserving existing credentials (${adminEmail})`);
    }

    const empPassword = process.env.BOOTSTRAP_EMPLOYEE_PASSWORD || 'yash123';
    const empEmail = (process.env.BOOTSTRAP_EMPLOYEE_EMAIL || 'yash@kodewar.com').trim().toLowerCase();

    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id, email')
      .ilike('email', empEmail)
      .maybeSingle();

    if (!existingEmp) {
      const empHash = await hashPassword(empPassword);
      await supabase.from('employees').insert({
        employee_code: 'EMP-0002',
        name: 'Yash',
        email: empEmail,
        password_hash: empHash,
        department: 'DEVELOPMENT',
        designation: 'Software Developer',
        joining_date: '2026-09-29',
        role: 'employee',
        leave_balance_casual: 12,
        leave_balance_sick: 12,
        is_active: true
      });
      logger.info(`Created bootstrap employee account in Supabase (${empEmail})`);
    } else {
      logger.info(`Bootstrap employee account already exists; preserving existing credentials (${empEmail})`);
    }

    // Optional bootstrap HR user if configured
    const hrEmail = (process.env.BOOTSTRAP_HR_EMAIL || 'hr@kodewar.com').trim().toLowerCase();
    const hrPassword = process.env.BOOTSTRAP_HR_PASSWORD || 'hr123456';

    const { data: existingHr } = await supabase
      .from('employees')
      .select('id, email')
      .ilike('email', hrEmail)
      .maybeSingle();

    if (!existingHr && process.env.BOOTSTRAP_CREATE_HR === 'true') {
      const hrHash = await hashPassword(hrPassword);
      await supabase.from('employees').insert({
        employee_code: 'EMP-0003',
        name: 'KODEWAR HR',
        email: hrEmail,
        password_hash: hrHash,
        department: 'HR',
        designation: 'HR Specialist',
        joining_date: '2026-10-01',
        role: 'hr',
        leave_balance_casual: 12,
        leave_balance_sick: 12,
        is_active: true
      });
      logger.info(`Created bootstrap HR account in Supabase (${hrEmail})`);
    }

    await supabase.from('employees').delete().in('name', ['SharpKode Admin', 'Demo Employee', 'Rahul Test']);
    await supabase.from('employees').delete().in('email', ['admin@sharpkode.com', 'employee@sharpkode.com', 'rahulmarketing@sharpkode.com']);
  } catch (err) {
    logger.warn('Development bootstrap skipped or encountered PGRST notice', { message: err.message });
  }
};

