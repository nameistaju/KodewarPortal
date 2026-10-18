import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Paperclip,
  Clock,
  ArrowUpRight,
  Database,
  Filter,
  AlertCircle,
  FileText,
  Plus,
  X,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Trash2,
  Mail,
  ExternalLink,
  ShieldCheck,
  History,
  UserCheck,
  Building,
  Briefcase,
  Phone,
  Tag,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getCandidates,
  getCandidateById,
  createCandidate,
  updateCandidateStatus,
  unlinkEmailFromCandidate,
  createCandidateFromEmail
} from '../../api/hrCandidateApi';
import { formatDate } from '../../api/helpers';
import { classifyEmailCategory } from './hrHelpers';

const STATUS_BADGES = {
  APPLIED: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  SCREENING: 'bg-amber-50 text-amber-900 border-amber-300',
  ASSESSMENT: 'bg-blue-50 text-blue-900 border-blue-300',
  INTERVIEW: 'bg-purple-50 text-purple-900 border-purple-300',
  OFFER: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  HIRED: 'bg-neutral-900 text-white border-neutral-900',
  REJECTED: 'bg-rose-50 text-rose-800 border-rose-300',
  ARCHIVED: 'bg-neutral-200 text-neutral-600 border-neutral-300'
};

const ALL_STATUSES = [
  'APPLIED',
  'SCREENING',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
  'ARCHIVED'
];

