import * as hrApplicationService from '../services/hrApplicationService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const getApplications = catchAsync(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await hrApplicationService.getApplications(query);
  sendSuccess(res, 200, 'Job applications fetched successfully', result);
});

export const getApplicationById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const application = await hrApplicationService.getApplicationById(id);
  sendSuccess(res, 200, 'Job application fetched successfully', application);
});

export const createApplication = catchAsync(async (req, res) => {
  const application = await hrApplicationService.createApplication(req.body, req.user);
  sendSuccess(res, 201, 'Job application created successfully', application);
});

export const updateApplication = catchAsync(async (req, res) => {
  const { id } = req.params;
  const application = await hrApplicationService.updateApplication(id, req.body, req.user);
  sendSuccess(res, 200, 'Job application updated successfully', application);
});

export const updateApplicationStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  const application = await hrApplicationService.updateApplicationStatus(id, status, reason, req.user);
  sendSuccess(res, 200, 'Job application status updated successfully', application);
});

export const createFromEmail = catchAsync(async (req, res) => {
  const application = await hrApplicationService.createApplicationFromEmail(req.body, req.user);
  sendSuccess(res, 201, 'Job application created from email successfully', application);
});

export const getApplicationAuditLogs = catchAsync(async (req, res) => {
  const { id } = req.params;
  const logs = await hrApplicationService.getApplicationAuditLogs(id);
  sendSuccess(res, 200, 'Application audit logs fetched successfully', logs);
});
