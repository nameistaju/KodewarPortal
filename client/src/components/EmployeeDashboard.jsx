import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Pin, Clock } from 'lucide-react';
import CheckInButton from './attendance/CheckInButton';
import { useEmployeeTracking } from '../context/EmployeeTrackingContext';

const getDashboardState = (isPunchedIn) => {
  const hour = new Date().getHours();

  let timeState = {
    greeting: 'Good Morning',
    bg: '/bgforLogin_desktop.png',
    mobileBg: '/bgforLogin_mobile.png',
    character: '/okayState.png'
  };

  if (hour >= 5 && hour < 12) {
    timeState = {
      greeting: 'Good Morning',
      bg: '/bgforLogin_desktop.png',
      mobileBg: '/bgforLogin_mobile.png',
      character: '/okayState.png'
    };
  } else if (hour >= 12 && hour < 17) {
    timeState = {
      greeting: 'Good Afternoon',
      bg: '/middaystate.png',
      mobileBg: '/middaystate.png',
      character: '/usinglaptopstate.png'
    };
  } else if (hour >= 17 && hour < 21) {
    timeState = {
      greeting: 'Good Evening',
      bg: '/evngState.png',
      mobileBg: '/evngState.png',
      character: '/showinglovestate.png'
    };
  } else {
    timeState = {
      greeting: 'Good Night',
      bg: '/Nightsate.png',
      mobileBg: '/bgforLogin_mobile.png',
      character: '/randomState.png'
    };
  }

  if (isPunchedIn) {
    timeState.character = '/moreloveState.png';
  }

  return timeState;
};

const EmployeeDashboard = ({ data, user, refetch }) => {
  const { coords, accuracy, loadingCoords, isInside, distance, officeRadius } = useEmployeeTracking();
  const [liveTime, setLiveTime] = useState(new Date());

  const todayRecord = data?.attendanceStatus?.attendance;
  const isPunchedIn = Boolean(todayRecord?.punchIn?.time && !todayRecord?.punchOut?.time);

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeState = getDashboardState(isPunchedIn);

  const formattedTime = liveTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const formattedDate = liveTime.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const leaveBalances = data?.leaveBalance || [];
  const announcements = data?.announcements || [];

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] space-y-6 animate-fade-in">
      <style>{`
        @keyframes floatChar {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .float-animation {
          animation: floatChar 4s ease-in-out infinite;
        }
      `}</style>

      {/* 1. Mobile & Desktop State-Based Hero Card */}
      <section
        className="relative overflow-hidden rounded-3xl border border-neutral-800 p-5 sm:p-7 min-h-[190px] text-black shadow-xl bg-cover bg-center transition-all duration-700"
        style={{ backgroundImage: `url(${timeState.bg})` }}
      >
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 items-center gap-4 sm:gap-6">
          {/* LEFT: Greeting & Name */}
          <div className="flex flex-col space-y-1 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-900">
              {timeState.greeting}
            </span>
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-black tracking-tight leading-tight">
              {user?.name || 'Employee'}
            </h1>
            <p className="text-[11px] font-black text-neutral-800 tracking-wider uppercase">
              KODEWAR Workforce
            </p>
          </div>

          {/* CENTER: Visually Centered Live Clock & Date */}
          <div className="flex flex-col items-center justify-center text-center py-2 md:py-0 border-y md:border-y-0 md:border-x border-black/20 my-1 md:my-0 px-4">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-900 mb-0.5">
              <Clock className="w-3.5 h-3.5 text-black" />
              <span>Local Time</span>
            </div>
            <div className="font-mono text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-black tabular-nums drop-shadow-xs">
              {formattedTime}
            </div>
            <span className="text-[11px] font-bold text-neutral-900 mt-0.5">
              {formattedDate}
            </span>
          </div>

          {/* RIGHT: Character State Illustration */}
          <div className="flex items-center justify-center md:justify-end shrink-0 h-36 sm:h-48 md:h-52">
            <img
              src={timeState.character}
              alt="KODEWAR Character State"
              className="h-full w-auto object-contain drop-shadow-xl float-animation select-none"
            />
          </div>
        </div>
      </section>

      {/* 2. Primary Attendance Card */}
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

      {/* 3. Compact Leave Balance Summary & Announcements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Compact Leave Balance Summary */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <div>
              <h3 className="font-extrabold text-black text-sm uppercase tracking-tight">Leave Balance</h3>
              <p className="text-xs text-neutral-500 mt-0.5 font-medium">Available leave days</p>
            </div>
            <Link to="/leave" className="btn-secondary text-xs px-3.5 py-2 font-bold rounded-xl shrink-0">
              View Leave
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {leaveBalances.map((b) => (
              <div key={b.leaveType} className="bg-neutral-50 border border-neutral-200 p-2.5 rounded-xl text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">{b.leaveType}</p>
                <p className="text-xl font-black text-black mt-0.5">{b.availableDays ?? b.allocatedDays}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Announcements Summary */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-black shrink-0" />
              <div>
                <h3 className="font-extrabold text-black text-sm uppercase tracking-tight">Announcements</h3>
                <p className="text-xs text-neutral-500 mt-0.5 font-medium">
                  {announcements.length} active announcement{announcements.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <Link to="/announcements" className="btn-secondary text-xs px-3.5 py-2 font-bold rounded-xl shrink-0">
              View
            </Link>
          </div>

          {announcements.length > 0 ? (
            <div className="bg-neutral-50 border border-neutral-200 p-3 rounded-xl flex items-center justify-between text-xs">
              <span className="font-bold text-black truncate max-w-[80%]">{announcements[0].title}</span>
              {announcements[0].isPinned && <Pin className="w-3.5 h-3.5 text-black fill-black shrink-0" />}
            </div>
          ) : (
            <div className="bg-neutral-50 border border-neutral-200 p-3 rounded-xl text-xs text-neutral-400 font-semibold text-center">
              No active announcements
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
