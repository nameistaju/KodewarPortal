import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileCheck2,
  Paperclip,
  Search,
  FileText,
  ShieldCheck,
  ArrowUpRight,
  Database,
  Lock,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Check,
  X,
  Filter,
  UserCheck,
  RefreshCw,
  HelpCircle,
  History,
  Link,
  Unlink,
  User,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getDocuments,
  getDocumentById,
  updateDocumentReview,
  linkDocumentToCandidate,
  syncDocumentMetadata
} from '../../api/hrDocumentApi';
import { getCandidates } from '../../api/hrCandidateApi';
import { formatDate } from '../../api/helpers';
import { formatFileSize } from './hrHelpers';

const STATUS_CONFIG = {
  NEEDS_REVIEW: {
    label: 'Needs Review',
    badge: 'bg-amber-50 text-amber-900 border-amber-300',
    description: 'Awaiting manual inspection by HR'
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    badge: 'bg-blue-50 text-blue-900 border-blue-300',
    description: 'Currently being examined by HR'
  },
  ACCEPTED: {
    label: 'Accepted',
    badge: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    description: 'HR review decision approved (Not independent proof of authenticity)'
  },
  REJECTED: {
    label: 'Rejected',
    badge: 'bg-rose-50 text-rose-900 border-rose-300',
    description: 'HR review decision rejected'
  },
  MORE_INFO_REQUIRED: {
    label: 'More Info Required',
    badge: 'bg-purple-50 text-purple-900 border-purple-300',
    description: 'Requires candidate re-submission or additional documentation'
  },
  PENDING: {
    label: 'Needs Review',
    badge: 'bg-amber-50 text-amber-900 border-amber-300',
    description: 'Legacy pending review'
  },
  VERIFIED: {
    label: 'Accepted',
    badge: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    description: 'Legacy accepted decision'
  },
  INCOMPLETE: {
    label: 'More Info Required',
    badge: 'bg-purple-50 text-purple-900 border-purple-300',
    description: 'Legacy incomplete document'
  }
};

const CATEGORY_LABELS = {
  PHOTOGRAPH: 'ID Photo / Photograph',
  OFFER_JOINING_DOCUMENT: 'Offer / Joining Document',
  EDUCATION_CERTIFICATE: 'Education Certificate',
  IDENTITY_DOCUMENT: 'Government ID',
  RESUME: 'Resume / CV',
  EMPLOYMENT_DOCUMENT: 'Employment Document',
  OTHER: 'Supporting Document',
  UNCLASSIFIED: 'Unclassified'
};

