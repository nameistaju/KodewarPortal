import { supabase } from '../config/supabase.js';
import AppError from '../utils/AppError.js';
import { env } from '../config/env.js';
import { isLaterThanLocalTime, getZonedParts } from '../utils/date.js';
import { isInsideRadius } from '../utils/location.js';
import { latitude, longitude, radius } from '../config/officeLocation.js';

const OFFICE_LOCATION = {
  latitude,
  longitude,
  radiusMeters: radius
};

let inMemoryOfficeConfig = {
  officeLatitude: OFFICE_LOCATION.latitude,
  officeLongitude: OFFICE_LOCATION.longitude,
  allowedRadiusMeters: OFFICE_LOCATION.radiusMeters,
  autoCloseTime: '20:30'
};

export const getOfficeSetting = async () => {
  return inMemoryOfficeConfig;
};

export const configureOffice = async (payload) => {
  inMemoryOfficeConfig = {
    officeLatitude: Number(payload.officeLatitude),
    officeLongitude: Number(payload.officeLongitude),
    allowedRadiusMeters: Number(payload.allowedRadiusMeters),
    autoCloseTime: payload.autoCloseTime || '20:30'
  };
  return inMemoryOfficeConfig;
};

const getTodayDateString = (dateObj = new Date()) => {
  const parts = getZonedParts(dateObj, env.organizationTimezone || 'Asia/Kolkata');
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

const getWorkingHoursData = (punchInTime, punchOutTime) => {
  if (!punchInTime) return { hoursNum: 0, text: '—', inProgress: false };

  const start = new Date(punchInTime);
  const end = punchOutTime ? new Date(punchOutTime) : new Date();
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const hoursNum = Number((diffMs / 3600000).toFixed(2));

  if (!punchOutTime) {
    return {
      hoursNum,
      text: `${hours}h ${mins}m · In progress`,
      inProgress: true
    };
  }

  return {
    hoursNum,
    text: `${hours}h ${mins}m`,
    inProgress: false
  };
};

const validateLocation = async (payload, requireRadius = true) => {
  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new AppError('GPS location unavailable', 400);
  }

  const result = isInsideRadius(
    { latitude: lat, longitude: lng },
    { latitude: inMemoryOfficeConfig.officeLatitude, longitude: inMemoryOfficeConfig.officeLongitude },
    inMemoryOfficeConfig.allowedRadiusMeters
  );

  if (requireRadius && !result.isInside) {
    throw new AppError('User is outside office radius', 400, {
      distanceFromOfficeMeters: result.distanceFromOfficeMeters,
      allowedRadiusMeters: inMemoryOfficeConfig.allowedRadiusMeters
    });
  }

  return {
    latitude: lat,
    longitude: lng,
    accuracy: Number(payload.accuracy || 0),
    distanceFromOfficeMeters: result.distanceFromOfficeMeters
  };
};

