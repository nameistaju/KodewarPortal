import { supabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';
import { hashPassword, mapEmployeeFromDb } from '../utils/supabaseHelpers.js';
import { generateTemporaryPassword } from '../utils/password.js';
import { uploadImageBuffer, deleteUploadedImage } from './uploadService.js';

export const createEmployee = async (payload, _creatorId, file) => {
  // Check if email exists
  const { data: existingEmail } = await supabase
    .from('employees')
    .select('id')
    .ilike('email', payload.email.trim())
    .maybeSingle();

  if (existingEmail) {
    throw new AppError('Employee with this email already exists', 409);
  }

  const userRole = (payload.role || 'employee').toLowerCase();
  let generatedPassword = null;
  let passwordToUse = payload.password;

  if (payload.autoGeneratePassword || !passwordToUse) {
    passwordToUse = generateTemporaryPassword();
    generatedPassword = passwordToUse;
  }

  const passwordHash = await hashPassword(passwordToUse);
  const employeeCode = payload.employeeCode || `EMP-${Date.now().toString().slice(-4)}`;

  let designationStr = payload.designation || 'Staff';
  if (file) {
    const uploadRes = await uploadImageBuffer(file, 'profile');
    if (uploadRes?.url) {
      designationStr = `${designationStr}||${uploadRes.url}||${uploadRes.publicId || ''}`;
    }
  }

  const insertData = {
    employee_code: employeeCode,
    name: payload.name,
    email: payload.email.trim().toLowerCase(),
    password_hash: passwordHash,
    department: payload.department || 'DEVELOPMENT',
    designation: designationStr,
    joining_date: payload.joiningDate || new Date().toISOString().slice(0, 10),
    role: userRole === 'admin' ? 'admin' : 'employee',
    leave_balance_casual: payload.leaveBalanceCasual ?? 12,
    leave_balance_sick: payload.leaveBalanceSick ?? 12,
    is_active: payload.status !== 'INACTIVE'
  };

  const { data: createdRow, error } = await supabase
    .from('employees')
    .insert(insertData)
    .select('*')
    .single();

  if (error || !createdRow) {
    throw new AppError(`Failed to create employee: ${error?.message || 'Unknown database error'}`, 500);
  }

  const employee = mapEmployeeFromDb(createdRow);
  const result = { employee };
  if (generatedPassword) {
    result.generatedPassword = generatedPassword;
  }

  return result;
};

export const getEmployees = async (query = {}) => {
  let builder = supabase.from('employees').select('*', { count: 'exact' });

  if (query.department) {
    builder = builder.eq('department', query.department);
  }
  if (query.role) {
    builder = builder.eq('role', query.role.toLowerCase());
  }
  if (query.status) {
    builder = builder.eq('is_active', query.status === 'ACTIVE');
  }
  if (query.search) {
    builder = builder.or(`name.ilike.%${query.search}%,email.ilike.%${query.search}%`);
  }

  const page = Number(query.page || 1);
  const limit = Number(query.limit || 25);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  builder = builder.order('name', { ascending: true }).range(from, to);

  const { data, count, error } = await builder;

  if (error) {
    throw new AppError(`Failed to fetch employees: ${error.message}`, 500);
  }

  const items = (data || []).map(mapEmployeeFromDb);
  const total = count || items.length;

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

export const getEmployeeById = async (employeeId) => {
  const { data: userRow, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .single();

  if (error || !userRow) {
    throw new AppError('Employee not found', 404);
  }

  return mapEmployeeFromDb(userRow);
};

export const updateEmployee = async (employeeId, payload, _adminId, file) => {
  const { data: existingRow } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .single();

  if (!existingRow) {
    throw new AppError('Employee not found', 404);
  }

  let cleanDesig = payload.designation || (existingRow.designation ? existingRow.designation.split('||')[0] : 'Staff');
  let currentPhotoUrl = existingRow.designation && existingRow.designation.includes('||') ? existingRow.designation.split('||')[1] : null;
  let currentPublicId = existingRow.designation && existingRow.designation.includes('||') ? existingRow.designation.split('||')[2] : null;

  if (file) {
    // Delete existing photo from Cloudinary if present
    if (currentPublicId || currentPhotoUrl) {
      await deleteUploadedImage(currentPublicId || currentPhotoUrl);
    }

    const uploadRes = await uploadImageBuffer(file, 'profile');
    if (uploadRes?.url) {
      currentPhotoUrl = uploadRes.url;
      currentPublicId = uploadRes.publicId || '';
    }
  }

  const updateData = {
    updated_at: new Date().toISOString()
  };

  if (payload.name) updateData.name = payload.name;
  if (payload.email) updateData.email = payload.email.trim().toLowerCase();
  if (payload.department) updateData.department = payload.department;

  updateData.designation = currentPhotoUrl ? `${cleanDesig}||${currentPhotoUrl}||${currentPublicId || ''}` : cleanDesig;

  if (payload.role) updateData.role = payload.role.toLowerCase() === 'admin' ? 'admin' : 'employee';
  if (payload.status !== undefined) updateData.is_active = payload.status === 'ACTIVE';
  if (payload.leaveBalanceCasual !== undefined) updateData.leave_balance_casual = Number(payload.leaveBalanceCasual);
  if (payload.leaveBalanceSick !== undefined) updateData.leave_balance_sick = Number(payload.leaveBalanceSick);

  if (payload.password) {
    updateData.password_hash = await hashPassword(payload.password);
  }

  const { data: updatedRow, error } = await supabase
    .from('employees')
    .update(updateData)
    .eq('id', employeeId)
    .select('*')
    .single();

  if (error || !updatedRow) {
    throw new AppError(`Failed to update employee: ${error?.message || 'Record not found'}`, 404);
  }

  return mapEmployeeFromDb(updatedRow);
};

export const setEmployeeStatus = async (employeeId, status) => {
  const { data: updatedRow, error } = await supabase
    .from('employees')
    .update({
      is_active: status === 'ACTIVE',
      updated_at: new Date().toISOString()
    })
    .eq('id', employeeId)
    .select('*')
    .single();

  if (error || !updatedRow) {
    throw new AppError('Employee not found', 404);
  }

  return mapEmployeeFromDb(updatedRow);
};

export const deactivateEmployee = (employeeId) => setEmployeeStatus(employeeId, 'INACTIVE');
export const activateEmployee = (employeeId) => setEmployeeStatus(employeeId, 'ACTIVE');

export const getProfile = (employeeId) => getEmployeeById(employeeId);
export const updateProfile = (employeeId, payload, file) => updateEmployee(employeeId, payload, null, file);

export const getEmployeeSecurity = async (employeeId) => {
  const emp = await getEmployeeById(employeeId);
  return {
    employeeId: emp._id,
    forcePasswordChange: false,
    mustChangePassword: false,
    twoFactorEnabled: false
  };
};

export const logoutEmployeeFromAllDevices = async (employeeId) => {
  const emp = await getEmployeeById(employeeId);
  return emp;
};

