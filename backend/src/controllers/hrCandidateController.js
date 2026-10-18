import * as hrCandidateService from '../services/hrCandidateService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const getCandidates = catchAsync(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await hrCandidateService.getCandidates(query);
  sendSuccess(res, 200, 'Candidates fetched successfully', result);
});

export const getCandidateById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const candidate = await hrCandidateService.getCandidateById(id);
  sendSuccess(res, 200, 'Candidate fetched successfully', candidate);
});

export const createCandidate = catchAsync(async (req, res) => {
  const candidate = await hrCandidateService.createCandidate(req.body, req.user);
  sendSuccess(res, 201, 'Candidate created successfully', candidate);
});

export const updateCandidate = catchAsync(async (req, res) => {
  const { id } = req.params;
  const candidate = await hrCandidateService.updateCandidate(id, req.body, req.user);
  sendSuccess(res, 200, 'Candidate updated successfully', candidate);
});

export const updateCandidateStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  const candidate = await hrCandidateService.updateCandidateStatus(id, status, reason, req.user);
  sendSuccess(res, 200, 'Candidate status updated successfully', candidate);
});

export const linkEmail = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { emailId, isPrimaryApplication, notes } = req.body;
  const result = await hrCandidateService.linkEmailToCandidate(id, emailId, { isPrimaryApplication, notes }, req.user);
  sendSuccess(res, 201, 'Email linked to candidate successfully', result);
});

export const unlinkEmail = catchAsync(async (req, res) => {
  const { id, emailId } = req.params;
  const result = await hrCandidateService.unlinkEmailFromCandidate(id, emailId, req.user);
  sendSuccess(res, 200, 'Email unlinked from candidate successfully', result);
});

export const createFromEmail = catchAsync(async (req, res) => {
  const { emailId, ...overrides } = req.body;
  const candidate = await hrCandidateService.createCandidateFromEmail(emailId, overrides, req.user);
  sendSuccess(res, 201, 'Candidate created and linked from email successfully', candidate);
});

export const getCandidateAuditLogs = catchAsync(async (req, res) => {
  const { id } = req.params;
  const logs = await hrCandidateService.getCandidateAuditLogs(id);
  sendSuccess(res, 200, 'Candidate audit logs fetched successfully', logs);
});
