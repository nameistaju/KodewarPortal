import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Calendar, Clock, Crosshair, ShieldAlert } from 'lucide-react';
import Loading from '../components/Loading';
import CheckInButton from '../components/attendance/CheckInButton';
import AttendanceStats from '../components/attendance/AttendanceStats';
import AttendanceHistory from '../components/attendance/AttendanceHistory';
import api from '../api/axios';
import { toastError, unwrap, unwrapItems } from '../api/helpers';
import { useAuth } from '../context/AuthContext';
import { useEmployeeTracking } from '../context/EmployeeTrackingContext';

const Attendance = () => {
  const { user, token } = useAuth();
  const [history, setHistory] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveTime, setLiveTime] = useState(new Date());
  const { coords, accuracy, loadingCoords, gpsError, distance, isInside, officeRadius, officeError } = useEmployeeTracking();

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    if (!token || !user) return;
    try {
      const [historyRes, statusRes] = await Promise.all([
        api.get('/attendance/history'),
        api.get('/attendance/status')
      ]);
      setHistory(unwrapItems(historyRes));
      const statusData = unwrap(statusRes);
      setTodayRecord(statusData?.status?.attendance || null);
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (user?.role === 'ADMIN') return <Navigate to="/dashboard" replace />;
  if (loading) return <Loading />;

  const isPunchedIn = Boolean(todayRecord?.punchIn?.time && !todayRecord?.punchOut?.time);
  const isPunchedOut = Boolean(todayRecord?.punchOut?.time);
  const attendanceStatus = isPunchedOut ? 'Work day completed' : isPunchedIn ? 'Checked in' : 'Not checked in';
  const statusTone = isPunchedOut || isPunchedIn
    ? 'border-neutral-900 bg-black text-white'
    : 'border-neutral-300 bg-neutral-100 text-neutral-800';
  const formattedTime = liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDate = liveTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="mx-auto max-w-5xl animate-fade-in space-y-6 px-1 sm:px-0">
      <div className="page-header">
        <h1 className="page-title text-black">Attendance</h1>
        <p className="page-subtitle text-neutral-500">Location-verified office attendance check-in and check-out.</p>
      </div>

      <section className="card border border-neutral-200 relative overflow-hidden p-5 shadow-sm sm:p-8 bg-white">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="flex w-full items-center justify-between gap-4 border-b border-neutral-200 pb-4 text-left">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-500">
                <Calendar className="h-4 w-4 text-black" aria-hidden="true" />
                <span>{formattedDate}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-2xl font-black tabular-nums text-black">
                <Clock className="h-5 w-5 text-black" aria-hidden="true" />
                <span>{formattedTime}</span>
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${statusTone}`}>{attendanceStatus}</span>
              <p className="mt-2 text-sm font-extrabold text-black">Office Work</p>
            </div>
          </div>

          <CheckInButton
            todayRecord={todayRecord}
            onAction={fetchData}
            isInsideRadius={isInside}
            distance={distance}
            coords={coords}
            accuracy={accuracy}
            loadingCoords={loadingCoords}
            officeRadius={officeRadius}
          />

          {(gpsError || officeError) && (
            <div className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-neutral-300 bg-neutral-100 p-4 text-left text-sm font-bold text-black">
              <ShieldAlert className="h-5 w-5 shrink-0 text-black" aria-hidden="true" />
              <span>{officeError || 'Enable location access to continue with attendance.'}</span>
            </div>
          )}
        </div>
      </section>

      <AttendanceStats history={history} todayRecord={todayRecord} />

      {history.length === 0 ? (
        <div className="card border-dashed border-neutral-300 p-8 text-center bg-white">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-black">
            <Crosshair className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-extrabold text-black">No attendance recorded yet.</h2>
          <p className="mt-1 text-sm text-neutral-500 font-medium">Punch in to begin your workday.</p>
        </div>
      ) : (
        <AttendanceHistory history={history} />
      )}
    </div>
  );
};

export default Attendance;
