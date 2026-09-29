import * as employeeService from '../services/employeeService.js';
import * as authService from '../services/authService.js';
import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const createEmployee = catchAsync(async (req, res) => {
  const result = await employeeService.createEmployee(req.body, req.user._id, req.file);
  sendSuccess(res, 201, 'Employee created successfully', result);
});

export const getEmployees = catchAsync(async (req, res) => {
  const result = await employeeService.getEmployees(req.validatedQuery || req.query);
  sendSuccess(res, 200, 'Employees fetched successfully', result);
});

export const getEmployeeById = catchAsync(async (req, res) => {
  const employee = await employeeService.getEmployeeById(req.params.employeeId);
  sendSuccess(res, 200, 'Employee fetched successfully', { employee });
});

export const updateEmployee = catchAsync(async (req, res) => {
  const employee = await employeeService.updateEmployee(
    req.params.employeeId,
    req.body,
    req.user._id,
    req.file
  );
  sendSuccess(res, 200, 'Employee updated successfully', { employee });
});

export const deactivateEmployee = catchAsync(async (req, res) => {
  const employee = await employeeService.deactivateEmployee(req.params.employeeId, req.user._id);
  sendSuccess(res, 200, 'Employee deactivated successfully', { employee });
});

export const activateEmployee = catchAsync(async (req, res) => {
  const employee = await employeeService.activateEmployee(req.params.employeeId, req.user._id);
  sendSuccess(res, 200, 'Employee activated successfully', { employee });
});

export const resetEmployeePassword = catchAsync(async (req, res) => {
  const result = await authService.resetEmployeePassword(req.params.employeeId, req.body?.newPassword, req.user);
  sendSuccess(res, 200, 'Employee password reset successfully', result);
});

export const getEmployeeSecurity = catchAsync(async (req, res) => {
  const result = await employeeService.getEmployeeSecurity(req.params.employeeId);
  sendSuccess(res, 200, 'Employee security settings fetched successfully', result);
});

export const logoutEmployeeFromAllDevices = catchAsync(async (req, res) => {
  const employee = await employeeService.logoutEmployeeFromAllDevices(req.params.employeeId);
  sendSuccess(res, 200, 'Employee logged out from all devices successfully', { employee });
});

export const getProfile = catchAsync(async (req, res) => {
  const employee = await employeeService.getProfile(req.user._id);
  sendSuccess(res, 200, 'Profile fetched successfully', { employee });
});

export const updateProfile = catchAsync(async (req, res) => {
  const employee = await employeeService.updateProfile(req.user._id, req.body, req.file);
  sendSuccess(res, 200, 'Profile updated successfully', { employee });
});
