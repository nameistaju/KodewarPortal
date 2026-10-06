import { supabase } from '../config/supabase.js';
import { todayStatus } from './attendanceService.js';
import { getHolidays } from './holidayService.js';
import { list as listAnnouncements } from './announcementService.js';
import { mapEmployeeFromDb } from '../utils/supabaseHelpers.js';
import { getZonedParts } from '../utils/date.js';
import { env } from '../config/env.js';
import { processAutoPunchOuts } from './attendanceAutoCloseService.js';
import logger from '../utils/logger.js';

const getTodayDateString = (dateObj = new Date()) => {
  const parts = getZonedParts(dateObj, env.organizationTimezone || 'Asia/Kolkata');
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
};

export const adminDashboard = async () => {
  await processAutoPunchOuts();
  const todayStr = getTodayDateString();

  try {
    const [
      { count: totalEmployees },
      { data: todayAttendances },
      { data: approvedLeaves },
      { count: pendingLeaves },
      { data: activeEmployees }
    ] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('attendance').select('*').eq('attendance_date', todayStr),
      supabase.from('leaves').select('id, employee_id').eq('status', 'approved').lte('start_date', todayStr).gte('end_date', todayStr),
      supabase.from('leaves').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('employees').select('id, name, email, department').eq('is_active', true)
    ]);

    const total = totalEmployees || (activeEmployees ? activeEmployees.length : 0);
    const presentToday = (todayAttendances || []).filter((a) => a.punch_in).length;
    const onLeaveToday = (approvedLeaves || []).length;
    const absentToday = Math.max(0, total - presentToday - onLeaveToday);

    const attendanceMap = new Map((todayAttendances || []).map((a) => [String(a.employee_id), a]));

    const todayAttendance = (activeEmployees || []).map((emp) => {
      const record = attendanceMap.get(String(emp.id));
      let status = 'ABSENT';
      let workingHoursText = '—';
      let workingHoursNum = 0;

      if (record?.punch_in) {
        const start = new Date(record.punch_in);
        const end = record.punch_out ? new Date(record.punch_out) : new Date();
        const diffMs = Math.max(0, end.getTime() - start.getTime());
        const totalMinutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        workingHoursNum = Number((diffMs / 3600000).toFixed(2));

        const rawStatus = (record.status || '').toLowerCase();
        if (rawStatus === 'auto_punched_out' || record.status === 'AUTO_PUNCHED_OUT') {
          status = 'AUTO_PUNCHED_OUT';
          workingHoursText = `${hours}h ${mins}m`;
        } else if (!record.punch_out) {
          status = 'PUNCHED_IN';
          workingHoursText = `${hours}h ${mins}m · In progress`;
        } else {
          status = rawStatus === 'late' ? 'LATE' : 'PRESENT';
          workingHoursText = `${hours}h ${mins}m`;
        }
      }

      return {
        employee: {
          _id: String(emp.id),
          name: emp.name,
          email: emp.email,
          department: emp.department
        },
        punchIn: record?.punch_in || null,
        punchOut: record?.punch_out || null,
        workingHours: workingHoursNum,
        workingHoursText,
        status
      };
    });

    return {
      totalEmployees: total,
      presentToday,
      absentToday,
      onLeaveToday,
      pendingLeaves: pendingLeaves || 0,
      todayAttendance,
      recentActivities: []
    };
  } catch (error) {
    logger.error('adminDashboard error', { message: error.message });
    return {
      totalEmployees: 0,
      presentToday: 0,
      absentToday: 0,
      onLeaveToday: 0,
      pendingLeaves: 0,
      todayAttendance: [],
      recentActivities: []
    };
  }
};

export const employeeDashboard = async (employeeId) => {
  const [status, empRow, holidays, announcementsData] = await Promise.all([
    todayStatus(employeeId),
    supabase.from('employees').select('*').eq('id', employeeId).single().then((r) => r.data),
    getHolidays().catch(() => []),
    listAnnouncements().catch(() => ({ items: [] }))
  ]);

  const user = mapEmployeeFromDb(empRow);

  return {
    attendanceStatus: {
      punchedIn: Boolean(status.attendance?.punchIn?.time),
      punchedOut: Boolean(status.attendance?.punchOut?.time),
      onLeave: status.onLeave,
      attendance: status.attendance
    },
    leaveBalance: user?.leaveBalances || [
      { leaveType: 'CASUAL', allocatedDays: 12, availableDays: empRow?.leave_balance_casual ?? 12 },
      { leaveType: 'SICK', allocatedDays: 12, availableDays: empRow?.leave_balance_sick ?? 12 }
    ],
    recentActivities: [],
    announcements: announcementsData?.items || [],
    holidays: (holidays || []).slice(0, 5)
  };
};
