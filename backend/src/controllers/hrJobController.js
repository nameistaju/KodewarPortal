import * as hrJobService from '../services/hrJobService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const getJobs = catchAsync(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await hrJobService.getJobs(query);
  sendSuccess(res, 200, 'Job requisitions fetched successfully', result);
});

export const getJobById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const job = await hrJobService.getJobById(id);
  sendSuccess(res, 200, 'Job requisition fetched successfully', job);
});

export const createJob = catchAsync(async (req, res) => {
  const job = await hrJobService.createJob(req.body, req.user);
  sendSuccess(res, 201, 'Job requisition created successfully', job);
});

export const updateJob = catchAsync(async (req, res) => {
  const { id } = req.params;
  const job = await hrJobService.updateJob(id, req.body, req.user);
  sendSuccess(res, 200, 'Job requisition updated successfully', job);
});

export const archiveJob = catchAsync(async (req, res) => {
  const { id } = req.params;
  const job = await hrJobService.archiveJob(id, req.user);
  sendSuccess(res, 200, 'Job requisition archived successfully', job);
});
