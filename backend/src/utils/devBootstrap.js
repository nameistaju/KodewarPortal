import { supabase } from '../config/supabase.js';
import { hashPassword } from './supabaseHelpers.js';
import logger from './logger.js';

export const runDevelopmentBootstrap = async () => {
  try {
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeThisAdminPasswordImmediately';
    const adminEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@sharpkode.com').trim().toLowerCase();

    const { data: existingAdmin } = await supabase
      .from('employees')
      .select('id, email')
      .ilike('email', adminEmail)
      .maybeSingle();

    const adminHash = await hashPassword(adminPassword);

    if (!existingAdmin) {
      await supabase.from('employees').insert({
        employee_code: 'EMP-0001',
        name: 'SharpKode Admin',
        email: adminEmail,
        password_hash: adminHash,
        department: 'ADMIN',
        designation: 'Administrator',
        joining_date: '2023-01-01',
        role: 'admin',
        leave_balance_casual: 12,
        leave_balance_sick: 12,
        is_active: true
      });
      logger.info(`Created bootstrap admin account in Supabase (${adminEmail})`);
    } else {
      // Update password hash to ensure admin can log in with current configured password
      await supabase
        .from('employees')
        .update({ password_hash: adminHash, is_active: true })
        .eq('id', existingAdmin.id);
      logger.info(`Updated bootstrap admin password in Supabase (${adminEmail})`);
    }

    const empPassword = process.env.BOOTSTRAP_EMPLOYEE_PASSWORD || 'ChangeThisEmployeePasswordImmediately';
    const empEmail = (process.env.BOOTSTRAP_EMPLOYEE_EMAIL || 'employee@sharpkode.com').trim().toLowerCase();

    const { data: existingEmp } = await supabase
      .from('employees')
      .select('id, email')
      .ilike('email', empEmail)
      .maybeSingle();

    const empHash = await hashPassword(empPassword);

    if (!existingEmp) {
      // Check if rahulmarketing@sharpkode.com exists and update its email to empEmail
      const { data: rahulEmp } = await supabase
        .from('employees')
        .select('id')
        .ilike('email', 'rahulmarketing@sharpkode.com')
        .maybeSingle();

      if (rahulEmp) {
        await supabase
          .from('employees')
          .update({ email: empEmail, password_hash: empHash, is_active: true })
          .eq('id', rahulEmp.id);
        logger.info(`Updated existing employee email to (${empEmail})`);
      } else {
        const uniqueCode = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
        await supabase.from('employees').insert({
          employee_code: uniqueCode,
          name: 'Demo Employee',
          email: empEmail,
          password_hash: empHash,
          department: 'DEVELOPMENT',
          designation: 'Software Developer',
          joining_date: '2023-01-01',
          role: 'employee',
          leave_balance_casual: 12,
          leave_balance_sick: 12,
          is_active: true
        });
        logger.info(`Created bootstrap employee account in Supabase (${empEmail})`);
      }
    } else {
      await supabase
        .from('employees')
        .update({ password_hash: empHash, is_active: true })
        .eq('id', existingEmp.id);
      logger.info(`Updated bootstrap employee password in Supabase (${empEmail})`);
    }
  } catch (err) {
    logger.warn('Development bootstrap skipped or encountered PGRST notice', { message: err.message });
  }
};

