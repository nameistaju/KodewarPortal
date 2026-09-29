import { useEffect, useState } from 'react'
import { LogIn, LogOut, ShieldAlert, Loader2, MapPin, CheckCircle } from 'lucide-react'
import api from '../../api/axios'
import { toastError } from '../../api/helpers'
import toast from 'react-hot-toast'

const CheckInButton = ({
  todayRecord,
  onAction,
  isInsideRadius,
  distance,
  coords,
  accuracy,
  loadingCoords,
  officeRadius,
  mobileCompact = false
}) => {
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!todayRecord?.punchIn?.time || todayRecord?.punchOut?.time) {
      setElapsed('')
      return
    }

    const updateTimer = () => {
      const diffMs = new Date() - new Date(todayRecord.punchIn.time)
      const hours = Math.floor(diffMs / 3600000)
      const mins = Math.floor((diffMs % 3600000) / 60000)
      const secs = Math.floor((diffMs % 60000) / 1000)
      setElapsed(
        `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
      )
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [todayRecord])

  const submitPunch = async () => {
    if (!coords) {
      toast.error('GPS location is not available. Please allow location permissions.')
      return
    }

    const isPunchIn = !todayRecord?.punchIn?.time
    const endpoint = isPunchIn ? '/attendance/punch-in' : '/attendance/punch-out'

    setLoading(true)
    try {
      const payload = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy,
        deviceInfo: navigator.userAgent
      }

      const response = await api.post(endpoint, payload)
      window.dispatchEvent(
        new CustomEvent('attendance:changed', {
          detail: { attendance: response.data?.data?.attendance }
        })
      )
      toast.success(isPunchIn ? 'Punched in successfully!' : 'Punched out successfully!')
      onAction()
    } catch (error) {
      toastError(error)
    } finally {
      setLoading(false)
    }
  }

  const isPunchedIn = Boolean(todayRecord?.punchIn?.time && !todayRecord?.punchOut?.time)
  const isPunchedOut = Boolean(todayRecord?.punchIn?.time && todayRecord?.punchOut?.time)

  if (mobileCompact) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={submitPunch}
          disabled={loading || loadingCoords || isPunchedOut || (!isPunchedIn && !isInsideRadius)}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-md ${
            isPunchedIn
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : isPunchedOut
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : !isInsideRadius
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-[#2EA8FF] hover:bg-[#1F7AE0] text-white'
          }`}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isPunchedIn ? (
            <>
              <LogOut className="w-5 h-5" />
              <span>Punch Out</span>
            </>
          ) : isPunchedOut ? (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span>Day Completed</span>
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              <span>Punch In</span>
            </>
          )}
        </button>

        {isPunchedIn && elapsed && (
          <p className="text-xs font-semibold text-center text-slate-600">
            Working Time: <span className="font-mono text-[#2EA8FF]">{elapsed}</span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Office Attendance</h3>
          <p className="text-xs text-slate-500 mt-0.5">Location-verified office check-in & check-out</p>
        </div>

        {/* Status Badge */}
        <div>
          {isPunchedOut ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5" />
              Completed
            </span>
          ) : isPunchedIn ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Punched In
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
              Not Punched In
            </span>
          )}
        </div>
      </div>

      {/* Geofence Status */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span>
            {loadingCoords ? (
              'Checking location...'
            ) : distance !== null ? (
              <>Distance to Office: <strong className="text-slate-800">{Math.round(distance)}m</strong> (Allowed: {officeRadius || 100}m)</>
            ) : (
              'Location unavailable'
            )}
          </span>
        </div>

        {!loadingCoords && distance !== null && (
          <span
            className={`font-semibold px-2.5 py-0.5 rounded-full text-[11px] ${
              isInsideRadius
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            {isInsideRadius ? 'Inside Office' : 'Outside Office'}
          </span>
        )}
      </div>

      {!isInsideRadius && !isPunchedIn && !isPunchedOut && !loadingCoords && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>You must be physically present inside the office radius ({officeRadius || 100}m) to punch in.</span>
        </div>
      )}

      {/* Action Button */}
      <div className="flex items-center justify-between pt-2">
        {isPunchedIn && elapsed ? (
          <div className="text-xs">
            <span className="text-slate-500">Session Elapsed: </span>
            <span className="font-mono font-bold text-slate-800 text-sm">{elapsed}</span>
          </div>
        ) : (
          <div />
        )}

        <button
          onClick={submitPunch}
          disabled={loading || loadingCoords || isPunchedOut || (!isPunchedIn && !isInsideRadius)}
          className={`flex items-center gap-2 py-2.5 px-6 rounded-xl font-bold text-sm transition-all shadow-sm ${
            isPunchedIn
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : isPunchedOut
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : !isInsideRadius
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-[#2EA8FF] hover:bg-[#1F7AE0] text-white shadow-blue-200'
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPunchedIn ? (
            <>
              <LogOut className="w-4 h-4" />
              <span>Punch Out</span>
            </>
          ) : isPunchedOut ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Completed for Today</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Punch In</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default CheckInButton