const formatAttendanceRecord = (row, employeeData = null) => {
  if (!row) return null;

  const punchInTime = row.punch_in ? new Date(row.punch_in) : null;
  const punchOutTime = row.punch_out ? new Date(row.punch_out) : null;
  const workingData = getWorkingHoursData(punchInTime, punchOutTime);

  const rawStatus = (row.status || '').toLowerCase();
  let statusVal = 'ABSENT';
  if (rawStatus === 'present' || rawStatus === 'punched_in' || rawStatus === 'punched_out') {
    statusVal = 'PRESENT';
  } else if (rawStatus === 'late') {
    statusVal = 'LATE';
  } else if (rawStatus === 'half_day') {
    statusVal = 'HALF_DAY';
  } else if (row.status) {
    statusVal = String(row.status).toUpperCase();
  }

  return {
    _id: String(row.id),
    id: String(row.id),
    employee: employeeData || row.employee_id,
    date: row.attendance_date,
    attendance_date: row.attendance_date,
    punchIn: punchInTime ? {
      time: punchInTime.toISOString(),
      location: {
        latitude: Number(row.latitude || 0),
        longitude: Number(row.longitude || 0),
        accuracy: 0
      }
    } : null,
    punchOut: punchOutTime ? {
      time: punchOutTime.toISOString(),
      location: {
        latitude: Number(row.latitude || 0),
        longitude: Number(row.longitude || 0),
        accuracy: 0
      }
    } : null,
    workingHours: workingData.hoursNum,
    workingHoursText: workingData.text,
    inProgress: workingData.inProgress,
    attendanceStatus: statusVal,
    status: statusVal,
    gpsVerification: row.latitude ? 'Verified' : 'Not Available',
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
};

export const punchIn = async (employeeId, payload) => {
  const location = await validateLocation(payload, true);
  const todayStr = getTodayDateString();

  // Check approved leave for today
  const { data: approvedLeaves } = await supabase
    .from('leaves')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr);

  if (approvedLeaves && approvedLeaves.length > 0) {
    throw new AppError('Cannot punch in: you have an approved leave request for today.', 400);
  }

  // Check existing attendance for today
  const { data: existingRecord } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('attendance_date', todayStr)
    .maybeSingle();

  if (existingRecord && existingRecord.punch_in) {
    throw new AppError('Already punched in for this workday', 409);
  }

  const punchInTime = new Date().toISOString();
  const punchInDate = new Date(punchInTime);
  const isLate = isLaterThanLocalTime(punchInDate, 9, 30);
  const dbStatus = isLate ? 'late' : 'present';

  let resultData;
  if (existingRecord) {
    const { data: updated, error } = await supabase
      .from('attendance')
      .update({
        punch_in: punchInTime,
        latitude: location.latitude,
        longitude: location.longitude,
        status: dbStatus,
        updated_at: punchInTime
      })
      .eq('id', existingRecord.id)
      .select('*')
      .single();

    if (error) throw new AppError(`Punch in failed: ${error.message}`, 500);
    resultData = updated;
  } else {
    const { data: created, error } = await supabase
      .from('attendance')
      .insert({
        employee_id: employeeId,
        attendance_date: todayStr,
        punch_in: punchInTime,
        latitude: location.latitude,
        longitude: location.longitude,
        status: dbStatus,
        created_at: punchInTime,
        updated_at: punchInTime
      })
      .select('*')
      .single();

    if (error) throw new AppError(`Punch in failed: ${error.message}`, 500);
    resultData = created;
  }

  return formatAttendanceRecord(resultData);
};

export const punchOut = async (employeeId, payload) => {
  const location = await validateLocation(payload, false);

  const { data: openRecord } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .not('punch_in', 'is', null)
    .is('punch_out', null)
    .order('punch_in', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!openRecord) {
    throw new AppError('Punch in is required before punch out, or attendance is already closed', 409);
  }

  const punchOutTime = new Date().toISOString();
  const currentDbStatus = openRecord.status || 'present';

  const { data: updated, error } = await supabase
    .from('attendance')
    .update({
      punch_out: punchOutTime,
      latitude: location.latitude,
      longitude: location.longitude,
      status: currentDbStatus,
      updated_at: punchOutTime
    })
    .eq('id', openRecord.id)
    .select('*')
    .single();

  if (error || !updated) {
    throw new AppError(`Punch out failed: ${error?.message || 'Update failed'}`, 500);
  }

  return formatAttendanceRecord(updated);
};

export const todayStatus = async (employeeId) => {
  const todayStr = getTodayDateString();

  const { data: attendanceRow } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('attendance_date', todayStr)
    .maybeSingle();

  const { data: leaveRows } = await supabase
    .from('leaves')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr);

  return {
    attendance: formatAttendanceRecord(attendanceRow),
    onLeave: Boolean(leaveRows && leaveRows.length > 0)
  };
};

