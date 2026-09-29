import { createElement, useEffect, useState } from 'react'
import { Activity, CalendarCheck, Clock, History, Timer } from 'lucide-react'

const formatTime = (value) => {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const AttendanceStats = ({ history, todayRecord: explicitTodayRecord }) => {
  const [sessionHours, setSessionHours] = useState('0.00h')
  const todayRecord = explicitTodayRecord || history.find(
    (r) => new Date(r.date).toDateString() === new Date().toDateString()
  )

  const isPunchedIn = !!todayRecord?.punchIn?.time
  const isPunchedOut = !!todayRecord?.punchOut?.time
  const activeSession = isPunchedIn && !isPunchedOut

  useEffect(() => {
    if (!isPunchedIn) {
      setSessionHours('0.00h')
      return
    }
    if (isPunchedOut) {
      setSessionHours(`${(todayRecord.workingHours || 0).toFixed(2)}h`)
      return
    }

    const updateLiveHours = () => {
      const diffMs = new Date() - new Date(todayRecord.punchIn.time)
      const hours = diffMs / 3600000
      setSessionHours(`${hours.toFixed(2)}h`)
    }

    updateLiveHours()
    const timer = setInterval(updateLiveHours, 60000)
    return () => clearInterval(timer)
  }, [isPunchedIn, isPunchedOut, todayRecord])

  const status = isPunchedOut ? 'Completed' : activeSession ? 'Working' : 'Not started'
  const attendance = todayRecord ? 'Office' : 'No record'
  const lastPunch = todayRecord?.punchOut?.time || todayRecord?.punchIn?.time
  const currentSession = activeSession
    ? 'Office session live'
    : isPunchedOut
      ? 'Session closed'
      : 'Punch in to begin'

  const stats = [
    { label: "Today's Hours", value: sessionHours, Icon: Clock },
    { label: 'Status', value: status, Icon: Activity },
    { label: "Today's Attendance", value: attendance, Icon: CalendarCheck },
    { label: 'Last Punch', value: formatTime(lastPunch), Icon: History },
    { label: 'Current Session', value: currentSession, Icon: Timer }
  ]

  return (
    <section aria-label="Attendance summary" className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-black uppercase tracking-wider text-black">Attendance Summary</h2>
        <span className="text-xs font-semibold text-neutral-400">Today</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.map(({ label, value, Icon: StatIcon }) => (
          <div key={label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {createElement(StatIcon, { className: "h-4 w-4 text-black", "aria-hidden": true })}
              <span>{label}</span>
            </div>
            <p className="mt-2 truncate text-base font-black text-black">{value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default AttendanceStats