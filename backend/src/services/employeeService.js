import Employee from '../models/Employee.js';
import Team from '../models/Team.js';
import { EMPLOYEE_STATUS } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import { escapeRegex, paginated } from '../utils/query.js';
import { deleteUploadedImage, uploadImageBuffer } from './uploadService.js';
import RefreshToken from '../models/RefreshToken.js';
import { generateTemporaryPassword } from '../utils/password.js';

const publicFields = '-password -passwordResetToken -passwordResetExpires -tokenVersion';
const validateTeam = async (teamId) => {
  if (!teamId) return;
  const team = await Team.findById(teamId).select('_id status');
  if (!team) throw new AppError('Assigned team not found', 400);
  if (team.status !== 'ACTIVE') throw new AppError('Assigned team must be active', 400);
};

export const createEmployee = async (payload, actorId, file) => {
  await validateTeam(payload.teamId);
  const existing = await Employee.findOne({ email: payload.email });

  if (existing) {
    throw new AppError('Employee with this email already exists', 409);
  }

  if (payload.phone) {
    const existingPhone = await Employee.findOne({ phone: payload.phone });
    if (existingPhone) {
      throw new AppError('Phone number already exists', 409);
    }
  }

  const userRole = payload.role || 'EMPLOYEE';
  if (userRole === 'ADMIN') {
    payload.department = payload.department || 'ADMIN';
    payload.phone = payload.phone || '+910000000000';
    payload.dob = payload.dob || new Date('1990-01-01');
    payload.tracksAttendance = false;
  } else if (userRole === 'MANAGER') {
    payload.phone = payload.phone || '+910000000000';
    payload.dob = payload.dob || new Date('1990-01-01');
    payload.tracksAttendance = false;
  } else if (userRole === 'TEAM_LEAD') {
    payload.dob = payload.dob || new Date('1990-01-01');
    payload.tracksAttendance = false;
  } else {
    payload.dob = payload.dob || new Date('1990-01-01');
    if (payload.tracksAttendance === undefined) {
      payload.tracksAttendance = true;
    }
  }

  const profilePhoto = file ? await uploadImageBuffer(file, 'profile') : payload.profilePhoto;

  let generatedPassword = null;
  let passwordToUse = payload.password;

  if (payload.autoGeneratePassword) {
    passwordToUse = generateTemporaryPassword();
    generatedPassword = passwordToUse;
  }

  delete payload.autoGeneratePassword;

  let employee;
  try {
    employee = await Employee.create({
      ...payload,
      password: passwordToUse,
      profilePhoto,
      forcePasswordChange: true,
      mustChangePassword: true,
      createdBy: actorId
    });
  } catch (error) {
    if (file && profilePhoto?.publicId) await deleteUploadedImage(profilePhoto.publicId);
    throw error;
  }

  const result = {
    employee: await Employee.findById(employee._id).select(publicFields).populate('teamId', 'name status description')
  };

  if (generatedPassword) {
    result.generatedPassword = generatedPassword;
  }

  return result;
};

export const getEmployees = async (query) => {
  const filter = {};

  if (query.department) filter.department = query.department;
  if (query.status) filter.status = query.status;
  if (query.role) filter.role = query.role;
  if (query.teamId) filter.teamId = query.teamId;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }, { department: regex }];
  }

  return paginated(Employee, filter, query, {
    projection: publicFields,
    defaultSort: 'name',
    populate: [{ path: 'teamId', select: 'name status description' }]
  });
};

export const getEmployeeById = async (employeeId) => {
  const employee = await Employee.findById(employeeId)
    .select(publicFields)
    .populate('teamId', 'name status description');

  if (!employee) throw new AppError('Employee not found', 404);

  return employee;
};

