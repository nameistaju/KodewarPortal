import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Leave from '../models/Leave.js';
import AttendanceSetting from '../models/AttendanceSetting.js';
import mongoose from 'mongoose';
import { EMPLOYEE_STATUS, REQUEST_STATUS } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import { env } from '../config/env.js';
import { endOfDay, getMonthRange, isLaterThanLocalTime, startOfDay } from '../utils/date.js';
import { isInsideRadius } from '../utils/location.js';
import { getPagination, paginated } from '../utils/query.js';
import { latitude, longitude, radius } from '../config/officeLocation.js';
import { runInTransaction } from '../utils/transaction.js';

const OFFICE_LOCATION = {
  latitude,
  longitude,
  radiusMeters: radius
};

const toNumber = (value) => (value === undefined || value === null || value === '' ? undefined : Number(value));

const normalizeLocationPayload = (payload) => {
  const lat = toNumber(payload.latitude);
  const lng = toNumber(payload.longitude);

  if (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new AppError('GPS location unavailable', 400);
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new AppError('GPS location unavailable', 400);
  }

  return {
    latitude: lat,
    longitude: lng,
    accuracy: toNumber(payload.accuracy)
  };
};

const findOpenAttendance = (employeeId, session = null) => {
  const query = Attendance.findOne({
    employee: employeeId,
    'punchIn.time': { $exists: true },
    'punchOut.time': { $exists: false }
  }).sort({ 'punchIn.time': -1 });
  return session ? query.session(session) : query;
};

export const getOfficeSetting = async () => {
  const setting = await AttendanceSetting.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (setting) {
    return {
      officeLatitude: setting.officeLatitude,
      officeLongitude: setting.officeLongitude,
      allowedRadiusMeters: setting.allowedRadiusMeters,
      autoCloseTime: setting.autoCloseTime || env.attendanceAutoCloseTime || '02:00'
    };
  }
  return {
    officeLatitude: OFFICE_LOCATION.latitude,
    officeLongitude: OFFICE_LOCATION.longitude,
    allowedRadiusMeters: OFFICE_LOCATION.radiusMeters,
    autoCloseTime: env.attendanceAutoCloseTime || '02:00'
  };
};

export const configureOffice = async (payload, actorId) => {
  const setting = await AttendanceSetting.findOneAndUpdate(
    { isActive: true },
    {
      $set: {
        officeLatitude: Number(payload.officeLatitude),
        officeLongitude: Number(payload.officeLongitude),
        allowedRadiusMeters: Number(payload.allowedRadiusMeters),
        autoCloseTime: payload.autoCloseTime || '02:00',
        updatedBy: actorId
      }
    },
    { upsert: true, new: true, runValidators: true }
  );
  return {
    officeLatitude: setting.officeLatitude,
    officeLongitude: setting.officeLongitude,
    allowedRadiusMeters: setting.allowedRadiusMeters,
    autoCloseTime: setting.autoCloseTime
  };
};

const validateLocation = async (payload, requireRadius = true) => {
  const location = normalizeLocationPayload(payload);
  const officeConfig = await getOfficeSetting();
  const result = isInsideRadius(
    { latitude: location.latitude, longitude: location.longitude },
    { latitude: officeConfig.officeLatitude, longitude: officeConfig.officeLongitude },
    officeConfig.allowedRadiusMeters
  );

  if (requireRadius && !result.isInside) {
    throw new AppError('User is outside office radius', 400, {
      distanceFromOfficeMeters: result.distanceFromOfficeMeters,
      allowedRadiusMeters: officeConfig.allowedRadiusMeters
    });
  }

  return {
    ...location,
    distanceFromOfficeMeters: result.distanceFromOfficeMeters
  };
};

