import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
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
      <section className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-[#000000] p-6 text-white shadow-lg sm:p-7">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">
              Welcome, {user?.name || 'Employee'}
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              KODEWAR Internal Attendance & Leave Portal
            </p>
            <div className="flex items-center gap-2 mt-3 font-mono text-[10px] text-neutral-400">
              <Calendar className="h-3.5 w-3.5 text-white" />
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
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-200 mb-4">
            <h3 className="font-bold text-black text-sm">Leave Balances</h3>
            <Link to="/leave" className="text-xs font-bold text-black underline hover:text-neutral-700">
              Apply Leave →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(data.leaveBalance || []).map((b) => (
              <div key={b.leaveType} className="bg-neutral-50 border border-neutral-200 p-3 rounded-xl text-center">
                <p className="text-[10px] font-bold uppercase text-neutral-500">{b.leaveType}</p>
                <p className="text-xl font-black text-black mt-1">{b.availableDays ?? b.allocatedDays}</p>
                <p className="text-[9px] text-neutral-500 mt-0.5">of {b.allocatedDays} days</p>
              </div>
            ))}
          </div>
        </div>

        {/* Announcements Card */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-200 mb-4">
            <h3 className="font-bold text-black text-sm flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-black" />
              Announcements
            </h3>
          </div>

          <div className="space-y-3">
            {(data.announcements || []).map((ann) => (
              <div key={ann._id} className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                <div className="flex items-center gap-2">
                  {ann.isPinned && <Pin className="w-3.5 h-3.5 text-black fill-black" />}
                  <h4 className="font-bold text-xs text-black">{ann.title}</h4>
                </div>
                <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{ann.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
