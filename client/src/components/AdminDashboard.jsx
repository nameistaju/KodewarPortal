import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, FileText, UserCheck, Search, Clock, Calendar, AlertCircle, CheckCircle2, UserX
} from 'lucide-react';

const AdminDashboard = ({ data }) => {
  const [attendanceSearch, setAttendanceSearch] = useState('');

  const liveTime = new Date();
  const formattedDate = liveTime.toLocaleDateString([], {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  });
  const greeting = liveTime.getHours() < 12 ? 'Good Morning' : liveTime.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  const totalEmployees = data.totalEmployees ?? 0;
  const presentToday = data.presentToday ?? 0;
  const absentToday = data.absentToday ?? 0;
  const onLeaveToday = data.onLeaveToday ?? 0;
  const pendingLeaves = data.pendingLeaves ?? 0;

  const summaryCards = [
    {
      title: 'Total Employees',
      value: totalEmployees,
      subtitle: 'Active workforce',
      icon: Users,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      to: '/employees'
    },
    {
      title: 'Present Today',
      value: presentToday,
      subtitle: `${data.lateArrivals ?? 0} late arrivals`,
      icon: UserCheck,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      to: '/admin-attendance'
    },
    {
      title: 'Absent Today',
      value: absentToday,
      subtitle: 'Not clocked in',
      icon: UserX,
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      to: '/admin-attendance'
    },
    {
      title: 'On Leave Today',
      value: onLeaveToday,
      subtitle: 'Approved leaves',
      icon: Calendar,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      to: '/leave'
    },
    {
      title: 'Pending Leave Requests',
      value: pendingLeaves,
      subtitle: 'Awaiting review',
      icon: FileText,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      to: '/leave'
    }
  ];

  const filteredAttendance = (data.todayAttendance || []).filter((item) =>
    item.employee.name.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
    item.employee.department.toLowerCase().includes(attendanceSearch.toLowerCase())
  );

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] space-y-8">
      {/* 1. Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#07152E] to-[#1F7AE0] p-6 text-white shadow-lg sm:p-7">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="min-w-0 space-y-2 flex-1">
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {greeting}, Admin
            </h1>
            <p className="max-w-md text-xs font-semibold leading-relaxed text-slate-200">
              Today's Overview: <span className="text-[#53B8FF] font-bold">{presentToday}</span> present, <span className="text-[#53B8FF] font-bold">{onLeaveToday}</span> on leave, <span className="text-[#53B8FF] font-bold">{pendingLeaves}</span> pending requests.
            </p>
            <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-[#53B8FF]" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Numerical Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryCards.map((card) => (
          <Link
            key={card.title}
            to={card.to}
            className={`border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${card.color}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider opacity-80">{card.title}</span>
              <card.icon className="w-5 h-5 opacity-80" />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-black">{card.value}</p>
              <p className="text-[11px] font-medium opacity-75 mt-1">{card.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* 3. Today's Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Today's Attendance Roster</h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time attendance status for active employees</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or dept..."
              value={attendanceSearch}
              onChange={(e) => setAttendanceSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs w-full sm:w-64 focus:outline-none focus:border-[#2EA8FF]"
            />
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Punch In</th>
                <th className="py-3 px-4">Punch Out</th>
                <th className="py-3 px-4">Working Hours</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No attendance records found for today
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((item) => (
                  <tr key={item.employee._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {item.employee.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {item.employee.department}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {item.workingHours ? `${item.workingHours} hrs` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'PUNCHED_IN'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : item.status === 'PUNCHED_OUT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
