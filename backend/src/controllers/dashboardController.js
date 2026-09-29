import * as dashboardService from '../services/dashboardService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const adminDashboard = catchAsync(async (_req, res) => {
  const dashboard = await dashboardService.adminDashboard();
  sendSuccess(res, 200, 'Admin dashboard fetched successfully', { dashboard });
});

export const employeeDashboard = catchAsync(async (req, res) => {
  const dashboard = await dashboardService.employeeDashboard(req.user._id);
  sendSuccess(res, 200, 'Employee dashboard fetched successfully', { dashboard });
});
