import * as attendanceService from '../services/attendanceService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const configureOffice = catchAsync(async (req, res) => {
  const setting = await attendanceService.configureOffice(req.body, req.user._id);
  sendSuccess(res, 200, 'Attendance office settings updated successfully', { setting });
});

export const getOfficeSetting = catchAsync(async (_req, res) => {
  const setting = await attendanceService.getOfficeSetting();
  sendSuccess(res, 200, 'Attendance office settings fetched successfully', { setting });
});

export const punchIn = catchAsync(async (req, res) => {
  const attendance = await attendanceService.punchIn(req.user._id, req.body);
  sendSuccess(res, 201, 'Punch in recorded successfully', { attendance });
});

export const punchOut = catchAsync(async (req, res) => {
  const attendance = await attendanceService.punchOut(req.user._id, req.body);
  sendSuccess(res, 200, 'Punch out recorded successfully', { attendance });
});

export const getTodayStatus = catchAsync(async (req, res) => {
  const status = await attendanceService.todayStatus(req.user._id);
  sendSuccess(res, 200, 'Today\'s attendance status fetched successfully', { status });
});

export const history = catchAsync(async (req, res) => {
  const result = await attendanceService.history(req.user, req.validatedQuery || req.query);
  sendSuccess(res, 200, 'Attendance history fetched successfully', result);
});

export const monthlySummary = catchAsync(async (req, res) => {
  const summary = await attendanceService.monthlySummary(req.user, req.validatedQuery || req.query);
  sendSuccess(res, 200, 'Attendance monthly summary fetched successfully', { summary });
});

export const adminAttendanceCenter = catchAsync(async (req, res) => {
  const result = await attendanceService.adminAttendanceCenter(req.validatedQuery || req.query);
  sendSuccess(res, 200, 'Admin attendance center fetched successfully', result);
});

export const adminAttendanceDetail = catchAsync(async (req, res) => {
  const attendance = await attendanceService.adminAttendanceDetail(req.params.id);
  sendSuccess(res, 200, 'Attendance detail fetched successfully', { attendance });
});

export const exportAdminAttendance = catchAsync(async (req, res) => {
  const exportResult = await attendanceService.adminAttendanceExport(req.validatedQuery || req.query);
  const filename = `attendance-export-${new Date().toISOString().slice(0, 10)}.${exportResult.extension}`;
  res.setHeader('Content-Type', exportResult.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(exportResult.body);
});