export default function HrDocumentVerificationView({ emails = [], onSelectEmail }) {
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalCount: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [docSearch, setDocSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [candidateFilter, setCandidateFilter] = useState('ALL'); // 'ALL' | 'UNLINKED'

  // Document Review Drawer / Modal
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [targetCategory, setTargetCategory] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Candidate Linking
  const [candidateOptions, setCandidateOptions] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [searchingCandidates, setSearchingCandidates] = useState(false);

  // Fetch document queue from API
  const fetchDocuments = useCallback(
    async (page = 1, q = docSearch, status = statusFilter, category = categoryFilter, cand = candidateFilter) => {
      setLoading(true);
      setError(null);
      try {
        const params = { page, limit: 15 };
        if (q.trim()) params.search = q.trim();
        if (status !== 'ALL') params.status = status;
        if (category !== 'ALL') params.category = category;
        if (cand !== 'ALL') params.candidateId = cand;

        const data = await getDocuments(params);
        setDocuments(data.documents || []);
        setPagination(data.pagination || { page: 1, limit: 15, totalCount: 0, totalPages: 1 });
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch document queue');
      } finally {
        setLoading(false);
      }
    },
    [docSearch, statusFilter, categoryFilter, candidateFilter]
  );

  useEffect(() => {
    fetchDocuments(1, docSearch, statusFilter, categoryFilter, candidateFilter);
  }, [fetchDocuments, docSearch, statusFilter, categoryFilter, candidateFilter]);

  // Load detailed document profile with audit trail
  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setSelectedDoc(null);
      return;
    }
    setDetailLoading(true);
    try {
      const doc = await getDocumentById(id);
      setSelectedDoc(doc);
      setTargetStatus(doc.status);
      setTargetCategory(doc.document_type || 'OTHER');
      setReviewNote(doc.review_notes || '');
      setSelectedCandidateId(doc.candidate_id || '');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load document details');
      setSelectedDocId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      loadDetail(selectedDocId);
    } else {
      setSelectedDoc(null);
    }
  }, [selectedDocId, loadDetail]);

  // Fetch available candidates for linking
  const fetchCandidatesForSelect = useCallback(async () => {
    setSearchingCandidates(true);
    try {
      const data = await getCandidates({ limit: 50 });
      setCandidateOptions(data.candidates || []);
    } catch {
      setCandidateOptions([]);
    } finally {
      setSearchingCandidates(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      fetchCandidatesForSelect();
    }
  }, [selectedDocId, fetchCandidatesForSelect]);

  // Handle Sync Attachment Metadata
  const handleSyncMetadata = async () => {
    setSyncing(true);
    try {
      const res = await syncDocumentMetadata();
      toast.success(`Synchronized ${res.syncedCount || 0} attachment records from mailbox`);
      fetchDocuments(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sync attachment metadata');
    } finally {
      setSyncing(false);
    }
  };

  // Submit Review Decision with confirmation
  const handleConfirmDecision = async () => {
    if (!selectedDoc || !targetStatus) return;
    setSubmittingDecision(true);
    try {
      await updateDocumentReview(selectedDoc.id, {
        status: targetStatus,
        category: targetCategory,
        reviewNotes: reviewNote,
        candidateId: selectedCandidateId || null
      });

      toast.success(`Document status updated to ${STATUS_CONFIG[targetStatus]?.label || targetStatus}`);
      setConfirmModalOpen(false);
      await loadDetail(selectedDoc.id);
      fetchDocuments(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update review status');
    } finally {
      setSubmittingDecision(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Enterprise Security & Privacy Notice */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-neutral-100">
          <div className="flex items-center gap-2 text-neutral-900 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-neutral-900" />
            <span>Secure Document Verification Workflow</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-white">
              Stage B3.1 Active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncMetadata}
              disabled={syncing || loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-xs font-semibold text-neutral-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>Sync Mailbox Metadata</span>
            </button>
          </div>
        </div>

        <div className="mt-2 text-xs text-neutral-600 space-y-1.5 leading-relaxed">
          <p>
            <strong>Manual HR Review Policy:</strong> Records in this queue reflect incoming email attachment metadata. Statuses reflect manual HR review decisions only and do not constitute independent cryptographic or forensic provenance verification.
          </p>
          <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50/80 px-2.5 py-1 rounded-md border border-amber-200 text-[11px]">
            <Lock className="w-3.5 h-3.5 shrink-0 text-amber-700" />
            <span>
              <strong>File Security Guarantee:</strong> Raw attachment binaries are not stored on local disks or public CDNs. No sensitive document contents (Aadhaar, PAN, certificates, photographs) can be exposed or downloaded through public URLs.
            </span>
          </div>
        </div>
      </div>

      {/* Control Strip & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            placeholder="Search filename, candidate, or email..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg text-xs bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:bg-white transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="MORE_INFO_REQUIRED">More Info Required</option>
          </select>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
          >
            <option value="ALL">All Categories</option>
            <option value="PHOTOGRAPH">ID Photo / Photograph</option>
            <option value="OFFER_JOINING_DOCUMENT">Offer / Joining Document</option>
            <option value="EDUCATION_CERTIFICATE">Education Certificate</option>
            <option value="IDENTITY_DOCUMENT">Government ID</option>
            <option value="RESUME">Resume / CV</option>
            <option value="OTHER">Supporting Document</option>
          </select>

          {/* Linkage Filter */}
          <select
            value={candidateFilter}
            onChange={(e) => setCandidateFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
          >
            <option value="ALL">All Documents</option>
            <option value="UNLINKED">Unlinked Only</option>
          </select>
        </div>
      </div>

      {/* Main Content Layout: Table & Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Table Column */}
        <div className={`${selectedDocId ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all`}>
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-3">Document File & Category</th>
                    <th className="px-4 py-3">Candidate / Sender</th>
                    <th className="px-4 py-3">Format & Size</th>
                    <th className="px-4 py-3">Review Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-neutral-400">
                        <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
                        <p className="text-xs font-semibold text-neutral-600">Loading document queue...</p>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-rose-600">
                        <AlertTriangle className="w-5 h-5 mx-auto text-rose-500 mb-1" />
                        <p className="text-xs font-bold">{error}</p>
                        <button
                          type="button"
                          onClick={() => fetchDocuments(1)}
                          className="mt-2 text-xs font-semibold text-neutral-700 underline cursor-pointer"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : documents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-neutral-400">
                        <FileCheck2 className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                        <p className="text-xs font-bold text-neutral-700">No documents match the current filters</p>
                        <p className="text-[11px] text-neutral-500 mt-1">
                          Click "Sync Mailbox Metadata" above to index attachments from received emails.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => {
                      const isSelected = selectedDocId === doc.id;
                      const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.NEEDS_REVIEW;
                      const catLabel = CATEGORY_LABELS[doc.document_type] || doc.document_type || 'Document';

                      return (
                        <tr
                          key={doc.id}
                          onClick={() => setSelectedDocId(doc.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-neutral-100/90' : 'hover:bg-neutral-50/80'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 font-bold text-neutral-900">
                              <FileText className="w-4 h-4 text-neutral-500 shrink-0" />
                              <span className="truncate max-w-[200px]">{doc.filename}</span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                                {catLabel}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {doc.candidate ? (
                              <div>
                                <div className="font-bold text-neutral-900 flex items-center gap-1">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{doc.candidate.full_name}</span>
                                </div>
                                <div className="text-[10px] text-neutral-500 font-mono truncate max-w-[160px]">
                                  {doc.candidate.email}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-neutral-700 truncate max-w-[160px]">
                                  {doc.email?.from_name || 'Unlinked Sender'}
                                </div>
                                <div className="text-[10px] text-neutral-400 font-mono truncate max-w-[160px]">
                                  {doc.email?.from_address}
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                            <span className="font-mono text-[11px]">
                              {doc.content_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                            </span>{' '}
                            · {formatFileSize(doc.size_bytes)}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusCfg.badge}`}>
                              {statusCfg.label}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDocId(doc.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Review</span>
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
                Showing {documents.length} of {pagination.totalCount} documents
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchDocuments(pagination.page - 1)}
                  className="px-2 py-1 rounded border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-xs"
                >
                  Previous
                </button>
                <span className="text-[11px] font-bold px-2">
                  {pagination.page} / {Math.max(1, pagination.totalPages)}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => fetchDocuments(pagination.page + 1)}
                  className="px-2 py-1 rounded border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Detail & Review Drawer (5 Cols when open) */}
        {selectedDocId && (
          <div className="lg:col-span-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
            {detailLoading ? (
              <div className="py-16 text-center text-neutral-400">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                <p className="text-xs font-semibold">Loading document details...</p>
              </div>
            ) : selectedDoc ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-neutral-900 truncate">
                      {selectedDoc.filename}
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                      {selectedDoc.content_type} · {formatFileSize(selectedDoc.size_bytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDocId(null)}
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* File Privacy Box */}
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/70 text-amber-900 text-xs">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <Lock className="w-3.5 h-3.5 text-amber-800" />
                    <span>Binary Not Stored Locally</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    This document record exists as email attachment metadata. Raw binary files are not downloaded or exposed through public links, preserving candidate data privacy.
                  </p>
                </div>

                {/* Email Context */}
                {selectedDoc.email && (
                  <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Incoming Email Context
                      </span>
                      {onSelectEmail && (
                        <button
                          type="button"
                          onClick={() => onSelectEmail(selectedDoc.email.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-800 hover:underline cursor-pointer"
                        >
                          <span>Open in Mailbox</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div>
                      <span className="text-neutral-500">From:</span>{' '}
                      <span className="font-semibold text-neutral-800">
                        {selectedDoc.email.from_name} ({selectedDoc.email.from_address})
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Subject:</span>{' '}
                      <span className="text-neutral-800">{selectedDoc.email.subject || '(No Subject)'}</span>
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Received: {formatDate(selectedDoc.email.sent_at)} (UID {selectedDoc.email.uid})
                    </div>
                  </div>
                )}

                {/* Candidate Linkage */}
                <div className="space-y-1.5 text-xs">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Linked Candidate Profile
                  </label>
                  <select
                    value={selectedCandidateId}
                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
                  >
                    <option value="">-- Unlinked / No Candidate Associated --</option>
                    {candidateOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category & Status Selection Form */}
                <div className="space-y-3 pt-2 border-t border-neutral-100 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                      Document Category
                    </label>
                    <select
                      value={targetCategory}
                      onChange={(e) => setTargetCategory(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-800 focus:outline-none focus:border-neutral-900"
                    >
                      <option value="PHOTOGRAPH">ID Photo / Photograph</option>
                      <option value="OFFER_JOINING_DOCUMENT">Offer / Joining Document</option>
                      <option value="EDUCATION_CERTIFICATE">Education Certificate</option>
                      <option value="IDENTITY_DOCUMENT">Government ID</option>
                      <option value="RESUME">Resume / CV</option>
                      <option value="OTHER">Supporting Document</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                      Review Status Decision
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { key: 'NEEDS_REVIEW', label: 'Needs Review', border: 'border-amber-300' },
                        { key: 'UNDER_REVIEW', label: 'Under Review', border: 'border-blue-300' },
                        { key: 'ACCEPTED', label: 'Accept (HR Decision)', border: 'border-emerald-300' },
                        { key: 'MORE_INFO_REQUIRED', label: 'More Info Required', border: 'border-purple-300' },
                        { key: 'REJECTED', label: 'Reject Document', border: 'border-rose-300' }
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setTargetStatus(item.key)}
                          className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold border transition cursor-pointer ${
                            targetStatus === item.key
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : `bg-neutral-50 hover:bg-neutral-100 text-neutral-700 ${item.border}`
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                      HR Review Notes
                    </label>
                    <textarea
                      rows={2}
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="e.g. Scanned copy verified against applicant profile; clear identity confirmation."
                      className="w-full p-2 rounded-lg border border-neutral-200 text-xs focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmModalOpen(true)}
                    className="w-full py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Review Decision</span>
                  </button>
                </div>

                {/* Audit History Trail */}
                {selectedDoc.auditLogs && selectedDoc.auditLogs.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-neutral-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                      <History className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Review Audit History</span>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {selectedDoc.auditLogs.map((log) => (
                        <div key={log.id} className="p-2 rounded bg-neutral-50 border border-neutral-100 text-[10px]">
                          <div className="flex items-center justify-between font-bold text-neutral-800">
                            <span>{log.action}</span>
                            <span className="text-neutral-400 font-normal">{formatDate(log.created_at)}</span>
                          </div>
                          <div className="text-neutral-500 mt-0.5">By: {log.performed_by}</div>
                          {log.reason && <div className="text-neutral-700 italic mt-0.5">"{log.reason}"</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-sm w-full p-5 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h4 className="font-bold text-sm text-neutral-900">Confirm Document Decision</h4>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Are you sure you want to record the review status as{' '}
              <strong>{STATUS_CONFIG[targetStatus]?.label || targetStatus}</strong> for{' '}
              <span className="font-mono">{selectedDoc.filename}</span>?
            </p>

            <div className="text-[11px] bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 text-neutral-600 space-y-1">
              <div>
                <strong>Status:</strong> {STATUS_CONFIG[targetStatus]?.label || targetStatus}
              </div>
              <div>
                <strong>Category:</strong> {CATEGORY_LABELS[targetCategory] || targetCategory}
              </div>
              <div>
                <strong>Notes:</strong> {reviewNote || '(None)'}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={submittingDecision}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDecision}
                disabled={submittingDecision}
                className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {submittingDecision ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Confirm & Save</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