export const history = async (requestUser, query = {}) => {
  let builder = supabase
    .from('attendance')
    .select('*, employees!employee_id(id, name, email, department)', { count: 'exact' });

  if (requestUser.role === 'EMPLOYEE') {
    builder = builder.eq('employee_id', requestUser.id || requestUser._id);
  } else if (requestUser.role === 'ADMIN' && query.employeeId) {
    builder = builder.eq('employee_id', query.employeeId);
  }

  if (query.from) builder = builder.gte('attendance_date', query.from);
  if (query.to) builder = builder.lte('attendance_date', query.to);

  const page = Number(query.page || 1);
  const limit = Number(query.limit || 25);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  builder = builder.order('attendance_date', { ascending: false }).range(from, to);

  const { data, count, error } = await builder;

  if (error) {
    throw new AppError(`Failed to fetch attendance history: ${error.message}`, 500);
  }

  const items = (data || []).map((row) => formatAttendanceRecord(row, row.employees));
  const total = count || items.length;

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

export const monthlySummary = async (requestUser, query = {}) => {
  const employeeId = (requestUser.role === 'ADMIN' && query.employeeId)
    ? query.employeeId
    : (requestUser.id || requestUser._id);

  const year = Number(query.year || new Date().getFullYear());
  const month = String(query.month || (new Date().getMonth() + 1)).padStart(2, '0');
  const startDate = `${year}-${month}-01`;
  const endDate = `${year}-${month}-31`;

  const { data: rows } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate);

  const presentDays = (rows || []).filter((r) => r.punch_in).length;
  const completeDays = (rows || []).filter((r) => r.punch_in && r.punch_out).length;
  let totalWorkingHours = 0;
  (rows || []).forEach((r) => {
    if (r.punch_in) {
      const end = r.punch_out ? new Date(r.punch_out) : new Date();
      totalWorkingHours += (end - new Date(r.punch_in)) / 3600000;
    }
  });

  const { data: empRow } = await supabase.from('employees').select('id, name, email, department').eq('id', employeeId).single();

  return {
    employee: empRow || { id: employeeId },
    presentDays,
    completeDays,
    totalWorkingHours: Number(totalWorkingHours.toFixed(2)),
    range: { start: startDate, end: endDate }
  };
};

