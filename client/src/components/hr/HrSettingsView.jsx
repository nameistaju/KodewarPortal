import {
  Sliders,
  Shield,
  Server,
  Lock,
  Mail,
  Database,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';

export default function HrSettingsView({ syncStatus }) {
  const config = syncStatus?.config;
  const state = syncStatus?.syncState;

  return (
    <div className="space-y-4">
      {/* Overview Notice */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 text-xs text-neutral-700 space-y-1.5">
        <div className="flex items-center gap-2 text-neutral-900 font-bold">
          <Sliders className="w-4 h-4 text-neutral-800" />
          <span>HR Mailbox Configuration & Security Boundaries</span>
        </div>
        <p className="leading-relaxed text-neutral-600">
          The settings below govern inbound ingestion channels, role authorization, and outbound communication policies. In strict compliance with Stage A safety constraints, outbound SMTP transmission is locked (<code>TITAN_MAIL_ENABLED=false</code>).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* IMAP Connection Parameters */}
        <div className="p-4 sm:p-5 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-neutral-100">
            <Server className="w-4 h-4 text-neutral-900" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Inbound Titan IMAP Service
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Target Mailbox</span>
              <span className="font-mono font-bold text-neutral-900">
                {syncStatus?.mailboxAddress || 'hr@kodewar.com'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">IMAP Server Host</span>
              <span className="font-mono text-neutral-800">
                {config?.imap?.host || 'imap.secureserver.net'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Port & Security</span>
              <span className="font-mono text-neutral-800">
                {config?.imap?.port || 993} (TLS / SSL)
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Operation Mode</span>
              <span className="inline-flex items-center gap-1 font-bold text-neutral-900">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Read-Only (EXAMINE)
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-500">Active Lease Duration</span>
              <span className="font-mono text-neutral-800">300 Seconds</span>
            </div>
          </div>
        </div>

        {/* Outbound SMTP Guard */}
        <div className="p-4 sm:p-5 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-neutral-100">
            <Mail className="w-4 h-4 text-neutral-900" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Outbound SMTP Dispatch Guard
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">TITAN_MAIL_ENABLED</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-white">
                false (Locked)
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Outbound Transmission</span>
              <span className="font-bold text-neutral-700">Disabled by Policy</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">SMTP Host</span>
              <span className="font-mono text-neutral-800">
                {config?.smtp?.host || 'smtpout.secureserver.net'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">SMTP Port</span>
              <span className="font-mono text-neutral-800">
                {config?.smtp?.port || 465} (SSL)
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-500">Stage B Integration</span>
              <span className="text-neutral-500">Awaiting Dispatch Queue</span>
            </div>
          </div>
        </div>

        {/* Access Control Policy */}
        <div className="p-4 sm:p-5 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-neutral-100">
            <Lock className="w-4 h-4 text-neutral-900" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Role Isolation & Access Control
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Authorized Roles</span>
              <span className="font-bold text-neutral-900">HR, ADMIN</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Employee Role Access</span>
              <span className="font-bold text-neutral-600">Strictly Forbidden (403)</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Frontend Guard</span>
              <span className="font-mono text-neutral-800">ProtectedRoute role check</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-500">Backend API Protection</span>
              <span className="font-mono text-neutral-800">authorizeRoles(HR, ADMIN)</span>
            </div>
          </div>
        </div>

        {/* Database & Schema Integrity */}
        <div className="p-4 sm:p-5 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-neutral-100">
            <Database className="w-4 h-4 text-neutral-900" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
              Supabase Database Storage
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Email Storage Table</span>
              <span className="font-mono font-bold text-neutral-900">
                public.hr_emails ({state?.total_messages_synced ?? '—'} rows synced)
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Checkpoint State Table</span>
              <span className="font-mono font-bold text-neutral-900">public.hr_mailbox_sync_state</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-100">
              <span className="text-neutral-500">Row Level Security</span>
              <span className="font-bold text-neutral-900">Enabled (Service-Role Only)</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-500">Compound Key</span>
              <span className="font-mono text-[11px] text-neutral-700">
                (mailbox, folder, uidvalidity, uid)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
