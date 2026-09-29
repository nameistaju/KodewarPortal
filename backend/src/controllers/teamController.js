import * as teamService from '../services/teamService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const getTeams = catchAsync(async (req, res) => {
  const result = await teamService.getTeams(req.validatedQuery || req.query);
  sendSuccess(res, 200, 'Teams fetched successfully', result);
});

export const createTeam = catchAsync(async (req, res) => {
  const team = await teamService.createTeam(req.body, req.user._id);
  sendSuccess(res, 201, 'Team created successfully', { team });
});

export const updateTeam = catchAsync(async (req, res) => {
  const team = await teamService.updateTeam(req.params.id, req.body, req.user._id);
  sendSuccess(res, 200, 'Team updated successfully', { team });
});

export const deleteTeam = catchAsync(async (req, res) => {
  await teamService.deleteTeam(req.params.id);
  sendSuccess(res, 200, 'Team deleted successfully');
});
