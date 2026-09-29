import { supabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';

const formatLeaveRecord = (row, employeeData = null) => {
  if (!row) return null;

  return {
    _id: String(row.id),
    id: String(row.id),
    employee: employeeData || row.employee_id,
    leaveType: (row.leave_type || 'CASUAL').toUpperCase(),
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason || '',
    status: (row.status || 'PENDING').toUpperCase(),
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export const applyLeave = async (employeeId, payload) => {
  const startDateStr = String(payload.startDate).slice(0, 10);
  const endDateStr = String(payload.endDate).slice(0, 10);

  if (new Date(endDateStr) < new Date(startDateStr)) {
    throw new AppError('End date cannot be earlier than start date', 400);
  }

  const insertData = {
    employee_id: employeeId,
    leave_type: String(payload.leaveType || 'casual').toLowerCase(),
    start_date: startDateStr,
    end_date: endDateStr,
    reason: payload.reason || '',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: createdRow, error } = await supabase
    .from('leaves')
    .insert(insertData)
    .select('*')
    .single();

  if (error || !createdRow) {
    throw new AppError(`Failed to submit leave request: ${error?.message || 'Database error'}`, 500);
  }

  return formatLeaveRecord(createdRow);
};

export const getLeaveRequests = async (requestUser, query = {}) => {
  let builder = supabase
    .from('leaves')
    .select('*, employees!inner(id, name, email, department)', { count: 'exact' });

  if (requestUser.role === 'EMPLOYEE') {
    builder = builder.eq('employee_id', requestUser.id || requestUser._id);
  } else if (requestUser.role === 'ADMIN' && query.employeeId) {
    builder = builder.eq('employee_id', query.employeeId);
  }

  if (query.status) {
    builder = builder.eq('status', query.status.toLowerCase());
  }

  const page = Number(query.page || 1);
  const limit = Number(query.limit || 25);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  builder = builder.order('created_at', { ascending: false }).range(from, to);

  const { data, count, error } = await builder;

  if (error) {
    throw new AppError(`Failed to fetch leave requests: ${error.message}`, 500);
  }

  const items = (data || []).map((row) => formatLeaveRecord(row, row.employees));
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

export const reviewLeaveRequest = async (leaveId, { status }, adminId) => {
  const targetStatus = String(status).toLowerCase();
  if (!['approved', 'rejected'].includes(targetStatus)) {
    throw new AppError('Invalid leave status. Must be approved or rejected.', 400);
  }

  const { data: leaveRow } = await supabase
    .from('leaves')
    .select('*')
    .eq('id', leaveId)
    .single();

  if (!leaveRow) {
    throw new AppError('Leave request not found', 404);
  }

  const { data: updatedRow, error } = await supabase
    .from('leaves')
    .update({
      status: targetStatus,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', leaveId)
    .select('*')
    .single();

  if (error || !updatedRow) {
    throw new AppError('Failed to review leave request', 500);
  }

  // If approved, calculate days and deduct balance
  if (targetStatus === 'approved') {
    const start = new Date(leaveRow.start_date);
    const end = new Date(leaveRow.end_date);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);

    const { data: emp } = await supabase
      .from('employees')
      .select('leave_balance_casual, leave_balance_sick')
      .eq('id', leaveRow.employee_id)
      .single();

    if (emp) {
      const isCasual = (leaveRow.leave_type || '').toLowerCase() === 'casual';
      const currentCasual = emp.leave_balance_casual ?? 12;
      const currentSick = emp.leave_balance_sick ?? 12;

      await supabase
        .from('employees')
        .update({
          leave_balance_casual: isCasual ? Math.max(0, currentCasual - days) : currentCasual,
          leave_balance_sick: !isCasual ? Math.max(0, currentSick - days) : currentSick,
          updated_at: new Date().toISOString()
        })
        .eq('id', leaveRow.employee_id);
    }
  }

  return formatLeaveRecord(updatedRow);
};

export const getLeaveBalances = async (employeeId) => {
  const { data: emp } = await supabase
    .from('employees')
    .select('leave_balance_casual, leave_balance_sick')
    .eq('id', employeeId)
    .single();

  return [
    { leaveType: 'CASUAL', allocatedDays: 12, availableDays: emp?.leave_balance_casual ?? 12 },
    { leaveType: 'SICK', allocatedDays: 12, availableDays: emp?.leave_balance_sick ?? 12 }
  ];
};