export default function HrCandidatesView({
  emails = [],
  onSelectEmail,
  schemaPending = false,
  onRetrySchema
}) {
  const [candidates, setCandidates] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalCount: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSchemaError, setIsSchemaError] = useState(false);


  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');

  // Candidate Detail Drawer
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');

  // Create Candidate Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    targetRole: '',
    source: 'EMAIL',
    notes: '',
    allowDuplicate: false
  });
  const [duplicateConflict, setDuplicateConflict] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch Candidates from API
  const fetchCandidateList = useCallback(
    async (page = 1, q = search, status = statusFilter, source = sourceFilter) => {
      setLoading(true);
      setError(null);
      setIsSchemaError(false);
      try {
        const params = { page, limit: 15 };
        if (q.trim()) params.search = q.trim();
        if (status !== 'ALL') params.status = status;
        if (source !== 'ALL') params.source = source;

        const data = await getCandidates(params);
        setCandidates(data.candidates || []);
        setPagination(data.pagination || { page: 1, limit: 15, totalCount: 0, totalPages: 1 });
      } catch (err) {
        const isPending =
          err.response?.data?.code === 'SCHEMA_MIGRATION_PENDING' ||
          err.response?.status === 503 ||
          (err.message && err.message.includes('schema cache')) ||
          (err.response?.data?.message && err.response.data.message.includes('schema cache'));
        if (isPending) {
          setIsSchemaError(true);
        }
        setError(err.response?.data?.message || err.message || 'Failed to load candidates.');
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, sourceFilter]
  );

  useEffect(() => {
    fetchCandidateList(1, search, statusFilter, sourceFilter);
  }, [fetchCandidateList, search, statusFilter, sourceFilter]);

  // Load detailed profile when a candidate is selected
  const loadCandidateDetail = useCallback(async (id) => {
    if (!id) {
      setSelectedCandidate(null);
      return;
    }
    setDetailLoading(true);
    try {
      const data = await getCandidateById(id);
      setSelectedCandidate(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load candidate details');
      setSelectedCandidateId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCandidateId) {
      loadCandidateDetail(selectedCandidateId);
    } else {
      setSelectedCandidate(null);
    }
  }, [selectedCandidateId, loadCandidateDetail]);

  // Handle Status Update
  const handleConfirmStatusChange = async () => {
    if (!selectedCandidate || !targetStatus) return;
    setStatusChanging(true);
    try {
      await updateCandidateStatus(selectedCandidate.id, targetStatus, statusReason);
      toast.success(`Status updated to ${targetStatus}`);
      setShowStatusModal(false);
      setStatusReason('');
      await loadCandidateDetail(selectedCandidate.id);
      fetchCandidateList(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update candidate status');
    } finally {
      setStatusChanging(false);
    }
  };

  // Handle Unlink Email
  const handleUnlinkEmail = async (emailId) => {
    if (!selectedCandidate || !window.confirm('Are you sure you want to unlink this email from the candidate?')) {
      return;
    }
    try {
      await unlinkEmailFromCandidate(selectedCandidate.id, emailId);
      toast.success('Email linkage removed');
      await loadCandidateDetail(selectedCandidate.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unlink email');
    }
  };

  // Handle Create Candidate Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setDuplicateConflict(null);
    try {
      const res = await createCandidate(createForm);
      toast.success(`Candidate ${res.full_name} created successfully`);
      setShowCreateModal(false);
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        targetRole: '',
        source: 'EMAIL',
        notes: '',
        allowDuplicate: false
      });
      fetchCandidateList(1);
      setSelectedCandidateId(res.id);
    } catch (err) {
      if (err.response?.status === 409) {
        const details = err.response.data?.errors?.[0] || {};
        setDuplicateConflict({
          message: err.response.data?.message || 'Duplicate email detected',
          existing: details.existingCandidate
        });
      } else {
        toast.error(err.response?.data?.message || 'Failed to create candidate');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Quick 1-click convert an incoming unlinked email into a persistent candidate
  const handleConvertEmailToCandidate = async (emailRecord) => {
    try {
      const res = await createCandidateFromEmail({
        emailId: emailRecord.id,
        allowDuplicate: false
      });
      toast.success(`Candidate created and linked for ${res.full_name}`);
      fetchCandidateList(1);
      setSelectedCandidateId(res.id);
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Candidate with this email already exists.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to convert email to candidate');
      }
    }
  };

  // Unlinked emails from sample that match application criteria
  const unlinkedApplications = useMemo(() => {
    if (!emails || emails.length === 0) return [];
    const linkedEmailIds = new Set();
    if (selectedCandidate?.linkedEmails) {
      selectedCandidate.linkedEmails.forEach((l) => linkedEmailIds.add(l.emailId));
    }
    return emails
      .filter((e) => {
        const cat = classifyEmailCategory(e);
        return (cat === 'Job Application' || e.has_attachments) && !linkedEmailIds.has(e.id);
      })
      .slice(0, 5);
  }, [emails, selectedCandidate]);

  return (
    <div className="space-y-4">
      {/* Enterprise Architecture Header */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-neutral-900">Candidate Talent Pipeline</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-white">
              Stage B1 Active
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Real, persistent candidate records stored in <code>public.hr_candidates</code>, linked to inbound mailbox records.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchCandidateList(pagination.page)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDuplicateConflict(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Candidate</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg text-xs bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">
            Status:
          </span>
          <div className="flex items-center gap-1">
            {['ALL', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Layout: Table & Optional Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Candidates Table (expands or shares with drawer) */}
        <div className={`${selectedCandidateId ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all`}>
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Target Role</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-neutral-400">
                        <RefreshCw className="w-5 h-5 mx-auto text-neutral-400 animate-spin mb-2" />
                        <p className="text-xs font-semibold text-neutral-600">Loading candidates...</p>
                      </td>
                    </tr>
                  ) : isSchemaError || schemaPending ? (
                    <tr>
                      <td colSpan={6} className="py-10 px-4 text-center">
                        <div className="max-w-md mx-auto p-4 rounded-xl border border-amber-300 bg-amber-50/90 text-left">
                          <div className="flex items-start gap-2.5">
                            <Database className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                            <div>
                              <h4 className="text-xs font-bold text-amber-950">
                                Database Setup Required: Table public.hr_candidates Pending
                              </h4>
                              <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                                Persistent candidate profiles require the consolidated Stage B2 database migration. Follow these 2 steps:
                              </p>
                              <ol className="text-[11px] text-amber-900 mt-2 space-y-1 list-decimal list-inside font-medium">
                                <li>Open <strong>Supabase Dashboard</strong> &rarr; <strong>SQL Editor</strong></li>
                                <li>Paste and run the consolidated migration script below:</li>
                              </ol>
                              <div className="mt-2 flex items-center gap-1.5">
                                <span className="font-mono text-[10px] bg-white px-2 py-1 rounded border border-amber-300 text-neutral-800 select-all truncate max-w-[260px]">
                                  backend/src/db/migrations/000_stage_b2_consolidated_migration.sql
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText('backend/src/db/migrations/000_stage_b2_consolidated_migration.sql');
                                    toast.success('Script path copied to clipboard');
                                  }}
                                  className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-semibold text-[10px] transition cursor-pointer flex items-center gap-1 shrink-0"
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onRetrySchema) onRetrySchema();
                                  fetchCandidateList(1);
                                }}
                                className="mt-3 w-full py-1.5 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Verify Database & Refresh
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-rose-600">
                        <AlertCircle className="w-5 h-5 mx-auto text-rose-500 mb-1" />
                        <p className="text-xs font-bold">{error}</p>
                        <button
                          type="button"
                          onClick={() => fetchCandidateList(1)}
                          className="mt-2 text-xs font-semibold text-neutral-700 underline cursor-pointer"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : candidates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-neutral-500">
                        <Users className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                        <p className="text-xs font-bold text-neutral-800">No persistent candidates found</p>
                        <p className="text-[11px] text-neutral-500 max-w-sm mx-auto mt-1">
                          You can create a candidate profile manually using "New Candidate", or convert an incoming job application from your inbox.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowCreateModal(true)}
                          className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create First Candidate</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    candidates.map((c) => {
                      const isSelected = selectedCandidateId === c.id;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedCandidateId(c.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50/70'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                              <span>{c.full_name}</span>
                            </div>
                            <div className="text-[11px] font-mono text-neutral-500">{c.email}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-neutral-800">
                            {c.target_role || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                              {c.source}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                                STATUS_BADGES[c.status] || 'bg-neutral-100 text-neutral-700 border-neutral-200'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-500 whitespace-nowrap text-[11px]">
                            {formatDate(c.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCandidateId(c.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                            >
                              <span>View Profile</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600 bg-neutral-50/50">
              <span className="text-[11px] font-medium text-neutral-400">
                Showing {candidates.length} of {pagination.totalCount} candidates
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchCandidateList(pagination.page - 1)}
                  className="p-1 rounded-md border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-bold px-1.5">
                  {pagination.page} / {Math.max(1, pagination.totalPages)}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => fetchCandidateList(pagination.page + 1)}
                  className="p-1 rounded-md border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Inbound Applications (Convert to Candidate) */}
          {unlinkedApplications.length > 0 && (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-neutral-700" />
                  <h3 className="text-xs font-bold text-neutral-900">
                    Recent Unlinked Email Applications ({unlinkedApplications.length})
                  </h3>
                </div>
                <span className="text-[10px] text-neutral-400">1-Click Persistent Ingestion</span>
              </div>
              <div className="divide-y divide-neutral-100">
                {unlinkedApplications.map((app) => (
                  <div key={app.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-neutral-900 truncate">
                          {app.from_name || app.from_address}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">UID {app.uid}</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 truncate">{app.subject || '(No Subject)'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConvertEmailToCandidate(app)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-neutral-100 hover:bg-neutral-900 hover:text-white text-neutral-800 transition-colors cursor-pointer shrink-0"
                    >
                      <span>Convert to Candidate</span>
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Candidate Detail Drawer (5 Cols when open) */}
        {selectedCandidateId && (
          <div className="lg:col-span-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
            {detailLoading ? (
              <div className="py-16 text-center text-neutral-400">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                <p className="text-xs font-semibold">Loading candidate profile...</p>
              </div>
            ) : selectedCandidate ? (
              <div className="space-y-4">
                {/* Header & Close */}
                <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">
                      {selectedCandidate.full_name}
                    </h3>
                    <p className="text-xs text-neutral-500 font-mono">{selectedCandidate.email}</p>
                    {selectedCandidate.phone && (
                      <p className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{selectedCandidate.phone}</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateId(null)}
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Status & Quick Transition */}
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Current Status:
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                        STATUS_BADGES[selectedCandidate.status] || 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {selectedCandidate.status}
                    </span>
                  </div>

                  <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-neutral-400">Move to:</span>
                    {ALL_STATUSES.filter((s) => s !== selectedCandidate.status).slice(0, 4).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setTargetStatus(st);
                          setStatusReason('');
                          setShowStatusModal(true);
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-neutral-200 hover:border-neutral-900 text-neutral-800 transition-colors cursor-pointer"
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Candidate Overview Details */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-500">Target Role</span>
                    <span className="font-semibold text-neutral-900">{selectedCandidate.target_role || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-500">Source</span>
                    <span className="font-semibold text-neutral-900">{selectedCandidate.source}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-100">
                    <span className="text-neutral-500">Created At</span>
                    <span className="font-semibold text-neutral-900">{formatDate(selectedCandidate.created_at)}</span>
                  </div>
                  {selectedCandidate.notes && (
                    <div className="pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Notes:</span>
                      <p className="text-xs text-neutral-700 mt-0.5 bg-neutral-50 p-2 rounded border border-neutral-200 leading-relaxed">
                        {selectedCandidate.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Linked Inbound Emails */}
                <div className="space-y-2 pt-2 border-t border-neutral-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-neutral-700" />
                      <span>Linked Mailbox Messages ({selectedCandidate.linkedEmails?.length || 0})</span>
                    </h4>
                  </div>

                  {(!selectedCandidate.linkedEmails || selectedCandidate.linkedEmails.length === 0) ? (
                    <div className="p-3 text-center rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-400 text-xs">
                      No emails currently linked to this candidate.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {selectedCandidate.linkedEmails.map((l) => (
                        <div
                          key={l.linkId}
                          className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 transition-colors text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-neutral-900 truncate">
                              {l.email?.subject || '(No Subject)'}
                            </span>
                            <span className="text-[10px] text-neutral-400 shrink-0">
                              UID {l.email?.uid ?? '—'}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 line-clamp-1">{l.email?.snippet}</p>
                          <div className="flex items-center justify-between pt-1 text-[10px]">
                            <span className="text-neutral-400">
                              Linked {formatDate(l.linkedAt)} by {l.linkedBy}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {onSelectEmail && l.emailId && (
                                <button
                                  type="button"
                                  onClick={() => onSelectEmail(l.emailId)}
                                  className="inline-flex items-center gap-0.5 text-neutral-700 hover:text-neutral-900 font-bold cursor-pointer"
                                >
                                  <span>View</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleUnlinkEmail(l.emailId)}
                                className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer ml-1"
                                title="Unlink email"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit Trail Section */}
                <div className="space-y-2 pt-2 border-t border-neutral-200">
                  <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-neutral-700" />
                    <span>Audit Trail ({selectedCandidate.auditLogs?.length || 0})</span>
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {(!selectedCandidate.auditLogs || selectedCandidate.auditLogs.length === 0) ? (
                      <p className="text-[11px] text-neutral-400 italic">No audit records.</p>
                    ) : (
                      selectedCandidate.auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="text-[11px] p-2 rounded bg-neutral-50 border border-neutral-200 space-y-0.5"
                        >
                          <div className="flex items-center justify-between font-bold text-neutral-800">
                            <span className="uppercase tracking-wider text-[9px] px-1 rounded bg-neutral-200 text-neutral-700">
                              {log.action}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-normal">
                              {formatDate(log.created_at)}
                            </span>
                          </div>
                          {log.reason && <p className="text-neutral-600 italic">"{log.reason}"</p>}
                          <p className="text-[10px] text-neutral-400 font-mono">By: {log.performed_by}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Status Change Confirmation Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-sm font-bold text-neutral-900">
              Confirm Status Transition
            </h3>
            <p className="text-xs text-neutral-600">
              Update status of <strong>{selectedCandidate?.full_name}</strong> to{' '}
              <span className="font-bold text-neutral-900">{targetStatus}</span>?
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Audit Reason (Optional)
              </label>
              <input
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g. Completed initial tech interview"
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={statusChanging}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {statusChanging ? 'Saving...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Candidate Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-neutral-800" />
                <span>Create Candidate Profile</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded text-neutral-400 hover:text-neutral-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {duplicateConflict && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Duplicate Candidate Detected</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {duplicateConflict.message}
                </p>
                <label className="flex items-center gap-2 text-xs font-bold text-neutral-900 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={createForm.allowDuplicate}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, allowDuplicate: e.target.checked }))
                    }
                    className="rounded border-neutral-300"
                  />
                  <span>Confirm manual override to create duplicate profile</span>
                </label>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="+91 / +1"
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Target Role
                  </label>
                  <input
                    type="text"
                    value={createForm.targetRole}
                    onChange={(e) => setCreateForm({ ...createForm, targetRole: e.target.value })}
                    placeholder="e.g. Backend Engineer"
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Initial Notes
                </label>
                <textarea
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="Recruiter notes or candidate summary"
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Save Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
