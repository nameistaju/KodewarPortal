import * as leaveService from '../services/leaveService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';

export const apply = catchAsync(async (req, res) => {
  if (!req.user || !req.user._id) {
    logger.error('Leave application failed: req.user or req.user._id is missing');
    throw new AppError('User not authenticated', 401);
  }

  logger.info('Leave application request received', {
    employeeId: req.user._id,
    leaveType: req.body?.leaveType,
    startDate: req.body?.startDate,
    endDate: req.body?.endDate
  });

  const leave = await leaveService.apply(req.user._id, req.body);
  sendSuccess(res, 201, 'Leave request submitted successfully', { leave });
});

export const cancel = catchAsync(async (req, res) => {
  const leave = await leaveService.cancel(
    req.params.leaveId,
    req.user._id,
    req.body.cancellationReason
  );
  sendSuccess(res, 200, 'Leave request cancelled successfully', { leave });
});

export const history = catchAsync(async (req, res) => {
  const result = await leaveService.history(req.user, req.validatedQuery || req.query);
  sendSuccess(res, 200, 'Leave history fetched successfully', result);
});

export const approve = catchAsync(async (req, res) => {
  const leave = await leaveService.approve(req.params.leaveId, req.user._id, req.body.reviewRemarks);
  sendSuccess(res, 200, 'Leave request approved successfully', { leave });
});

export const reject = catchAsync(async (req, res) => {
  const leave = await leaveService.reject(req.params.leaveId, req.user._id, req.body.reviewRemarks);
  sendSuccess(res, 200, 'Leave request rejected successfully', { leave });
});
