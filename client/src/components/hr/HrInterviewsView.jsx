import { useState } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  Plus,
  Database,
  CalendarCheck2,
  Video
} from 'lucide-react';

export default function HrInterviewsView() {
  const [activeFilter, setActiveFilter] = useState('UPCOMING');

  return (
    <div className="space-y-4">
      {/* Stage B Notice */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 text-xs text-neutral-700 space-y-1.5">
        <div className="flex items-center gap-2 text-neutral-900 font-bold">
          <CalendarCheck2 className="w-4 h-4 text-neutral-800" />
          <span>Interview Scheduling & Evaluation · Stage B Schema Dependency</span>
        </div>
        <p className="leading-relaxed text-neutral-600">
          The interview coordinator table (<code>public.hr_interviews</code>), interviewer calendar integrations (Google Meet / Microsoft Teams), and scorecards are scheduled for Stage B. Currently showing honest empty schedule queue.
        </p>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg border border-neutral-200 text-xs">
          {['UPCOMING', 'COMPLETED', 'AWAITING_FEEDBACK'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setActiveFilter(st)}
              className={`px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                activeFilter === st
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-neutral-200 text-neutral-500 cursor-not-allowed opacity-80"
          title="Interview scheduling requires Stage B schema migration"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Schedule Interview</span>
          <span className="text-[9px] uppercase font-bold px-1 rounded bg-neutral-300 text-neutral-700">
            Stage B
          </span>
        </button>
      </div>

      {/* Empty State Card */}
      <div className="bg-white rounded-xl border border-neutral-200 p-16 text-center shadow-xs space-y-3">
        <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
          <Calendar className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-neutral-800">
            0 Scheduled Interviews
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
            No interview schedules currently exist. Once Stage B candidate pipelines and Google Calendar / Teams integrations are linked, upcoming interview rounds will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
