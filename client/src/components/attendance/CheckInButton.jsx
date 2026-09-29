import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { LogIn, LogOut, ShieldAlert, Loader2, MapPin, CheckCircle, Clock } from 'lucide-react'
import api from '../../api/axios'
import { toastError } from '../../api/helpers'
import toast from 'react-hot-toast'

const StyledSwitchContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  user-select: none;

  .switch-box {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .switch {
    display: block;
    background-color: black;
    width: 120px;
    height: 156px;
    box-shadow: 0 0 10px 2px rgba(0, 0, 0, 0.2), 0 0 1px 2px black, inset 0 2px 2px -2px white, inset 0 0 2px 12px #47434c, inset 0 0 2px 18px black;
    border-radius: 6px;
    padding: 16px;
    perspective: 700px;
    cursor: pointer;
    position: relative;
    transition: opacity 0.2s ease, transform 0.2s ease;

    &.disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }

    &:hover:not(.disabled) {
      transform: scale(1.03);
    }

    &:focus-within {
      outline: 2px solid #2ea8ff;
      outline-offset: 4px;
    }
  }

  .switch input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .switch input:checked + .button {
    transform: translateZ(20px) rotateX(25deg);
    box-shadow: 0 -10px 20px #ff1818;
  }

  .switch input:checked + .button .light {
    animation: flicker 0.2s infinite 0.3s;
  }

  .switch input:checked + .button .shine {
    opacity: 1;
  }

  .switch input:checked + .button .shadow {
    opacity: 0;
  }

  .switch .button {
    display: block;
    transition: all 0.3s cubic-bezier(1, 0, 1, 1);
    transform-origin: center center -20px;
    transform: translateZ(20px) rotateX(-25deg);
    transform-style: preserve-3d;
    background-color: #9b0621;
    height: 100%;
    position: relative;
    cursor: pointer;
    background: linear-gradient(#980000 0%, #6f0000 30%, #6f0000 70%, #980000 100%);
    background-repeat: no-repeat;
    border-radius: 4px;
  }

  .switch .button::before {
    content: "";
    background: linear-gradient(rgba(255, 255, 255, 0.8) 10%, rgba(255, 255, 255, 0.3) 30%, #650000 75%, #320000) 50% 50%/97% 97%, #b10000;
    background-repeat: no-repeat;
    width: 100%;
    height: 40px;
    transform-origin: top;
    transform: rotateX(-90deg);
    position: absolute;
    top: 0;
  }

  .switch .button::after {
    content: "";
    background-image: linear-gradient(#650000, #320000);
    width: 100%;
    height: 40px;
    transform-origin: top;
    transform: translateY(40px) rotateX(-90deg);
    position: absolute;
    bottom: 0;
    box-shadow: 0 40px 8px 0px black, 0 60px 20px 0px rgba(0, 0, 0, 0.5);
  }

  .switch .light {
    opacity: 0;
    animation: light-off 1s;
    position: absolute;
    width: 100%;
    height: 100%;
    background-image: radial-gradient(#ffc97e, #ff1818 40%, transparent 70%);
  }

  .switch .dots {
    position: absolute;
    width: 100%;
    height: 100%;
    background-image: radial-gradient(transparent 30%, rgba(101, 0, 0, 0.7) 70%);
    background-size: 10px 10px;
  }

  .switch .characters {
    position: absolute;
    width: 100%;
    height: 100%;
    background: linear-gradient(white, white) 50% 20%/5% 20%, radial-gradient(circle, transparent 50%, white 52%, white 70%, transparent 72%) 50% 80%/33% 25%;
    background-repeat: no-repeat;
  }

  .switch .shine {
    transition: all 0.3s cubic-bezier(1, 0, 1, 1);
    opacity: 0.3;
    position: absolute;
    width: 100%;
    height: 100%;
    background: linear-gradient(white, transparent 3%) 50% 50%/97% 97%, linear-gradient(rgba(255, 255, 255, 0.5), transparent 50%, transparent 80%, rgba(255, 255, 255, 0.5)) 50% 50%/97% 97%;
    background-repeat: no-repeat;
  }

  .switch .shadow {
    transition: all 0.3s cubic-bezier(1, 0, 1, 1);
    opacity: 1;
    position: absolute;
    width: 100%;
    height: 100%;
    background: linear-gradient(transparent 70%, rgba(0, 0, 0, 0.8));
    background-repeat: no-repeat;
  }

  @keyframes flicker {
    0% {
      opacity: 1;
    }

    80% {
      opacity: 0.8;
    }

    100% {
      opacity: 1;
    }
  }

  @keyframes light-off {
    0% {
      opacity: 1;
    }

    80% {
      opacity: 0;
    }
  }
`

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

  const isPunchedIn = Boolean(todayRecord?.punchIn?.time && !todayRecord?.punchOut?.time)
  const isPunchedOut = Boolean(todayRecord?.punchIn?.time && todayRecord?.punchOut?.time)

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

  const isDisabled = loading || loadingCoords || isPunchedOut || (!isPunchedIn && !isInsideRadius)

  const handleToggle = () => {
    if (isDisabled) return

    if (!coords) {
      toast.error('GPS location is not available. Please allow location permissions.')
      return
    }

    submitPunch()
  }

  const submitPunch = async () => {
    const isPunchIn = !isPunchedIn
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  }

  // Format timestamp strings
  const punchInFormatted = todayRecord?.punchIn?.time
    ? new Date(todayRecord.punchIn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null
  const punchOutFormatted = todayRecord?.punchOut?.time
    ? new Date(todayRecord.punchOut.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Office Attendance Power Control</h3>
          <p className="text-xs text-slate-500 mt-0.5">Location-verified 3D power switch clock-in & clock-out</p>
        </div>

        {/* Status Badge */}
        <div>
          {isPunchedOut ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5" />
              Completed
            </span>
          ) : isPunchedIn ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
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

      {/* 3D Red Power Switch Control */}
      <StyledSwitchContainer>
        <div className="switch-box">
          <label
            className={`switch ${isDisabled ? 'disabled' : ''}`}
            tabIndex={isDisabled ? -1 : 0}
            onKeyDown={handleKeyDown}
            aria-label={isPunchedIn ? 'Punch out' : 'Punch in'}
            role="button"
            aria-disabled={isDisabled}
          >
            <input
              type="checkbox"
              checked={isPunchedIn}
              onChange={handleToggle}
              disabled={isDisabled}
            />
            <div className="button">
              <div className="light" />
              <div className="dots" />
              <div className="characters" />
              <div className="shine" />
              <div className="shadow" />
            </div>
          </label>

          {/* Loading Spinner Overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md backdrop-blur-[1px]">
              <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Action Title & Instructions */}
        <div className="mt-4 text-center">
          <p className="text-lg font-black tracking-wider text-slate-900 uppercase">
            {isPunchedOut
              ? 'WORKDAY COMPLETED'
              : isPunchedIn
              ? 'PUNCHED IN'
              : !isInsideRadius && !loadingCoords
              ? 'OUTSIDE OFFICE'
              : 'PUNCH IN'}
          </p>

          <p className="text-xs font-semibold text-slate-500 mt-1">
            {isPunchedOut ? (
              <>Punched out at <span className="font-bold text-slate-700">{punchOutFormatted}</span></>
            ) : isPunchedIn ? (
              <>Punched in at <span className="font-bold text-slate-700">{punchInFormatted}</span></>
            ) : !isInsideRadius && !loadingCoords ? (
              `Move within ${officeRadius || 100}m of office to unlock`
            ) : (
              'Tap switch to clock in'
            )}
          </p>

          {/* Working Time Counter */}
          {isPunchedIn && elapsed && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>Working Time: {elapsed}</span>
            </div>
          )}
        </div>
      </StyledSwitchContainer>
    </div>
  )
}

export default CheckInButton
