import { supabase } from '../config/supabase.js';
import { hashPassword } from './supabaseHelpers.js';
import logger from './logger.js';

export const runDevelopmentBootstrap = async () => {
  try {
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'admin123';
    const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@kodewar.com').trim().toLowerCase();

    const { data: existingAdmin } = await supabase
      .from('employees')
      .select('id, email')
      .ilike('email', adminEmail)
      .maybeSingle();

    const adminHash = await hashPassword(adminPassword);

    if (!existingAdmin) {
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
      await supabase
        .from('employees')
        .update({ name: 'KODEWAR Admin', password_hash: adminHash, is_active: true, role: 'admin' })
        .eq('id', existingAdmin.id);
      logger.info(`Updated bootstrap admin account in Supabase (${adminEmail})`);
    }

    const empPassword = process.env.BOOTSTRAP_EMPLOYEE_PASSWORD || 'yash123';
    const empEmail = (process.env.BOOTSTRAP_EMPLOYEE_EMAIL || 'yash@kodewar.com').trim().toLowerCase();

    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id, email')
      .ilike('email', empEmail)
      .maybeSingle();

    const empHash = await hashPassword(empPassword);

    if (!existingEmp) {
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
      await supabase
        .from('employees')
        .update({ name: 'Yash', password_hash: empHash, is_active: true, role: 'employee' })
        .eq('id', existingEmp.id);
      logger.info(`Updated bootstrap employee account in Supabase (${empEmail})`);
    }

    await supabase.from('employees').delete().in('name', ['SharpKode Admin', 'Demo Employee', 'Rahul Test']);
    await supabase.from('employees').delete().in('email', ['admin@sharpkode.com', 'employee@sharpkode.com', 'rahulmarketing@sharpkode.com']);
  } catch (err) {
    logger.warn('Development bootstrap skipped or encountered PGRST notice', { message: err.message });
  }
};

