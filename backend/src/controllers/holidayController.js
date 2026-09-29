import * as holidayService from '../services/holidayService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const create = catchAsync(async (req, res) => {
  const holiday = await holidayService.create(req.body, req.user._id);
  sendSuccess(res, 201, 'Holiday created successfully', { holiday });
});

export const update = catchAsync(async (req, res) => {
  const holiday = await holidayService.update(req.params.holidayId, req.body, req.user._id);
  sendSuccess(res, 200, 'Holiday updated successfully', { holiday });
});

export const remove = catchAsync(async (req, res) => {
  await holidayService.remove(req.params.holidayId);
  sendSuccess(res, 200, 'Holiday deleted successfully');
});

export const list = catchAsync(async (req, res) => {
  const result = await holidayService.list(req.validatedQuery || req.query);
  sendSuccess(res, 200, 'Holidays fetched successfully', result);
});
