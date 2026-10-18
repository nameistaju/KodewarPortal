import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Briefcase,
  Search,
  Plus,
  MapPin,
  Clock,
  CheckCircle2,
  Database,
  Building,
  RefreshCw,
  Users,
  Filter,
  AlertCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Mail,
  ExternalLink,
  History,
  Archive,
  Edit2,
  Tag,
  Check,
  Instagram,
  Globe,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getJobs, createJob, updateJob, archiveJob } from '../../api/hrJobApi';
import {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplicationStatus
} from '../../api/hrApplicationApi';
import { getCandidates } from '../../api/hrCandidateApi';
import { formatDate } from '../../api/helpers';

const STATUS_BADGES = {
  APPLIED: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  SCREENING: 'bg-amber-50 text-amber-900 border-amber-300',
  ASSESSMENT: 'bg-blue-50 text-blue-900 border-blue-300',
  INTERVIEW: 'bg-purple-50 text-purple-900 border-purple-300',
  OFFER: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  HIRED: 'bg-neutral-900 text-white border-neutral-900',
  REJECTED: 'bg-rose-50 text-rose-800 border-rose-300',
  WITHDRAWN: 'bg-neutral-200 text-neutral-600 border-neutral-300'
};

const JOB_STATUS_BADGES = {
  OPEN: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  DRAFT: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  PAUSED: 'bg-amber-50 text-amber-900 border-amber-300',
  CLOSED: 'bg-rose-50 text-rose-900 border-rose-300',
  ARCHIVED: 'bg-neutral-200 text-neutral-600 border-neutral-300'
};

const SOURCE_BADGES = {
  INSTAGRAM: 'bg-pink-50 text-pink-900 border-pink-200',
  EMAIL: 'bg-blue-50 text-blue-900 border-blue-200',
  REFERRAL: 'bg-amber-50 text-amber-900 border-amber-200',
  WEBSITE: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  CAREERS_PAGE: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  OTHER: 'bg-neutral-100 text-neutral-700 border-neutral-200'
};

