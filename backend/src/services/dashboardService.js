import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import Leave from '../models/Leave.js';
import Announcement from '../models/Announcement.js';
import Holiday from '../models/Holiday.js';
import { EMPLOYEE_STATUS, REQUEST_STATUS, ROLES } from '../constants/index.js';
import { endOfDay, isLaterThanLocalTime, startOfDay } from '../utils/date.js';
import { todayStatus } from './attendanceService.js';
import logger from '../utils/logger.js';

const getRecentActivities = async (employeeId = null) => {
  const query = employeeId ? { employee: employeeId } : {};

  const [attendances, leaves] = await Promise.all([
    Attendance.find(query)
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate('employee', 'name email department role tracksAttendance'),
    Leave.find(query)
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate('employee', 'name email department role tracksAttendance')
  ]);

  const activities = [];

  const isEmployeeTracked = (emp) => {
    if (!emp) return false;
    return emp.tracksAttendance === true || (emp.tracksAttendance !== false && emp.role === 'EMPLOYEE');
  };

  attendances.forEach((a) => {
    if (a.employee && !isEmployeeTracked(a.employee)) return;
    if (a.punchIn?.time) {
      activities.push({
        id: `punch-in-${a._id}`,
        type: 'PUNCH_IN',
        employee: a.employee,
        title: 'Clocked In',
        desc: `${a.employee?.name || 'Employee'} punched in at ${new Date(a.punchIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        timestamp: a.punchIn.time,
        status: 'success'
      });
    }
    if (a.punchOut?.time) {
      activities.push({
        id: `punch-out-${a._id}`,
        type: 'PUNCH_OUT',
        employee: a.employee,
        title: 'Clocked Out',
        desc: `${a.employee?.name || 'Employee'} punched out at ${new Date(a.punchOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${(a.workingHours || 0).toFixed(2)} hrs)`,
        timestamp: a.punchOut.time,
        status: 'info'
      });
    }
  });

  leaves.forEach((l) => {
    if (l.employee && !isEmployeeTracked(l.employee)) return;
    activities.push({
      id: `leave-${l._id}`,
      type: 'LEAVE',
      employee: l.employee,
      title: `Leave Request: ${l.leaveType}`,
      desc: `${l.employee?.name || 'Employee'} requested leave from ${new Date(l.startDate).toLocaleDateString()} to ${new Date(l.endDate).toLocaleDateString()}`,
      timestamp: l.updatedAt || l.createdAt,
      status: l.status.toLowerCase()
    });
  });

  return activities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);
};

export const adminDashboard = async () => {
  const today = startOfDay();
  const todayEnd = endOfDay(today);

  const trackedEmployeesFilter = {
    status: EMPLOYEE_STATUS.ACTIVE,
    $or: [
      { tracksAttendance: true },
      { tracksAttendance: { $exists: false }, role: ROLES.EMPLOYEE }
    ]
  };

  const results = await Promise.allSettled([
    Employee.countDocuments(trackedEmployeesFilter),
    Leave.find({
      status: REQUEST_STATUS.APPROVED,
      startDate: { $lte: todayEnd },
      endDate: { $gte: today }
    }).populate('employee', 'role tracksAttendance'),
    Leave.countDocuments({ status: REQUEST_STATUS.PENDING }),
    Attendance.find({ date: today }).populate('employee', 'name email department status role tracksAttendance')
  ]);

  const getValue = (result, fallback) => {
    if (result.status === 'fulfilled') return result.value;
    logger.error('Admin dashboard query failed', { error: result.reason?.message || result.reason });
    return fallback;
  };

  const totalEmployees = getValue(results[0], 0);
  const leavesTodayRaw = getValue(results[1], []);
  const pendingLeaves = getValue(results[2], 0);
  const todayRecords = getValue(results[3], []);

  const isEmployeeTracked = (emp) => {
    if (!emp) return false;
    return emp.tracksAttendance === true || (emp.tracksAttendance !== false && emp.role === 'EMPLOYEE');
  };

  const leavesToday = leavesTodayRaw.filter((l) => isEmployeeTracked(l.employee));
  const onLeaveToday = leavesToday.length;

  const trackedTodayRecords = todayRecords.filter((r) => isEmployeeTracked(r.employee));
  const presentToday = trackedTodayRecords.filter((r) => r.punchIn?.time).length;
  const absentToday = Math.max(totalEmployees - presentToday - onLeaveToday, 0);

  const lateArrivals = trackedTodayRecords.filter((r) => {
    if (!r.punchIn?.time) return false;
    return isLaterThanLocalTime(r.punchIn.time, 9, 30);
  }).length;

  const activeEmployees = await Employee.find(trackedEmployeesFilter).select('name email department');
  const todayAttendance = activeEmployees.map((emp) => {
    const record = trackedTodayRecords.find((r) => r.employee?._id?.toString() === emp._id.toString());

    let status = 'ABSENT';
    if (record) {
      if (record.punchOut?.time) {
        status = 'PUNCHED_OUT';
      } else if (record.punchIn?.time) {
        status = 'PUNCHED_IN';
      }
    }

    return {
      employee: {
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        department: emp.department
      },
      punchIn: record?.punchIn?.time || null,
      punchOut: record?.punchOut?.time || null,
      workingHours: record?.workingHours || 0,
      status
    };
  });

  const recentActivities = await getRecentActivities();

  return {
    totalEmployees,
    presentToday,
    absentToday,
    onLeaveToday,
    pendingLeaves,
    lateArrivals,
    todayAttendance,
    recentActivities
  };
};

export const employeeDashboard = async (employeeId) => {
  const today = startOfDay();
  const results = await Promise.allSettled([
    todayStatus(employeeId),
    Employee.findById(employeeId).select('leaveBalances teamId').populate('teamId', 'name status description'),
    getRecentActivities(employeeId),
    Announcement.find({ visibleFrom: { $lte: new Date() } }).sort({ isPinned: -1, visibleFrom: -1 }).limit(3),
    Holiday.find({ date: { $gte: today } }).sort({ date: 1 }).limit(5)
  ]);

  const getValue = (result, fallback) => {
    if (result.status === 'fulfilled') return result.value;
    logger.error('Employee dashboard query failed', { error: result.reason?.message || result.reason });
    return fallback;
  };

  const status = getValue(results[0], { attendance: null, onLeave: false });
  const employee = getValue(results[1], null);
  const recentActivities = getValue(results[2], []);
  const announcements = getValue(results[3], []);
  const holidays = getValue(results[4], []);

  return {
    attendanceStatus: {
      punchedIn: Boolean(status.attendance?.punchIn?.time),
      punchedOut: Boolean(status.attendance?.punchOut?.time),
      onLeave: status.onLeave,
      attendance: status.attendance
    },
    assignedTeam: employee?.teamId || null,
    leaveBalance: employee?.leaveBalances || [],
    recentActivities,
    announcements,
    holidays
  };
};
