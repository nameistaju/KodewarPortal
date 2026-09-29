import Employee from '../models/Employee.js';
import Leave from '../models/Leave.js';
import { LEAVE_TYPES, REQUEST_STATUS } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import { calculateDaysInclusive, endOfDay, startOfDay } from '../utils/date.js';
import { paginated } from '../utils/query.js';
import logger from '../utils/logger.js';
import { runInTransaction } from '../utils/transaction.js';

export const apply = async (employeeId, payload) => {
  const { leaveType, startDate, endDate, reason } = payload;

  // 1. Employee existence check
  if (!employeeId) {
    logger.error('Leave application validation failed: employeeId is missing');
    throw new AppError('User context is missing', 401);
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    logger.error('Leave application validation failed: Employee not found', { employeeId });
    throw new AppError('Employee not found', 404);
  }

  // 2. Leave type enum validation
  if (!Object.values(LEAVE_TYPES).includes(leaveType)) {
    logger.error('Leave application validation failed: Invalid leaveType', {
      employeeId,
      leaveType,
      allowedTypes: Object.values(LEAVE_TYPES)
    });
    throw new AppError(`Invalid leave type: ${leaveType}`, 400);
  }

  // 3. Valid date formatting and ranges
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    logger.error('Leave application validation failed: Invalid date formats', {
      employeeId,
      startDate,
      endDate
    });
    throw new AppError('Invalid start date or end date format', 400);
  }

  if (end < start) {
    logger.error('Leave application validation failed: End date is before start date', {
      employeeId,
      startDate,
      endDate
    });
    throw new AppError('End date must be greater than or equal to start date', 400);
  }

  // 4. Leave balances existence check
  if (!employee.leaveBalances || !Array.isArray(employee.leaveBalances)) {
    logger.error('Leave application validation failed: leaveBalances array is missing', { employeeId });
    throw new AppError('Leave balances not initialized for this employee', 400);
  }

  const balance = employee.leaveBalances.find((b) => b.type === leaveType);
  if (!balance) {
    logger.error('Leave application validation failed: leave balance for type not found', {
      employeeId,
      leaveType
    });
    throw new AppError(`Leave balance for type ${leaveType} not found`, 400);
  }

  const totalDays = calculateDaysInclusive(startDate, endDate);

  // 5. Sufficient balance check
  const remaining = balance.allocated - balance.used;
  if (remaining < totalDays) {
    logger.error('Leave application validation failed: Insufficient leave balance', {
      employeeId,
      leaveType,
      requestedDays: totalDays,
      availableDays: remaining
    });
    throw new AppError(`Insufficient leave balance. Requested: ${totalDays}, Available: ${remaining}`, 400);
  }

  // 6. Overlapping request check
  const overlapping = await Leave.findOne({
    employee: employeeId,
    status: { $in: [REQUEST_STATUS.PENDING, REQUEST_STATUS.APPROVED] },
    $or: [
      { startDate: { $lte: end }, endDate: { $gte: start } }
    ]
  });

  if (overlapping) {
    logger.error('Leave application validation failed: Overlapping request exists', {
      employeeId,
      startDate,
      endDate,
      overlappingLeaveId: overlapping._id
    });
    throw new AppError('Leave request overlaps with an existing pending or approved request', 400);
  }

  try {
    const leave = await Leave.create({
      ...payload,
      startDate: start,
      endDate: end,
      employee: employeeId,
      totalDays
    });

    logger.info('Leave request created successfully', {
      leaveId: leave._id,
      employeeId,
      leaveType,
      totalDays
    });

    return leave;
  } catch (error) {
    logger.error('Leave model validation or creation failed', {
      employeeId,
      leaveType,
      startDate,
      endDate,
      error: error.message,
      stack: error.stack
    });

    if (error.name === 'ValidationError') {
      throw error; // normalizeError will format it and set status 400
    }
    if (error?.isOperational) throw error;
    if (error?.code === 11000) throw new AppError('A duplicate leave request was prevented', 409);
    throw new AppError('Leave request could not be saved. Please try again.', 503);
  }
};

export const cancel = async (leaveId, employeeId, reason) => {
  const leave = await Leave.findOneAndUpdate(
    { _id: leaveId, employee: employeeId, status: REQUEST_STATUS.PENDING },
    {
      $set: {
        status: REQUEST_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason
      }
    },
    { returnDocument: 'after', runValidators: true }
  );

  if (!leave) {
    const exists = await Leave.exists({ _id: leaveId, employee: employeeId });
    throw new AppError(exists ? 'Only pending leave can be cancelled' : 'Leave request not found', exists ? 409 : 404);
  }
  return leave;
};

export const history = (requestUser, query) => {
  const filter = {};

  if (requestUser.role === 'EMPLOYEE') filter.employee = requestUser._id;
  if (requestUser.role === 'ADMIN' && query.employeeId) filter.employee = query.employeeId;
  if (query.status) filter.status = query.status;
  if (query.leaveType) filter.leaveType = query.leaveType;
  if (query.from || query.to) {
    filter.startDate = {};
    if (query.from) filter.startDate.$gte = startOfDay(query.from);
    if (query.to) filter.startDate.$lte = endOfDay(query.to);
  }

  return paginated(Leave, filter, query, {
    defaultSort: '-startDate',
    populate: [
      { path: 'employee', select: 'name email department leaveBalances' },
      { path: 'reviewedBy', select: 'name email' }
    ]
  });
};

export const approve = async (leaveId, adminId, remarks) => {
  const leave = await runInTransaction(async (session) => {
    const pending = await Leave.findOne({ _id: leaveId, status: REQUEST_STATUS.PENDING }).session(session);
    if (!pending) {
      const exists = await Leave.exists({ _id: leaveId }).session(session);
      throw new AppError(exists ? 'Leave request already reviewed' : 'Leave request not found', exists ? 409 : 404);
    }

    const employee = await Employee.findById(pending.employee).session(session);
    if (!employee) throw new AppError('Employee not found', 404);
    const balance = employee.leaveBalances.find((item) => item.type === pending.leaveType);
    if (!balance) throw new AppError('Leave balance is not configured for this leave type', 409);
    if (balance.allocated - balance.used < pending.totalDays) throw new AppError('Insufficient leave balance at approval time', 409);

    balance.used += pending.totalDays;
    await employee.save({ session });

    pending.status = REQUEST_STATUS.APPROVED;
    pending.reviewedBy = adminId;
    pending.reviewedAt = new Date();
    pending.reviewRemarks = remarks;
    await pending.save({ session });
    return pending;
  }, 'Leave approval could not be committed safely');

  return leave.populate([
    { path: 'employee', select: 'name email department leaveBalances' },
    { path: 'reviewedBy', select: 'name email' }
  ]);
};
export const reject = async (leaveId, adminId, remarks) => {
  const leave = await Leave.findOneAndUpdate(
    { _id: leaveId, status: REQUEST_STATUS.PENDING },
    {
      $set: {
        status: REQUEST_STATUS.REJECTED,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewRemarks: remarks
      }
    },
    { returnDocument: 'after', runValidators: true }
  );

  if (!leave) {
    const exists = await Leave.exists({ _id: leaveId });
    throw new AppError(exists ? 'Leave request already reviewed' : 'Leave request not found', exists ? 409 : 404);
  }

  return leave.populate([
    { path: 'employee', select: 'name email department leaveBalances' },
    { path: 'reviewedBy', select: 'name email' }
  ]);
};