export const punchIn = async (employeeId, payload) => {
  const location = await validateLocation(payload, true);

  return await runInTransaction(async (session) => {
    const openAttendance = await findOpenAttendance(employeeId, session);
    if (openAttendance) throw new AppError('An attendance session is already open', 409);

    const date = startOfDay();

    // Check if employee is on approved leave today
    const approvedLeave = await Leave.findOne({
      employee: employeeId,
      status: REQUEST_STATUS.APPROVED,
      startDate: { $lte: endOfDay(date) },
      endDate: { $gte: date }
    }).session(session);

    if (approvedLeave) {
      throw new AppError('Cannot punch in: you have an approved leave request for today.', 400, {
        code: 'APPROVED_LEAVE_EXISTS',
        leaveId: approvedLeave._id
      });
    }

    let attendance = await Attendance.findOne({ employee: employeeId, date }).session(session);
    if (attendance?.punchIn?.time) throw new AppError('Already punched in for this workday', 409);
    if (!attendance) attendance = new Attendance({ employee: employeeId, date });

    const punchInTime = new Date();
    attendance.attendanceStatus = 'PUNCHED_IN';
    attendance.punchIn = {
      time: punchInTime,
      location,
      deviceInfo: payload.deviceInfo
    };
    attendance.notes = payload.notes;
    await attendance.save({ session });

    return attendance;
  }, 'Punch in could not be completed safely');
};

export const punchOut = async (employeeId, payload) => {
  const candidate = await findOpenAttendance(employeeId);
  if (!candidate) throw new AppError('Punch in is required before punch out, or attendance is already closed', 409);

  const location = await validateLocation(payload, false);

  return await runInTransaction(async (session) => {
    const attendance = await findOpenAttendance(employeeId, session);
    if (!attendance) throw new AppError('Attendance is already closed', 409);

    const punchOutTime = new Date();
    attendance.punchOut = {
      time: punchOutTime,
      location,
      deviceInfo: payload.deviceInfo
    };
    attendance.attendanceStatus = 'PUNCHED_OUT';
    attendance.workingHours = Number(((punchOutTime - attendance.punchIn.time) / 3600000).toFixed(2));
    attendance.notes = payload.notes || attendance.notes;

    await attendance.save({ session });
    return attendance;
  }, 'Punch out could not be completed safely');
};

export const history = async (requestUser, query) => {
  const filter = {};

  if (requestUser.role === 'EMPLOYEE') filter.employee = requestUser._id;
  if (requestUser.role === 'ADMIN' && query.employeeId) filter.employee = query.employeeId;
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = startOfDay(query.from);
    if (query.to) filter.date.$lte = endOfDay(query.to);
  }

  return await paginated(Attendance, filter, query, {
    defaultSort: '-date',
    populate: [{ path: 'employee', select: 'name email department' }]
  });
};

export const monthlySummary = async (requestUser, query) => {
  const employeeId =
    requestUser.role === 'ADMIN' && query.employeeId
      ? new mongoose.Types.ObjectId(query.employeeId)
      : requestUser._id;
  const { start, end } = getMonthRange(query.year, query.month);

  const [summary] = await Attendance.aggregate([
    { $match: { employee: employeeId, date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: '$employee',
        presentDays: { $sum: { $cond: [{ $ifNull: ['$punchIn.time', false] }, 1, 0] } },
        totalWorkingHours: { $sum: '$workingHours' },
        completeDays: { $sum: { $cond: [{ $ifNull: ['$punchOut.time', false] }, 1, 0] } }
      }
    }
  ]);

  return {
    employee: await Employee.findById(employeeId).select('name email department'),
    presentDays: summary?.presentDays || 0,
    completeDays: summary?.completeDays || 0,
    totalWorkingHours: Number((summary?.totalWorkingHours || 0).toFixed(2)),
    range: { start, end }
  };
};

export const todayStatus = async (employeeId) => {
  const today = startOfDay();
  const openAttendance = await findOpenAttendance(employeeId);
  const attendance = openAttendance || await Attendance.findOne({ employee: employeeId, date: today });
  const leave = await Leave.findOne({
    employee: employeeId,
    status: REQUEST_STATUS.APPROVED,
    startDate: { $lte: endOfDay(today) },
    endDate: { $gte: today }
  });

  return {
    attendance: attendance ? (attendance.toObject ? attendance.toObject() : attendance) : null,
    onLeave: Boolean(leave)
  };
};

