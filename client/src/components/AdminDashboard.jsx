import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, FileText, UserCheck, Search, Calendar, UserX
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
      color: 'bg-white text-black border-neutral-200 hover:border-neutral-900',
      to: '/employees'
    },
    {
      title: 'Present Today',
      value: presentToday,
      subtitle: `${data.lateArrivals ?? 0} late arrivals`,
      icon: UserCheck,
      color: 'bg-white text-black border-neutral-200 hover:border-neutral-900',
      to: '/admin-attendance'
    },
    {
      title: 'Absent Today',
      value: absentToday,
      subtitle: 'Not clocked in',
      icon: UserX,
      color: 'bg-white text-black border-neutral-200 hover:border-neutral-900',
      to: '/admin-attendance'
    },
    {
      title: 'On Leave Today',
      value: onLeaveToday,
      subtitle: 'Approved leaves',
      icon: Calendar,
      color: 'bg-white text-black border-neutral-200 hover:border-neutral-900',
      to: '/leave'
    },
    {
      title: 'Pending Leave Requests',
      value: pendingLeaves,
      subtitle: 'Awaiting review',
      icon: FileText,
      color: 'bg-white text-black border-neutral-200 hover:border-neutral-900',
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
      <section className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-[#000000] p-6 text-white shadow-lg sm:p-7">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="min-w-0 space-y-2 flex-1">
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {greeting}, Admin
            </h1>
            <p className="max-w-md text-xs font-semibold leading-relaxed text-neutral-300">
              Today's Overview: <span className="text-white font-bold">{presentToday}</span> present, <span className="text-white font-bold">{onLeaveToday}</span> on leave, <span className="text-white font-bold">{pendingLeaves}</span> pending requests.
            </p>
            <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-neutral-400">
              <Calendar className="h-3.5 w-3.5 text-white" />
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
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">{card.title}</span>
              <card.icon className="w-5 h-5 text-black" />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-black text-black">{card.value}</p>
              <p className="text-[11px] font-semibold text-neutral-500 mt-1">{card.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* 3. Today's Attendance Table */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-200">
          <div>
            <h3 className="font-extrabold text-black text-base">Today's Attendance Roster</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Real-time attendance status for active employees</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or dept..."
              value={attendanceSearch}
              onChange={(e) => setAttendanceSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-neutral-200 rounded-xl text-xs w-full sm:w-64 focus:outline-none focus:border-black text-black"
            />
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Punch In</th>
                <th className="py-3 px-4">Punch Out</th>
                <th className="py-3 px-4">Working Hours</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-neutral-400">
                    No attendance records found for today
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((item) => (
                  <tr key={item.employee._id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-black">
                      {item.employee.name}
                    </td>
                    <td className="py-3 px-4 text-neutral-600 font-semibold">
                      {item.employee.department}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600">
                      {item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600">
                      {item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-3 px-4 font-semibold text-neutral-800">
                      {item.workingHours ? `${item.workingHours} hrs` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.status === 'PUNCHED_IN'
                            ? 'bg-black text-white border-neutral-900'
                            : item.status === 'PUNCHED_OUT'
                            ? 'bg-neutral-200 text-neutral-900 border-neutral-300'
                            : 'bg-neutral-100 text-neutral-700 border-neutral-200'
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