export const updateEmployee = async (employeeId, payload, actorId, file) => {
  await validateTeam(payload.teamId);
  const employee = await Employee.findById(employeeId).select('+tokenVersion');

  if (!employee) throw new AppError('Employee not found', 404);

  if (payload.phone && payload.phone !== employee.phone) {
    const existingPhone = await Employee.findOne({ phone: payload.phone, _id: { $ne: employeeId } });
    if (existingPhone) {
      throw new AppError('Phone number already exists', 409);
    }
  }

  const previousProfilePhoto = employee.profilePhoto?.publicId || employee.profilePhoto?.url;
  const profilePhoto = file ? await uploadImageBuffer(file, 'profile') : payload.profilePhoto;

  const isPasswordModified = !!payload.password;

  if (isPasswordModified) {
    employee.password = payload.password;
    employee.forcePasswordChange = true;
    employee.mustChangePassword = true;
    employee.tokenVersion = (employee.tokenVersion || 0) + 1;
    delete payload.password;
    if (payload.forcePasswordChange !== undefined) {
      delete payload.forcePasswordChange;
    }
  } else if (payload.forcePasswordChange !== undefined) {
    employee.forcePasswordChange = payload.forcePasswordChange;
    employee.mustChangePassword = payload.forcePasswordChange;
    delete payload.forcePasswordChange;
  }

  Object.assign(employee, payload, {
    ...(profilePhoto ? { profilePhoto } : {}),
    updatedBy: actorId
  });

  try {
    await employee.save();
  } catch (error) {
    if (file && profilePhoto?.publicId) await deleteUploadedImage(profilePhoto.publicId);
    throw error;
  }

  if (file && previousProfilePhoto) await deleteUploadedImage(previousProfilePhoto);

  if (isPasswordModified) {
    await RefreshToken.deleteMany({ employee: employee._id });
  }

  return getEmployeeById(employee._id);
};

export const setEmployeeStatus = async (employeeId, status, actorId) => {
  const employee = await Employee.findByIdAndUpdate(
    employeeId,
    { status, updatedBy: actorId },
    { returnDocument: 'after', runValidators: true }
  ).select(publicFields);

  if (!employee) throw new AppError('Employee not found', 404);

  return employee;
};

export const deactivateEmployee = (employeeId, actorId) =>
  setEmployeeStatus(employeeId, EMPLOYEE_STATUS.INACTIVE, actorId);

export const activateEmployee = (employeeId, actorId) =>
  setEmployeeStatus(employeeId, EMPLOYEE_STATUS.ACTIVE, actorId);

export const getProfile = (employeeId) => getEmployeeById(employeeId);

export const updateProfile = async (employeeId, payload, file) => {
  const employee = await Employee.findById(employeeId);

  if (!employee) throw new AppError('Employee not found', 404);

  if (payload.phone && payload.phone !== employee.phone) {
    const existingPhone = await Employee.findOne({ phone: payload.phone, _id: { $ne: employeeId } });
    if (existingPhone) {
      throw new AppError('Phone number already exists', 409);
    }
  }

  const previousProfilePhoto = employee.profilePhoto?.publicId || employee.profilePhoto?.url;
  const profilePhoto = file ? await uploadImageBuffer(file, 'profile') : payload.profilePhoto;

  Object.assign(employee, payload, {
    ...(profilePhoto ? { profilePhoto } : {})
  });

  try {
    await employee.save();
  } catch (error) {
    if (file && profilePhoto?.publicId) await deleteUploadedImage(profilePhoto.publicId);
    throw error;
  }

  if (file && previousProfilePhoto) await deleteUploadedImage(previousProfilePhoto);

  return getEmployeeById(employee._id);
};

export const getEmployeeSecurity = async (employeeId) => {
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new AppError('Employee not found', 404);

  const activeSessions = await RefreshToken.countDocuments({
    employee: employeeId,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  });

  return {
    lastPasswordChange: employee.passwordChangedAt || employee.createdAt,
    forcePasswordChange: employee.forcePasswordChange,
    activeSessions
  };
};

export const logoutEmployeeFromAllDevices = async (employeeId) => {
  const employee = await Employee.findById(employeeId).select('+tokenVersion');
  if (!employee) throw new AppError('Employee not found', 404);

  employee.tokenVersion = (employee.tokenVersion || 0) + 1;
  await employee.save();

  await RefreshToken.deleteMany({ employee: employee._id });

  return getEmployeeById(employee._id);
};
