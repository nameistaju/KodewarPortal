import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Calendar,
  Megaphone,
  Pin
} from 'lucide-react';
import CheckInButton from './attendance/CheckInButton';
import { useEmployeeTracking } from '../context/EmployeeTrackingContext';

const EmployeeDashboard = ({ data, user, refetch }) => {
  const { coords, accuracy, loadingCoords, isInside, distance, officeRadius } = useEmployeeTracking();
  const [liveTime, setLiveTime] = useState(new Date());

  const todayRecord = data.attendanceStatus?.attendance;
  const isPunchedIn = Boolean(todayRecord?.punchIn?.time);
  const isPunchedOut = Boolean(todayRecord?.punchOut?.time);

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = liveTime.toLocaleDateString([], {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] space-y-8">
      {/* 1. Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#07152E] to-[#1F7AE0] p-6 text-white shadow-lg sm:p-7">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">
              Welcome, {user?.name || 'Employee'}
            </h1>
            <p className="text-xs text-slate-200 mt-1">
              KODEWAR Internal Attendance & Leave Portal
            </p>
            <div className="flex items-center gap-2 mt-3 font-mono text-[10px] text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-[#53B8FF]" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Punch In / Check In Component */}
      <CheckInButton
        todayRecord={todayRecord}
        onAction={refetch}
        isInsideRadius={isInside}
        distance={distance}
        coords={coords}
        accuracy={accuracy}
        loadingCoords={loadingCoords}
        officeRadius={officeRadius}
      />

      {/* 3. Leave Balances & Announcements Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Balances Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-slate-900 text-sm">Leave Balances</h3>
            <Link to="/leave" className="text-xs font-bold text-[#2EA8FF] hover:underline">
              Apply Leave →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(data.leaveBalance || []).map((b) => (
              <div key={b.leaveType} className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl text-center">
                <p className="text-[10px] font-bold uppercase text-slate-400">{b.leaveType}</p>
                <p className="text-xl font-black text-slate-800 mt-1">{b.availableDays ?? b.allocatedDays}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">of {b.allocatedDays} days</p>
              </div>
            ))}
          </div>
        </div>

        {/* Announcements Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#2EA8FF]" />
              Announcements
            </h3>
          </div>

          <div className="space-y-3">
            {(data.announcements || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No announcements posted</p>
            ) : (
              (data.announcements || []).map((ann) => (
                <div key={ann._id} className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl">
                  <div className="flex items-center gap-2">
                    {ann.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                    <h4 className="font-bold text-xs text-slate-800">{ann.title}</h4>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{ann.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
