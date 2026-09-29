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
  const startDateStr = String(payload.startDate || payload.start_date).slice(0, 10);
  const endDateStr = String(payload.endDate || payload.end_date).slice(0, 10);

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end.getTime() < start.getTime()) {
    throw new AppError('End date cannot be earlier than start date', 400);
  }

  const requestedDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (requestedDays > 10) {
    throw new AppError('Maximum 10 leave days can be applied per month', 400);
  }

  const reqYear = start.getFullYear();
  const reqMonth = String(start.getMonth() + 1).padStart(2, '0');
  const monthStart = `${reqYear}-${reqMonth}-01`;
  const monthEnd = `${reqYear}-${reqMonth}-31`;

  const { data: monthLeaves } = await supabase
    .from('leaves')
    .select('*')
    .eq('employee_id', employeeId)
    .in('status', ['pending', 'approved'])
    .gte('start_date', monthStart)
    .lte('start_date', monthEnd);

  let usedDaysInMonth = 0;
  (monthLeaves || []).forEach((row) => {
    const lStart = new Date(row.start_date);
    const lEnd = new Date(row.end_date);
    lStart.setHours(0, 0, 0, 0);
    lEnd.setHours(0, 0, 0, 0);
    const count = Math.floor((lEnd.getTime() - lStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    usedDaysInMonth += count;
  });

  if (usedDaysInMonth + requestedDays > 10) {
    throw new AppError(`Monthly leave limit reached (Max 10 days per month). You have already applied for ${usedDaysInMonth} day(s) this month.`, 400);
  }

  const insertData = {
    employee_id: employeeId,
    leave_type: String(payload.leaveType || payload.leave_type || 'casual').toLowerCase(),
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
    .select('*, employees!employee_id(id, name, email, department)', { count: 'exact' });

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
    .select('leave_balance_casual, leave_balance_sick, leave_balance_annual')
    .eq('id', employeeId)
    .single();

  const casual = emp?.leave_balance_casual ?? 10;
  const sick = emp?.leave_balance_sick ?? 10;
  const annual = emp?.leave_balance_annual ?? 10;

  return [
    { leaveType: 'CASUAL', allocatedDays: 10, availableDays: casual },
    { leaveType: 'SICK', allocatedDays: 10, availableDays: sick },
    { leaveType: 'ANNUAL', allocatedDays: 10, availableDays: annual }
  ];
};

export const apply = applyLeave;
export const history = getLeaveRequests;
export const approve = async (leaveId, adminId, remarks) => reviewLeaveRequest(leaveId, { status: 'approved', remarks }, adminId);
export const reject = async (leaveId, adminId, remarks) => reviewLeaveRequest(leaveId, { status: 'rejected', remarks }, adminId);

export const cancel = async (leaveId, employeeId) => {
  const { data: leaveRow } = await supabase
    .from('leaves')
    .select('*')
    .eq('id', leaveId)
    .single();

  if (!leaveRow) {
    throw new AppError('Leave request not found', 404);
  }

  if (String(leaveRow.employee_id) !== String(employeeId)) {
    throw new AppError('You can only cancel your own leave requests', 403);
  }

  if (leaveRow.status !== 'pending') {
    throw new AppError('Only pending leave requests can be cancelled', 400);
  }

  const { data: updatedRow, error } = await supabase
    .from('leaves')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', leaveId)
    .select('*')
    .single();

  if (error || !updatedRow) {
    throw new AppError('Failed to cancel leave request', 500);
  }

  return formatLeaveRecord(updatedRow);
};