const escapeCsv = (value) => {
  if (value === undefined || value === null) return '';
  const stringValue = String(value).replace(/"/g, '""');
  return /[",\n]/.test(stringValue) ? `"${stringValue}"` : stringValue;
};

const getAdminRange = (query) => {
  const start = query.date ? startOfDay(query.date) : query.from ? startOfDay(query.from) : startOfDay();
  const end = query.date ? endOfDay(query.date) : query.to ? endOfDay(query.to) : endOfDay(start);
  return { start, end };
};

const getAttendanceStatus = (attendance, leave) => {
  if (leave) return 'LEAVE';
  if (!attendance?.punchIn?.time) return 'ABSENT';

  const punchIn = new Date(attendance.punchIn.time);
  const isLate = isLaterThanLocalTime(punchIn, 9, 30);
  if (isLate) return 'LATE';
  if (attendance.punchOut?.time && Number(attendance.workingHours || 0) > 0 && Number(attendance.workingHours || 0) < 4) return 'HALF_DAY';
  return 'PRESENT';
};

const getGpsStatus = (attendance) => {
  const distance = attendance?.punchIn?.location?.distanceFromOfficeMeters;
  if (distance === undefined || distance === null) return 'Not Available';
  return distance <= OFFICE_LOCATION.radiusMeters ? 'Verified' : 'Outside Radius';
};

const serializeAttendanceRow = ({ employee, attendance, leave }) => {
  const status = getAttendanceStatus(attendance, leave);
  return {
    _id: attendance?._id || `${employee._id}-${new Date().toISOString()}`,
    employee: {
      _id: employee._id,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      employeeId: String(employee._id).slice(-6).toUpperCase(),
      profilePhoto: employee.profilePhoto
    },
    date: attendance?.date || startOfDay(),
    punchIn: attendance?.punchIn || null,
    punchOut: attendance?.punchOut || null,
    workingHours: Number(attendance?.workingHours || 0),
    status,
    gpsVerification: getGpsStatus(attendance),
    adminNotes: attendance?.notes || '',
    leave: leave || null
  };
};

const buildAdminEmployeeFilter = (query) => {
  const conditions = [
    { status: EMPLOYEE_STATUS.ACTIVE },
    {
      $or: [
        { tracksAttendance: true },
        { tracksAttendance: { $exists: false }, role: 'EMPLOYEE' }
      ]
    }
  ];

  if (query.employeeId) conditions.push({ _id: query.employeeId });
  if (query.department) conditions.push({ department: query.department });

  const search = query.search || query.employeeName;
  if (search) {
    const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const searchConditions = [{ name: regex }, { email: regex }, { department: regex }];
    if (mongoose.Types.ObjectId.isValid(search)) searchConditions.push({ _id: search });
    conditions.push({ $or: searchConditions });
  }

  return { $and: conditions };
};

const sortAdminRows = (rows, sort = '-date') => {
  const sortText = String(sort || '-date');
  const direction = sortText.startsWith('-') ? -1 : 1;
  const field = sortText.replace(/^-/, '');

  return [...rows].sort((a, b) => {
    const left = field === 'workingHours' ? Number(a.workingHours || 0) : new Date(a.date || 0).getTime();
    const right = field === 'workingHours' ? Number(b.workingHours || 0) : new Date(b.date || 0).getTime();
    return (left > right ? 1 : left < right ? -1 : 0) * direction;
  });
};

export const adminAttendanceCenter = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const { start, end } = getAdminRange(query);
  const employeeFilter = buildAdminEmployeeFilter(query);
  const sort = query.sort || '-date';

  const dateFilter = { date: { $gte: start, $lte: end } };

  const [employees, attendances, leaves] = await Promise.all([
    Employee.find(employeeFilter).select('name email department profilePhoto status').sort({ name: 1 }),
    Attendance.find(dateFilter).populate('employee', 'name email department profilePhoto status').sort(sort),
    Leave.find({ status: REQUEST_STATUS.APPROVED, startDate: { $lte: end }, endDate: { $gte: start } }).populate('employee', 'name email department profilePhoto status')
  ]);

  const employeeIds = new Set(employees.map((employee) => employee._id.toString()));
  const attendanceByEmployeeDay = new Map();
  attendances.forEach((attendance) => {
    const employee = attendance.employee;
    if (!employee || !employeeIds.has(employee._id.toString())) return;
    attendanceByEmployeeDay.set(`${employee._id}-${startOfDay(attendance.date).toISOString()}`, attendance);
  });

  const rows = [];
  const useSingleDayRoster = !query.from && !query.to;

  if (useSingleDayRoster) {
    employees.forEach((employee) => {
      const dayKey = `${employee._id}-${start.toISOString()}`;
      const attendance = attendanceByEmployeeDay.get(dayKey);
      const leave = leaves.find((item) => item.employee?._id?.toString() === employee._id.toString() && start <= endOfDay(item.endDate) && end >= startOfDay(item.startDate));
      rows.push(serializeAttendanceRow({
        employee,
        attendance,
        leave
      }));
    });
  } else {
    attendances.forEach((attendance) => {
      const employee = attendance.employee;
      if (!employee || !employeeIds.has(employee._id.toString())) return;
      const leave = leaves.find((item) => item.employee?._id?.toString() === employee._id.toString() && attendance.date <= endOfDay(item.endDate) && attendance.date >= startOfDay(item.startDate));
      rows.push(serializeAttendanceRow({
        employee,
        attendance,
        leave
      }));
    });
  }

  let filteredRows = rows;
  if (query.status) filteredRows = filteredRows.filter((row) => row.status === query.status);

  filteredRows = sortAdminRows(filteredRows, sort);
  const totalRows = filteredRows.length;
  const pagedRows = filteredRows.slice(skip, skip + limit);

  const presentRows = filteredRows.filter((row) => row.punchIn?.time);
  const totalHours = filteredRows.reduce((sum, row) => sum + Number(row.workingHours || 0), 0);
  const averageHours = presentRows.length ? totalHours / presentRows.length : 0;

  const summary = {
    presentToday: presentRows.length,
    lateEmployees: filteredRows.filter((row) => row.status === 'LATE').length,
    absentEmployees: filteredRows.filter((row) => row.status === 'ABSENT').length,
    onLeave: filteredRows.filter((row) => row.status === 'LEAVE').length,
    totalWorkingHoursToday: Number(totalHours.toFixed(2))
  };

  const statistics = {
    presentPercentage: filteredRows.length ? Math.round((presentRows.length / filteredRows.length) * 100) : 0,
    absentPercentage: filteredRows.length ? Math.round((summary.absentEmployees / filteredRows.length) * 100) : 0,
    averageWorkingHours: Number(averageHours.toFixed(2)),
    lateArrivals: summary.lateEmployees
  };

  return {
    items: pagedRows,
    summary,
    statistics,
    range: { start, end },
    pagination: {
      page,
      limit,
      total: totalRows,
      totalPages: Math.ceil(totalRows / limit) || 1
    }
  };
};

export const adminAttendanceDetail = async (attendanceId) => {
  const attendance = await Attendance.findById(attendanceId).populate('employee', 'name email department profilePhoto status');
  if (!attendance) throw new AppError('Attendance record not found', 404);

  return serializeAttendanceRow({
    employee: attendance.employee,
    attendance
  });
};

export const adminAttendanceExport = async (query = {}) => {
  const firstPage = await adminAttendanceCenter({ ...query, page: 1, limit: 100 });
  const allItems = [...firstPage.items];

  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    const nextPage = await adminAttendanceCenter({ ...query, page, limit: 100 });
    allItems.push(...nextPage.items);
  }

  const rows = allItems.map((row) => ({
    Employee: row.employee?.name || '',
    Email: row.employee?.email || '',
    Department: row.employee?.department || '',
    Date: row.date ? new Date(row.date).toLocaleDateString() : '',
    'Punch In': row.punchIn?.time ? new Date(row.punchIn.time).toLocaleString() : '',
    'Punch Out': row.punchOut?.time ? new Date(row.punchOut.time).toLocaleString() : '',
    Hours: row.workingHours || 0,
    Status: row.status,
    'GPS Verification': row.gpsVerification
  }));

  const headers = ['Employee', 'Email', 'Department', 'Date', 'Punch In', 'Punch Out', 'Hours', 'Status', 'GPS Verification'];
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))].join('\n');

  if (query.format === 'excel') {
    const tableRows = rows
      .map((row) => `<tr>${headers.map((header) => `<td>${String(row[header] ?? '').replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]))}</td>`).join('')}</tr>`)
      .join('');
    return {
      contentType: 'application/vnd.ms-excel',
      extension: 'xls',
      body: `<html><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`
    };
  }

  return { contentType: 'text/csv', extension: 'csv', body: csv };
};