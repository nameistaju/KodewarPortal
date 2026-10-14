import { useState } from 'react';
import {
  Briefcase,
  Users,
  Mail,
  UserCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Inbox,
  AlertCircle
} from 'lucide-react';

const pipelineStages = [
  { name: 'Applied', count: 0, desc: 'Incoming candidate submissions (Phase 2)' },
  { name: 'Screening', count: 0, desc: 'Resume & qualifications review (Phase 2)' },
  { name: 'Technical Assessment', count: 0, desc: 'Take-home & live coding tests (Phase 2)' },
  { name: 'Interview', count: 0, desc: 'Leadership & team interviews (Phase 2)' },
  { name: 'Offer / Hired', count: 0, desc: 'Final negotiations & onboarding (Phase 2)' }
];

export default function HrDashboard() {
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-neutral-900">
              Recruitment Workspace
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-neutral-900 text-white">
              HR Portal
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-medium mt-1">
            Talent acquisition, pipeline tracking, and hiring operations · KODEWAR Workforce Portal
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
            <Shield className="w-3.5 h-3.5 text-neutral-500" />
            Isolated HR Role
          </span>
        </div>
      </div>

      {/* Integration Notice Banner */}
      <div className="rounded-2xl border border-neutral-800 bg-[#0A0A0A] p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-neutral-800/20 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white" />
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Phase 1 Architecture Active
              </span>
            </div>
            <h3 className="text-base font-bold text-white">
              Recruitment Shell & Integration Readiness
            </h3>
            <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed">
              HR role isolation and authentication hardening are active. Live Titan IMAP/SMTP ingestion,
              AI candidate parsing, automated reply dispatch, and bulk communications will be connected
              in Phase 2 after database schema deployment and mailbox credential verification.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-900 text-neutral-300 border border-neutral-800">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              Mailbox Sync: Scheduled Phase 2
            </div>
          </div>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs transition-all hover:border-neutral-900 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Open Positions
            </span>
            <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-2">0</p>
          <p className="text-[11px] text-neutral-500 mt-1 font-medium">
            Awaiting Requisition Setup (Phase 2)
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs transition-all hover:border-neutral-900 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Candidate Pipeline
            </span>
            <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-2">0</p>
          <p className="text-[11px] text-neutral-500 mt-1 font-medium">
            Pipeline activates in Phase 2
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs transition-all hover:border-neutral-900 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Mailbox Ingestion
            </span>
            <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <p className="text-sm font-black text-neutral-900 mt-3 truncate">
            Not Connected
          </p>
          <p className="text-[11px] text-neutral-500 mt-1 font-medium">
            Titan IMAP/SMTP Scheduled (Phase 2)
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs transition-all hover:border-neutral-900 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Hires Closed (Q4)
            </span>
            <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-neutral-900 mt-2">0</p>
          <p className="text-[11px] text-neutral-500 mt-1 font-medium">
            Awaiting recruitment activity
          </p>
        </div>
      </div>

      {/* Recruitment Pipeline Stages */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">
              Recruitment Pipeline Funnel
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Live progression gates for candidate submissions (Scheduled for Phase 2)
            </p>
          </div>
          <span className="text-[11px] font-bold text-neutral-400">
            5 Stages (Pending Integration)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {pipelineStages.map((stage, idx) => (
            <div
              key={stage.name}
              className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    Stage 0{idx + 1}
                  </span>
                  <span className="text-xs font-black text-neutral-400">
                    {stage.count}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-neutral-900 mt-2">
                  {stage.name}
                </h4>
                <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                  {stage.desc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-neutral-200/80 flex items-center justify-between text-[11px] text-neutral-400">
                <span>0 active</span>
                <ArrowRight className="w-3 h-3 text-neutral-300" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Requisitions Empty State & Phase 2 Roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requisitions List (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                Open Requisitions (0)
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Organizational hiring requisitions managed by HR
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {['ALL', 'DEVELOPMENT', 'RESEARCH', 'DEVOPS'].map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedFilter(dept)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    selectedFilter === dept
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          {/* Honest Empty State */}
          <div className="py-12 px-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-400 mb-3">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900">
              No Active Requisitions Configured
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mt-1 leading-relaxed">
              Requisition creation and position tracking will be enabled in Phase 2 once the recruitment database tables are deployed.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-neutral-200 text-neutral-700">
                <AlertCircle className="w-3 h-3 text-neutral-500" />
                Awaiting Phase 2 Schema
              </span>
            </div>
          </div>
        </div>

        {/* Phase 2 Integration Roadmap (1 col) */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-neutral-900" />
              <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                Phase 2 Architecture Roadmap
              </h2>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              Pending technical integrations to be implemented in Phase 2
            </p>

            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-neutral-900 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-neutral-900">
                      Phase 1: HR Role & Isolation
                    </h5>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Authentication hardening, allowlist permissions, workspace foundation complete.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-neutral-200 bg-white">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-neutral-700">
                      Phase 2: Titan Mailbox Ingestion
                    </h5>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      IMAP/SMTP connection to dedicated HR inbox, webhook syncing, secure credential storage.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-neutral-200 bg-white">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-neutral-700">
                      Phase 2: Candidate Extraction
                    </h5>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Resume PDF parsing, candidate schema population, and automated acknowledgment emails.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-neutral-200 bg-white">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-neutral-700">
                      Phase 2: Bulk Recruitment Mailer
                    </h5>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Interview scheduling batches, rejection notices, offer letter transmission.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-medium">
            <span>Enterprise KODEWAR Portal</span>
            <span className="text-neutral-900 font-bold">
              v2.4.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