export default function HrJobsView({
  emails = [],
  onSelectEmail,
  schemaPending = false,
  onRetrySchema
}) {
  const [activeSubTab, setActiveSubTab] = useState('pipeline'); // 'pipeline' | 'jobs'

  // Jobs State
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobError, setJobError] = useState(null);
  const [isJobSchemaError, setIsJobSchemaError] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('ALL');
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: '',
    department: 'Engineering',
    location: 'Bengaluru / Remote',
    employmentType: 'FULL_TIME',
    openingsCount: 1,
    description: '',
    requiredSkills: '',
    status: 'OPEN'
  });
  const [submittingJob, setSubmittingJob] = useState(false);

  // Applications State
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [appError, setAppError] = useState(null);
  const [isAppSchemaError, setIsAppSchemaError] = useState(false);
  const [appSearch, setAppSearch] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('ALL');
  const [appSourceFilter, setAppSourceFilter] = useState('ALL');
  const [appJobFilter, setAppJobFilter] = useState('ALL');
  const [appPagination, setAppPagination] = useState({ page: 1, limit: 15, totalCount: 0, totalPages: 1 });

  // Application Detail Drawer
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [targetStatus, setTargetStatus] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  // New Application Modal
  const [showCreateAppModal, setShowCreateAppModal] = useState(false);
  const [candidateList, setCandidateList] = useState([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [candidateSearchText, setCandidateSearchText] = useState('');
  const [appForm, setAppForm] = useState({
    candidateId: '',
    jobId: '',
    source: 'EMAIL',
    notes: '',
    allowDuplicate: false
  });
  const [appDuplicateWarning, setAppDuplicateWarning] = useState(null);
  const [submittingApp, setSubmittingApp] = useState(false);

  // Fetch Jobs
  const fetchJobsList = useCallback(async () => {
    setLoadingJobs(true);
    setJobError(null);
    setIsJobSchemaError(false);
    try {
      const data = await getJobs({ limit: 100 });
      setJobs(data.jobs || []);
    } catch (err) {
      setJobs([]);
      const isPending =
        err.response?.data?.code === 'SCHEMA_MIGRATION_PENDING' ||
        err.response?.status === 503 ||
        (err.message && err.message.includes('schema cache')) ||
        (err.response?.data?.message && err.response.data.message.includes('schema cache'));
      if (isPending) setIsJobSchemaError(true);
      setJobError(err.response?.data?.message || err.message || 'Failed to fetch job requisitions');
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Fetch Applications
  const fetchApplicationsList = useCallback(
    async (page = 1, q = appSearch, status = appStatusFilter, source = appSourceFilter, jobId = appJobFilter) => {
      setLoadingApps(true);
      setAppError(null);
      setIsAppSchemaError(false);
      try {
        const params = { page, limit: 15 };
        if (q.trim()) params.search = q.trim();
        if (status !== 'ALL') params.status = status;
        if (source !== 'ALL') params.source = source;
        if (jobId !== 'ALL') params.jobId = jobId;

        const data = await getApplications(params);
        setApplications(data.applications || []);
        setAppPagination(data.pagination || { page: 1, limit: 15, totalCount: 0, totalPages: 1 });
      } catch (err) {
        setApplications([]);
        const isPending =
          err.response?.data?.code === 'SCHEMA_MIGRATION_PENDING' ||
          err.response?.status === 503 ||
          (err.message && err.message.includes('schema cache')) ||
          (err.response?.data?.message && err.response.data.message.includes('schema cache'));
        if (isPending) setIsAppSchemaError(true);
        setAppError(err.response?.data?.message || err.message || 'Failed to fetch applications');
      } finally {
        setLoadingApps(false);
      }
    },
    [appSearch, appStatusFilter, appSourceFilter, appJobFilter]
  );

  useEffect(() => {
    fetchJobsList();
  }, [fetchJobsList]);

  useEffect(() => {
    fetchApplicationsList(1, appSearch, appStatusFilter, appSourceFilter, appJobFilter);
  }, [fetchApplicationsList, appSearch, appStatusFilter, appSourceFilter, appJobFilter]);

  // Load Application Detail
  const loadAppDetail = useCallback(async (id) => {
    if (!id) {
      setSelectedApp(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const data = await getApplicationById(id);
      setSelectedApp(data);
    } catch (err) {
      toast.error('Failed to load application details');
      setSelectedAppId(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      loadAppDetail(selectedAppId);
    } else {
      setSelectedApp(null);
    }
  }, [selectedAppId, loadAppDetail]);

  // Search candidates for creating an application
  const searchCandidatesForApp = async (q) => {
    setSearchingCandidates(true);
    try {
      const data = await getCandidates({ search: q, limit: 10 });
      setCandidateList(data.candidates || []);
    } catch {
      setCandidateList([]);
    } finally {
      setSearchingCandidates(false);
    }
  };

  // Create Job Handler
  const handleCreateJobSubmit = async (e) => {
    e.preventDefault();
    setSubmittingJob(true);
    try {
      const skillsArray = jobForm.requiredSkills
        ? jobForm.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      await createJob({
        ...jobForm,
        requiredSkills: skillsArray
      });

      toast.success('Job requisition created successfully');
      setShowCreateJobModal(false);
      setJobForm({
        title: '',
        department: 'Engineering',
        location: 'Bengaluru / Remote',
        employmentType: 'FULL_TIME',
        openingsCount: 1,
        description: '',
        requiredSkills: '',
        status: 'OPEN'
      });
      fetchJobsList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create job requisition');
    } finally {
      setSubmittingJob(false);
    }
  };

  // Archive Job Handler
  const handleArchiveJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to archive this job requisition?')) return;
    try {
      await archiveJob(jobId);
      toast.success('Job requisition archived');
      fetchJobsList();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to archive job');
    }
  };

  // Create Application Handler
  const handleCreateAppSubmit = async (e) => {
    e.preventDefault();
    if (!appForm.candidateId) {
      toast.error('Please select a candidate');
      return;
    }
    setSubmittingApp(true);
    setAppDuplicateWarning(null);
    try {
      await createApplication({
        candidateId: appForm.candidateId,
        jobId: appForm.jobId || null,
        source: appForm.source,
        notes: appForm.notes,
        allowDuplicate: appForm.allowDuplicate
      });
      toast.success('Application created in pipeline');
      setShowCreateAppModal(false);
      setAppForm({ candidateId: '', jobId: '', source: 'EMAIL', notes: '', allowDuplicate: false });
      fetchApplicationsList(1);
    } catch (err) {
      if (err.response?.status === 409) {
        setAppDuplicateWarning(err.response.data?.message || 'Duplicate application detected');
      } else {
        toast.error(err.response?.data?.message || 'Failed to create application');
      }
    } finally {
      setSubmittingApp(false);
    }
  };

  // Application Status Transition Handler
  const handleConfirmStatusChange = async () => {
    if (!selectedApp || !targetStatus) return;
    setStatusChanging(true);
    try {
      await updateApplicationStatus(selectedApp.id, targetStatus, statusReason);
      toast.success(`Application updated to ${targetStatus}`);
      setShowStatusModal(false);
      setStatusReason('');
      await loadAppDetail(selectedApp.id);
      fetchApplicationsList(appPagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusChanging(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Subtabs & Creation Controls */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-neutral-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveSubTab('pipeline')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'pipeline'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Application Pipeline</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-neutral-200 text-neutral-800">
                {appPagination.totalCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('jobs')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'jobs'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Job Requisitions</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-neutral-200 text-neutral-800">
                {jobs.length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'pipeline' ? (
            <button
              type="button"
              onClick={() => {
                setAppDuplicateWarning(null);
                searchCandidatesForApp('');
                setShowCreateAppModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Application</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateJobModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Requisition</span>
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: APPLICATION PIPELINE                                        */}
      {/* =================================================================== */}
      {activeSubTab === 'pipeline' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search candidate name, email, or role..."
                className="w-full pl-9 pr-4 py-1.5 rounded-lg text-xs bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Job filter dropdown */}
              <select
                value={appJobFilter}
                onChange={(e) => setAppJobFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
              >
                <option value="ALL">All Jobs</option>
                <option value="UNASSIGNED">Unassigned Review Queue</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({j.job_code})
                  </option>
                ))}
              </select>

              {/* Source filter */}
              <select
                value={appSourceFilter}
                onChange={(e) => setAppSourceFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
              >
                <option value="ALL">All Sources</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="EMAIL">Email</option>
                <option value="REFERRAL">Referral</option>
                <option value="WEBSITE">Website</option>
                <option value="OTHER">Other</option>
              </select>

              {/* Status filter */}
              <select
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPLIED">Applied</option>
                <option value="SCREENING">Screening</option>
                <option value="ASSESSMENT">Assessment</option>
                <option value="INTERVIEW">Interview</option>
                <option value="OFFER">Offer</option>
                <option value="HIRED">Hired</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Main Applications Table & Optional Detail Drawer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`${selectedAppId ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all`}>
              <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        <th className="px-4 py-3">Candidate</th>
                        <th className="px-4 py-3">Job Requisition</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Applied Date</th>
                        <th className="px-4 py-3">Pipeline Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {loadingApps ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-neutral-400">
                            <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
                            <p className="text-xs font-semibold">Loading applications...</p>
                          </td>
                        </tr>
                      ) : isAppSchemaError || schemaPending ? (
                        <tr>
                          <td colSpan={6} className="py-10 px-4 text-center">
                            <div className="max-w-md mx-auto p-4 rounded-xl border border-amber-300 bg-amber-50/90 text-left">
                              <div className="flex items-start gap-2.5">
                                <Database className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                                <div>
                                  <h4 className="text-xs font-bold text-amber-950">
                                    Database Setup Required: Table public.hr_applications Pending
                                  </h4>
                                  <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                                    The application tracking pipeline requires the consolidated Stage B2 database migration.
                                  </p>
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
                                      fetchApplicationsList(1);
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
                      ) : appError ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-rose-600">
                            <AlertCircle className="w-5 h-5 mx-auto text-rose-500 mb-1" />
                            <p className="text-xs font-bold">{appError}</p>
                          </td>
                        </tr>
                      ) : applications.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-neutral-400">
                            <Users className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                            <p className="text-xs font-bold text-neutral-700">No applications match your filters</p>
                            <p className="text-[11px] text-neutral-400 mt-1">
                              Create an application or link one from incoming mailbox messages.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        applications.map((app) => {
                          const isSelected = selectedAppId === app.id;
                          return (
                            <tr
                              key={app.id}
                              onClick={() => setSelectedAppId(app.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50/70'
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="font-bold text-neutral-900">{app.candidate?.full_name || '—'}</div>
                                <div className="text-[11px] font-mono text-neutral-500">{app.candidate?.email || '—'}</div>
                              </td>
                              <td className="px-4 py-3">
                                {app.job ? (
                                  <div>
                                    <div className="font-semibold text-neutral-900">{app.job.title}</div>
                                    <div className="text-[10px] text-neutral-500 font-mono">{app.job.job_code} · {app.job.department}</div>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                                    <AlertCircle className="w-3 h-3 text-amber-600" />
                                    Unassigned Review
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                                    SOURCE_BADGES[app.source] || 'bg-neutral-100 text-neutral-700 border-neutral-200'
                                  }`}
                                >
                                  {app.source}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-neutral-500 whitespace-nowrap text-[11px]">
                                {formatDate(app.applied_at)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                                    STATUS_BADGES[app.status] || 'bg-neutral-100 text-neutral-700 border-neutral-200'
                                  }`}
                                >
                                  {app.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAppId(app.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                                >
                                  <span>Details</span>
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
                    Showing {applications.length} of {appPagination.totalCount} applications
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={appPagination.page <= 1 || loadingApps}
                      onClick={() => fetchApplicationsList(appPagination.page - 1)}
                      className="p-1 rounded-md border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-bold px-1.5">
                      {appPagination.page} / {Math.max(1, appPagination.totalPages)}
                    </span>
                    <button
                      type="button"
                      disabled={appPagination.page >= appPagination.totalPages || loadingApps}
                      onClick={() => fetchApplicationsList(appPagination.page + 1)}
                      className="p-1 rounded-md border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Detail Drawer (5 Cols) */}
            {selectedAppId && (
              <div className="lg:col-span-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
                {loadingDetail ? (
                  <div className="py-16 text-center text-neutral-400">
                    <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                    <p className="text-xs font-semibold">Loading application details...</p>
                  </div>
                ) : selectedApp ? (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-neutral-900">
                          {selectedApp.candidate?.full_name}
                        </h3>
                        <p className="text-xs text-neutral-500 font-mono">{selectedApp.candidate?.email}</p>
                        {selectedApp.job ? (
                          <p className="text-xs font-semibold text-neutral-800 mt-1">
                            Applied for: {selectedApp.job.title} ({selectedApp.job.job_code})
                          </p>
                        ) : (
                          <p className="text-xs font-bold text-amber-700 mt-1">
                            Job: Unassigned (Awaiting Review)
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAppId(null)}
                        className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Status & Transitions */}
                    <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          Stage:
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                            STATUS_BADGES[selectedApp.status] || 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {selectedApp.status}
                        </span>
                      </div>

                      <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-neutral-400">Advance to:</span>
                        {['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']
                          .filter((s) => s !== selectedApp.status)
                          .map((st) => (
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

                    {/* Application Info */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-500">Source</span>
                        <span className="font-semibold text-neutral-900">{selectedApp.source}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-neutral-100">
                        <span className="text-neutral-500">Applied At</span>
                        <span className="font-semibold text-neutral-900">{formatDate(selectedApp.applied_at)}</span>
                      </div>
                      {selectedApp.notes && (
                        <div className="pt-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Notes:</span>
                          <p className="text-xs text-neutral-700 mt-0.5 bg-neutral-50 p-2 rounded border border-neutral-200">
                            {selectedApp.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Linked Email Details */}
                    {selectedApp.email && (
                      <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                            <Mail className="w-3.5 h-3.5 text-neutral-700" />
                            <span>Linked Inbound Email</span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            UID {selectedApp.email.uid}
                          </span>
                        </div>
                        <p className="font-semibold text-neutral-800 truncate">
                          {selectedApp.email.subject || '(No Subject)'}
                        </p>
                        <p className="text-[11px] text-neutral-500 line-clamp-2">
                          {selectedApp.email.snippet}
                        </p>
                        {onSelectEmail && (
                          <div className="pt-1 text-right">
                            <button
                              type="button"
                              onClick={() => onSelectEmail(selectedApp.email.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-900 hover:underline cursor-pointer"
                            >
                              <span>Open in Mailbox Inbox</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Audit Trail */}
                    <div className="space-y-2 pt-2 border-t border-neutral-200">
                      <h4 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-neutral-700" />
                        <span>Application History ({selectedApp.auditLogs?.length || 0})</span>
                      </h4>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {(!selectedApp.auditLogs || selectedApp.auditLogs.length === 0) ? (
                          <p className="text-[11px] text-neutral-400 italic">No audit history recorded.</p>
                        ) : (
                          selectedApp.auditLogs.map((log) => (
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
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: JOB REQUISITIONS                                            */}
      {/* =================================================================== */}
      {activeSubTab === 'jobs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingJobs ? (
              <div className="col-span-full py-12 text-center text-neutral-400">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
                <p className="text-xs font-semibold">Loading job requisitions...</p>
              </div>
            ) : isJobSchemaError || schemaPending ? (
              <div className="col-span-full py-10 px-4">
                <div className="max-w-md mx-auto p-4 rounded-xl border border-amber-300 bg-amber-50/90 text-left">
                  <div className="flex items-start gap-2.5">
                    <Database className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">
                        Database Setup Required: Table public.hr_jobs Pending
                      </h4>
                      <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                        Job requisitions require the consolidated Stage B2 database migration.
                      </p>
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
                          fetchJobsList();
                        }}
                        className="mt-3 w-full py-1.5 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Verify Database & Refresh
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : jobError ? (
              <div className="col-span-full py-8 text-center text-rose-600">
                <AlertCircle className="w-5 h-5 mx-auto text-rose-500 mb-1" />
                <p className="text-xs font-bold">{jobError}</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="col-span-full py-12 text-center text-neutral-400">
                <Briefcase className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                <p className="text-xs font-bold text-neutral-700">No job requisitions created yet</p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Create your first job requisition to organize incoming talent applications.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateJobModal(true)}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Requisition</span>
                </button>
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 rounded-xl border border-neutral-200 bg-white shadow-xs hover:border-neutral-300 transition-all flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-neutral-500">{job.job_code}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold border uppercase tracking-wider ${
                          JOB_STATUS_BADGES[job.status] || 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-neutral-900 mt-2 leading-tight">
                      {job.title}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">{job.department}</p>

                    <div className="mt-3 space-y-1.5 text-[11px] text-neutral-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-neutral-400" />
                        <span>{job.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3 h-3 text-neutral-400" />
                        <span className="capitalize">{job.employment_type?.replace('_', ' ').toLowerCase()}</span>
                        <span className="text-neutral-400">· {job.openings_count} openings</span>
                      </div>
                    </div>

                    {job.required_skills && job.required_skills.length > 0 && (
                      <div className="mt-3 flex items-center gap-1 flex-wrap">
                        {job.required_skills.slice(0, 4).map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.required_skills.length > 4 && (
                          <span className="text-[10px] text-neutral-400">+{job.required_skills.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setAppJobFilter(job.id);
                        setActiveSubTab('pipeline');
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-900 hover:underline cursor-pointer"
                    >
                      <Users className="w-3 h-3" />
                      <span>{job.applicationsCount || 0} Applications</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleArchiveJob(job.id)}
                      className="p-1 text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Archive Requisition"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE JOB REQUISITION                                       */}
      {/* =================================================================== */}
      {showCreateJobModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-neutral-800" />
                <span>Create Job Requisition</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateJobModal(false)}
                className="p-1 rounded text-neutral-400 hover:text-neutral-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJobSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Job Title *
                </label>
                <input
                  type="text"
                  required
                  value={jobForm.title}
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  placeholder="e.g. Senior Full Stack Engineer"
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    value={jobForm.department}
                    onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                    placeholder="Engineering / Product"
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Employment Type
                  </label>
                  <select
                    value={jobForm.employmentType}
                    onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Openings Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={jobForm.openingsCount}
                    onChange={(e) => setJobForm({ ...jobForm, openingsCount: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Required Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={jobForm.requiredSkills}
                  onChange={(e) => setJobForm({ ...jobForm, requiredSkills: e.target.value })}
                  placeholder="React, Node.js, PostgreSQL"
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Description & Scope
                </label>
                <textarea
                  rows={2}
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  placeholder="Role summary and responsibilities"
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowCreateJobModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingJob}
                  className="px-4 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {submittingJob ? 'Creating...' : 'Create Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CREATE APPLICATION                                           */}
      {/* =================================================================== */}
      {showCreateAppModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-neutral-800" />
                <span>Create Pipeline Application</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateAppModal(false)}
                className="p-1 rounded text-neutral-400 hover:text-neutral-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {appDuplicateWarning && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1.5">
                <p className="font-semibold">{appDuplicateWarning}</p>
                <label className="flex items-center gap-2 font-bold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={appForm.allowDuplicate}
                    onChange={(e) => setAppForm({ ...appForm, allowDuplicate: e.target.checked })}
                    className="rounded border-neutral-300"
                  />
                  <span>Confirm manual duplicate override</span>
                </label>
              </div>
            )}

            <form onSubmit={handleCreateAppSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Select Candidate *
                </label>
                <input
                  type="text"
                  value={candidateSearchText}
                  onChange={(e) => {
                    setCandidateSearchText(e.target.value);
                    searchCandidatesForApp(e.target.value);
                  }}
                  placeholder="Type to search candidates..."
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                />

                <div className="mt-1 max-h-32 overflow-y-auto divide-y divide-neutral-100 border border-neutral-200 rounded-lg">
                  {candidateList.length === 0 ? (
                    <div className="p-2 text-center text-[11px] text-neutral-400">No candidates found</div>
                  ) : (
                    candidateList.map((cand) => (
                      <div
                        key={cand.id}
                        onClick={() => setAppForm({ ...appForm, candidateId: cand.id })}
                        className={`p-2 flex items-center justify-between text-xs cursor-pointer ${
                          appForm.candidateId === cand.id ? 'bg-neutral-100 font-bold' : 'hover:bg-neutral-50'
                        }`}
                      >
                        <span className="truncate">{cand.full_name}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">{cand.email}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Target Job Requisition
                </label>
                <select
                  value={appForm.jobId}
                  onChange={(e) => setAppForm({ ...appForm, jobId: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                >
                  <option value="">Leave Unassigned (Awaiting HR Review)</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.job_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Application Source
                </label>
                <select
                  value={appForm.source}
                  onChange={(e) => setAppForm({ ...appForm, source: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                >
                  <option value="EMAIL">Inbound Email</option>
                  <option value="INSTAGRAM">Instagram Advertisement / Post</option>
                  <option value="REFERRAL">Employee Referral</option>
                  <option value="WEBSITE">Careers Website</option>
                  <option value="OTHER">Other Channel</option>
                </select>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  Confirm Instagram as source if application originated from Instagram ad.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={appForm.notes}
                  onChange={(e) => setAppForm({ ...appForm, notes: e.target.value })}
                  placeholder="HR notes or initial screening remarks"
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowCreateAppModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApp}
                  className="px-4 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {submittingApp ? 'Creating...' : 'Create Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: APPLICATION STATUS TRANSITION CONFIRMATION                   */}
      {/* =================================================================== */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-sm font-bold text-neutral-900">
              Confirm Pipeline Stage Change
            </h3>
            <p className="text-xs text-neutral-600">
              Update application for <strong>{selectedApp?.candidate?.full_name}</strong> to{' '}
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
                placeholder="e.g. Cleared technical coding interview"
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
                {statusChanging ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