export const adminAttendanceCenter = async (query = {}) => {
  const todayStr = query.date ? String(query.date).slice(0, 10) : getTodayDateString();

  const { data: activeEmployees, error: empError } = await supabase
    .from('employees')
    .select('id, name, email, department, role, is_active')
    .eq('is_active', true);

  if (empError) throw new AppError(`Failed to fetch employees: ${empError.message}`, 500);

  const { data: attendances } = await supabase
    .from('attendance')
    .select('*')
    .eq('attendance_date', todayStr);

  const { data: leaves } = await supabase
    .from('leaves')
    .select('*')
    .eq('status', 'approved')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr);

  const attendanceMap = new Map((attendances || []).map((r) => [String(r.employee_id), r]));
  const leaveMap = new Map((leaves || []).map((l) => [String(l.employee_id), l]));

  let rows = (activeEmployees || []).map((emp) => {
    const att = attendanceMap.get(String(emp.id));
    const lev = leaveMap.get(String(emp.id));

    let status = 'ABSENT';
    if (lev) {
      status = 'LEAVE';
    } else if (att?.punch_in) {
      const rawStatus = (att.status || '').toLowerCase();
      if (!att.punch_out) {
        status = rawStatus === 'late' ? 'LATE' : 'PUNCHED_IN';
      } else if (rawStatus === 'late') {
        status = 'LATE';
      } else if (rawStatus === 'half_day') {
        status = 'HALF_DAY';
      } else {
        const punchInDate = new Date(att.punch_in);
        status = isLaterThanLocalTime(punchInDate, 9, 30) ? 'LATE' : 'PRESENT';
      }
    }

    const workingData = att?.punch_in
      ? getWorkingHoursData(att.punch_in, att.punch_out)
      : { hoursNum: 0, text: '—', inProgress: false };

    return {
      _id: att ? String(att.id) : `${emp.id}-${todayStr}`,
      employee: {
        _id: String(emp.id),
        name: emp.name,
        email: emp.email,
        department: emp.department
      },
      date: todayStr,
      punchIn: att?.punch_in ? {
        time: att.punch_in,
        location: { latitude: Number(att.latitude || 0), longitude: Number(att.longitude || 0) }
      } : null,
      punchOut: att?.punch_out ? {
        time: att.punch_out,
        location: { latitude: Number(att.latitude || 0), longitude: Number(att.longitude || 0) }
      } : null,
      workingHours: workingData.hoursNum,
      workingHoursText: workingData.text,
      inProgress: workingData.inProgress,
      status,
      gpsVerification: att?.latitude ? 'Verified' : 'Not Available',
      latitude: att?.latitude ? Number(att.latitude) : null,
      longitude: att?.longitude ? Number(att.longitude) : null
    };
  });

  if (query.department) {
    rows = rows.filter((r) => r.employee.department === query.department);
  }

  if (query.status) {
    const targetStatus = String(query.status).toUpperCase();
    if (targetStatus === 'PRESENT') {
      rows = rows.filter((r) => r.status === 'PRESENT' || r.status === 'PUNCHED_IN' || r.status === 'LATE' || r.status === 'HALF_DAY' || Boolean(r.punchIn?.time));
    } else {
      rows = rows.filter((r) => r.status.toUpperCase() === targetStatus);
    }
  }

  if (query.search) {
    const term = query.search.toLowerCase();
    rows = rows.filter((r) => r.employee.name.toLowerCase().includes(term) || r.employee.email.toLowerCase().includes(term));
  }

  const presentToday = rows.filter((r) => r.punchIn?.time).length;
  const lateEmployees = rows.filter((r) => r.status === 'LATE').length;
  const absentEmployees = rows.filter((r) => r.status === 'ABSENT').length;
  const onLeave = rows.filter((r) => r.status === 'LEAVE').length;

  return {
    items: rows,
    summary: {
      presentToday,
      lateEmployees,
      absentEmployees,
      onLeave
    },
    pagination: {
      page: 1,
      limit: rows.length,
      total: rows.length,
      totalPages: 1
    }
  };
};

export const adminAttendanceDetail = async (attendanceId) => {
  const { data: row, error } = await supabase
    .from('attendance')
    .select('*, employees!employee_id(id, name, email, department)')
    .eq('id', attendanceId)
    .single();

  if (error || !row) throw new AppError('Attendance record not found', 404);

  return formatAttendanceRecord(row, row.employees);
};

export const adminAttendanceExport = async (query = {}) => {
  const centerData = await adminAttendanceCenter(query);
  const rows = centerData.items.map((row) => ({
    Employee: row.employee?.name || '',
    Email: row.employee?.email || '',
    Department: row.employee?.department || '',
    Date: row.date || '',
    'Punch In': row.punchIn?.time ? new Date(row.punchIn.time).toLocaleString() : '',
    'Punch Out': row.punchOut?.time ? new Date(row.punchOut.time).toLocaleString() : '',
    Hours: row.workingHours || 0,
    Status: row.status,
    'GPS Verification': row.gpsVerification
  }));

  const headers = ['Employee', 'Email', 'Department', 'Date', 'Punch In', 'Punch Out', 'Hours', 'Status', 'GPS Verification'];
  const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(','))].join('\n');

  if (query.format === 'excel') {
    const tableRows = rows
      .map((row) => `<tr>${headers.map((h) => `<td>${String(row[h] ?? '')}</td>`).join('')}</tr>`)
      .join('');
    return {
      contentType: 'application/vnd.ms-excel',
      extension: 'xls',
      body: `<html><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`
    };
  }

  return { contentType: 'text/csv', extension: 'csv', body: csv };
};