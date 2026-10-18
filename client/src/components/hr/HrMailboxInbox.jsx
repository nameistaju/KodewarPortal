import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Mail,
  Search,
  Paperclip,
  Clock,
  User,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Inbox,
  Filter,
  Calendar,
  Layers,
  Copy,
  ExternalLink,
  Info,
  Tag,
  UserPlus,
  BookmarkCheck,
  X,
  UserCheck,
  Plus,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getMailboxEmails, getMailboxEmailById, updateMailboxEmailCategory } from '../../api/hrMailboxApi';
import {
  getCandidates,
  linkEmailToCandidate,
  createCandidateFromEmail
} from '../../api/hrCandidateApi';
import { getJobs } from '../../api/hrJobApi';
import { createApplicationFromEmail, createApplication } from '../../api/hrApplicationApi';
import { formatDate } from '../../api/helpers';
import {
  classifyEmailCategory,
  CATEGORY_STYLES,
  HR_EMAIL_CATEGORIES,
  formatFileSize,
  matchesDateFilter
} from './hrHelpers';


export default function HrMailboxInbox({ initialSelectedEmailId = null }) {
  const [emails, setEmails] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalCount: 0, totalPages: 1 });
  const [selectedEmailId, setSelectedEmailId] = useState(initialSelectedEmailId);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('text'); // 'text' | 'html'

  // Link to Candidate State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTab, setLinkTab] = useState('new'); // 'new' | 'existing'
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidateOptions, setCandidateOptions] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [linkForm, setLinkForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    targetRole: '',
    jobId: '',
    source: 'EMAIL',
    notes: '',
    allowDuplicate: false
  });
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Category Override Handler
  const handleCategoryChange = async (newCategory) => {
    if (!selectedEmail) return;
    try {
      const updated = await updateMailboxEmailCategory(selectedEmail.id, newCategory);
      setSelectedEmail((prev) => ({
        ...prev,
        ...updated,
        category: newCategory,
        manual_category_override: newCategory,
        classification_reason: 'Manual override by HR'
      }));
      setEmails((prev) =>
        prev.map((e) =>
          e.id === selectedEmail.id
            ? {
                ...e,
                ...updated,
                category: newCategory,
                manual_category_override: newCategory,
                classification_reason: 'Manual override by HR'
              }
            : e
        )
      );
      toast.success(`Category updated to "${newCategory}"`);
    } catch (err) {
      if (err.response?.data?.code === 'SCHEMA_MIGRATION_PENDING' || err.response?.status === 503) {
        toast.error('Database migration required: Run 000_stage_b2_consolidated_migration.sql in Supabase to save manual overrides.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to update email category');
      }
    }
  };

  // Fetch emails from API
  const fetchEmails = useCallback(
    async (page = 1, searchQuery = search, status = statusFilter, category = selectedCategory) => {
      setLoadingList(true);
      setError(null);
      try {
        const params = {
          page,
          limit: 15,
          folder: 'INBOX'
        };
        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }
        if (status !== 'ALL') {
          params.processingStatus = status;
        }
        if (category !== 'ALL') {
          params.category = category;
        }

        const data = await getMailboxEmails(params);
        const fetchedEmails = data.emails || [];
        setEmails(fetchedEmails);
        setPagination(data.pagination || { page: 1, limit: 15, totalCount: 0, totalPages: 1 });

        // Ensure a selected email is retained or defaulted
        if (fetchedEmails.length > 0) {
          if (!selectedEmailId || !fetchedEmails.some((e) => e.id === selectedEmailId)) {
            setSelectedEmailId(fetchedEmails[0].id);
          }
        } else {
          setSelectedEmailId(null);
          setSelectedEmail(null);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load emails from mailbox API.');
      } finally {
        setLoadingList(false);
      }
    },
    [search, statusFilter, selectedCategory, selectedEmailId]
  );

  // Trigger load on query / status / category changes
  useEffect(() => {
    fetchEmails(1, search, statusFilter, selectedCategory);
  }, [fetchEmails, search, statusFilter, selectedCategory]);

  // Fetch full detail when selectedEmailId changes
  useEffect(() => {
    if (!selectedEmailId) {
      setSelectedEmail(null);
      return;
    }

    let isMounted = true;
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const detail = await getMailboxEmailById(selectedEmailId);
        if (isMounted) {
          setSelectedEmail(detail);
        }
      } catch {
        if (isMounted) {
          setSelectedEmail(null);
        }
      } finally {
        if (isMounted) {
          setLoadingDetail(false);
        }
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedEmailId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleOpenLinkModal = () => {
    if (!selectedEmail) return;
    setDuplicateWarning(null);
    setLinkTab('new');
    let firstName = '';
    let lastName = '';
    const rawName = selectedEmail.from_name || selectedEmail.from_address.split('@')[0];
    const parts = rawName.trim().split(/\s+/);
    firstName = parts[0] || 'Unknown';
    lastName = parts.slice(1).join(' ') || '';

    const cleanRole = selectedEmail.subject
      ? selectedEmail.subject.replace(/^(re:|fwd:|application for|applying for|reg:)\s*/i, '').trim()
      : 'General Application';

    setLinkForm({
      firstName,
      lastName,
      email: selectedEmail.from_address || '',
      phone: '',
      targetRole: cleanRole,
      jobId: '',
      source: 'EMAIL',
      notes: `Ingested from IMAP email UID ${selectedEmail.uid}`,
      allowDuplicate: false
    });
    getJobs({ limit: 100 })
      .then((data) => setAvailableJobs(data.jobs || []))
      .catch(() => setAvailableJobs([]));
    setShowLinkModal(true);
  };

  const searchExistingCandidates = async (q) => {
    setLoadingCandidates(true);
    try {
      const data = await getCandidates({ search: q, limit: 10 });
      setCandidateOptions(data.candidates || []);
    } catch {
      setCandidateOptions([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleCreateAndLinkCandidate = async (e) => {
    e.preventDefault();
    if (!selectedEmail) return;
    setLinkingLoading(true);
    setDuplicateWarning(null);
    try {
      await createApplicationFromEmail({
        emailId: selectedEmail.id,
        candidateData: {
          firstName: linkForm.firstName,
          lastName: linkForm.lastName,
          email: linkForm.email,
          phone: linkForm.phone,
          targetRole: linkForm.targetRole,
          notes: linkForm.notes
        },
        jobId: linkForm.jobId || null,
        source: linkForm.source,
        notes: linkForm.notes,
        allowDuplicate: linkForm.allowDuplicate
      });
      toast.success('Candidate profile and application created');
      setShowLinkModal(false);
    } catch (err) {
      if (err.response?.status === 409) {
        setDuplicateWarning(err.response.data?.message || 'Candidate or application already exists.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to create and link application');
      }
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleLinkToExisting = async (candidateId) => {
    if (!selectedEmail) return;
    setLinkingLoading(true);
    try {
      await createApplication({
        candidateId,
        jobId: linkForm.jobId || null,
        source: linkForm.source,
        emailId: selectedEmail.id,
        notes: linkForm.notes || `Linked from email UID ${selectedEmail.uid}`,
        allowDuplicate: linkForm.allowDuplicate
      });
      toast.success('Email linked to candidate & application recorded');
      setShowLinkModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to link email to candidate');
    } finally {
      setLinkingLoading(false);
    }
  };

  // Safe isolated srcDoc for HTML preview
  const sandboxedSrcDoc = useMemo(() => {
    if (!selectedEmail?.body_html) return '';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https: http:; font-src data: https:;">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #111111;
      margin: 16px;
      padding: 0;
      word-break: break-word;
    }
    a { color: #000; text-decoration: underline; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${selectedEmail.body_html}
</body>
</html>`;
  }, [selectedEmail?.body_html]);

  // Client-side category & date filtering for high responsiveness
  const filteredEmails = useMemo(() => {
    return emails.filter((email) => {
      const category = classifyEmailCategory(email);
      if (selectedCategory !== 'ALL' && category !== selectedCategory) {
        return false;
      }
      if (!matchesDateFilter(email.sent_at, selectedDateFilter)) {
        return false;
      }
      return true;
    });
  }, [emails, selectedCategory, selectedDateFilter]);

  const categories = ['ALL', ...HR_EMAIL_CATEGORIES];


  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search candidate name, email, subject, or keywords..."
              className="w-full pl-9 pr-20 py-2 rounded-lg text-xs bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:bg-white transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 hover:text-neutral-700 font-bold px-1"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md text-[10px] font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Quick Date and Status Selectors */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg border border-neutral-200 text-xs shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-1.5">
                Status:
              </span>
              {['ALL', 'PENDING', 'PROCESSED', 'FAILED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg border border-neutral-200 text-xs shrink-0">
              <Calendar className="w-3 h-3 text-neutral-500 ml-1" />
              {['ALL', '24H', '7D', '30D'].map((df) => (
                <button
                  key={df}
                  type="button"
                  onClick={() => setSelectedDateFilter(df)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    selectedDateFilter === df
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {df === 'ALL' ? 'All Dates' : df}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchEmails(pagination.page, search, statusFilter)}
              className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition-colors cursor-pointer shrink-0"
              title="Refresh Mailbox Feed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Category Filter Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-neutral-100 pb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-neutral-400" />
            Category:
          </span>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer shrink-0 border ${
                  isSelected
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                    : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchEmails(pagination.page, search, statusFilter)}
            className="px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Split Pane: Email List (Left) and Detail View (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[620px]">
        {/* Left Pane: Email List (5 Cols) */}
        <div className="lg:col-span-5 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100 px-1">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-neutral-900" />
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
                  Inbox Feed ({pagination.totalCount})
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-neutral-500">
                Page {pagination.page} of {Math.max(1, pagination.totalPages)}
              </span>
            </div>

            {loadingList ? (
              <div className="space-y-2 pt-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 animate-pulse space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-32 bg-neutral-200 rounded" />
                      <div className="h-2.5 w-16 bg-neutral-200 rounded" />
                    </div>
                    <div className="h-3 w-48 bg-neutral-300 rounded" />
                    <div className="h-2.5 w-full bg-neutral-200 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="py-20 text-center text-neutral-400 space-y-2">
                <Mail className="w-8 h-8 mx-auto text-neutral-300" />
                <p className="text-xs font-bold text-neutral-700">No matching emails</p>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
                  {search || selectedCategory !== 'ALL' || selectedDateFilter !== 'ALL'
                    ? 'Try adjusting your search criteria or category filter.'
                    : 'Mailbox INBOX is currently empty.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 pt-0.5 max-h-[560px] overflow-y-auto pr-1">
                {filteredEmails.map((email) => {
                  const isSelected = email.id === selectedEmailId;
                  const category = classifyEmailCategory(email);
                  const catStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.Other;
                  const isUnread = !email.is_read;

                  return (
                    <button
                      key={email.id}
                      type="button"
                      onClick={() => setSelectedEmailId(email.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs ring-1 ring-neutral-900'
                          : 'border-neutral-200 bg-neutral-50/30 hover:bg-neutral-100 hover:border-neutral-300 text-neutral-900'
                      }`}
                    >
                      {/* Top Row: Sender & Date */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {/* Unread indicator dot */}
                          {isUnread && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isSelected ? 'bg-white' : 'bg-neutral-900'
                              }`}
                              title="Unread / New Inbound Message"
                            />
                          )}
                          <span
                            className={`text-xs truncate ${
                              isSelected
                                ? 'font-bold text-white'
                                : isUnread
                                ? 'font-bold text-neutral-900'
                                : 'font-medium text-neutral-700'
                            }`}
                          >
                            {email.from_name || email.from_address}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] shrink-0 font-medium ${
                            isSelected ? 'text-neutral-400' : 'text-neutral-400'
                          }`}
                        >
                          {formatDate(email.sent_at)}
                        </span>
                      </div>

                      {/* Subject */}
                      <div className="mt-1">
                        <h4
                          className={`text-xs truncate leading-snug ${
                            isSelected
                              ? 'font-bold text-neutral-100'
                              : isUnread
                              ? 'font-bold text-neutral-900'
                              : 'font-medium text-neutral-800'
                          }`}
                        >
                          {email.subject || '(No Subject)'}
                        </h4>
                        <p
                          className={`text-[11px] line-clamp-2 mt-0.5 leading-relaxed ${
                            isSelected ? 'text-neutral-400' : 'text-neutral-500'
                          }`}
                        >
                          {email.snippet || '(No text preview available)'}
                        </p>
                      </div>

                      {/* Bottom Tags: Category, Attachments, Status */}
                      <div className="mt-2.5 flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Category Badge */}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              isSelected
                                ? 'bg-neutral-800 text-neutral-200 border-neutral-700'
                                : catStyle.badgeClass
                            }`}
                          >
                            {category}
                          </span>

                          {/* Attachment indicator */}
                          {email.has_attachments && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                isSelected
                                  ? 'bg-neutral-800 text-neutral-300'
                                  : 'bg-neutral-200 text-neutral-700'
                              }`}
                              title="Has verified attachments"
                            >
                              <Paperclip className="w-2.5 h-2.5" />
                              {email.attachments?.length || 1}
                            </span>
                          )}

                          {/* Processing Status */}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              email.processing_status === 'PROCESSED'
                                ? isSelected
                                  ? 'bg-emerald-950 text-emerald-300'
                                  : 'bg-emerald-100 text-emerald-800'
                                : email.processing_status === 'FAILED'
                                ? isSelected
                                  ? 'bg-red-950 text-red-300'
                                  : 'bg-red-100 text-red-800'
                                : isSelected
                                ? 'bg-neutral-800 text-neutral-400'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {email.processing_status}
                          </span>
                        </div>

                        <span
                          className={`text-[9px] font-mono shrink-0 ${
                            isSelected ? 'text-neutral-400' : 'text-neutral-400'
                          }`}
                        >
                          UID {email.uid}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
            <span className="text-[11px] font-medium text-neutral-400">
              Showing {filteredEmails.length} of {pagination.totalCount} records
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1 || loadingList}
                onClick={() => fetchEmails(pagination.page - 1)}
                className="p-1 rounded-md border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-bold px-1.5">
                {pagination.page} / {Math.max(1, pagination.totalPages)}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loadingList}
                onClick={() => fetchEmails(pagination.page + 1)}
                className="p-1 rounded-md border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane: Selected Email Detail & Body Viewer (7 Cols) */}
        <div className="lg:col-span-7 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          {!selectedEmailId ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mb-3">
                <Mail className="w-6 h-6 text-neutral-400" />
              </div>
              <h4 className="text-sm font-bold text-neutral-800">Select an email to view</h4>
              <p className="text-xs text-neutral-500 max-w-xs mt-1">
                Choose any incoming candidate application or communication from the list on the left.
              </p>
            </div>
          ) : loadingDetail ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 w-3/4 bg-neutral-200 rounded" />
              <div className="space-y-2 border-b border-neutral-100 pb-4">
                <div className="h-3.5 w-1/2 bg-neutral-100 rounded" />
                <div className="h-3 w-1/3 bg-neutral-100 rounded" />
              </div>
              <div className="h-64 w-full bg-neutral-50 rounded-lg" />
            </div>
          ) : selectedEmail ? (
            <div className="space-y-4">
              {/* Message Header */}
              <div className="space-y-3 pb-3.5 border-b border-neutral-200">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-neutral-900 leading-tight">
                      {selectedEmail.subject || '(No Subject)'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-white">
                        {selectedEmail.category || classifyEmailCategory(selectedEmail)}
                      </span>
                      {selectedEmail.manual_category_override && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                          HR Override
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                        <ShieldCheck className="w-3 h-3 text-neutral-500" />
                        Verified Read-Only IMAP
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">
                        UID {selectedEmail.uid} · Epoch {selectedEmail.uidvalidity}
                      </span>
                    </div>

                    {/* Classification Reason & Manual Override Selector */}
                    <div className="mt-2.5 p-2 rounded-lg bg-neutral-50 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="text-[11px] text-neutral-600 flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span>
                          <strong>Reason:</strong>{' '}
                          {selectedEmail.classification_reason || 'Automated pattern matching'}
                        </span>
                        {selectedEmail.classification_confidence && (
                          <span className="text-neutral-400 font-mono text-[10px]">
                            ({Math.round(selectedEmail.classification_confidence * 100)}% conf)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          HR Category:
                        </label>
                        <select
                          value={selectedEmail.category || classifyEmailCategory(selectedEmail)}
                          onChange={(e) => handleCategoryChange(e.target.value)}
                          className="text-xs py-0.5 px-2 bg-white border border-neutral-300 rounded font-semibold text-neutral-800 focus:outline-none focus:border-neutral-900 cursor-pointer"
                        >
                          {HR_EMAIL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>


                  <button
                    type="button"
                    onClick={() => handleCopy(selectedEmail.id, 'Email UUID')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 transition-colors cursor-pointer shrink-0"
                    title="Copy internal database ID"
                  >
                    <Copy className="w-3 h-3" />
                    Copy ID
                  </button>
                </div>

                {/* Sender & Recipient Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-neutral-700">
                      <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="font-bold text-neutral-900 truncate">
                        {selectedEmail.from_name || selectedEmail.from_address}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono truncate pl-5.5">
                      {selectedEmail.from_address}
                    </div>
                  </div>

                  <div className="space-y-1 sm:text-right">
                    <div className="flex items-center gap-1.5 text-neutral-500 sm:justify-end">
                      <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>{formatDate(selectedEmail.sent_at)}</span>
                      <span className="text-neutral-400">
                        ({new Date(selectedEmail.sent_at).toLocaleTimeString()})
                      </span>
                    </div>
                    {selectedEmail.to_addresses && selectedEmail.to_addresses.length > 0 && (
                      <div className="text-[11px] text-neutral-500 truncate sm:justify-end">
                        <span className="font-semibold text-neutral-400 mr-1">To:</span>
                        {selectedEmail.to_addresses.map((t) => t.address).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Bar (Honest State with Staged Badges) */}
              <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/70 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Link to Candidate Action */}
                  <button
                    type="button"
                    onClick={handleOpenLinkModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Link to Candidate</span>
                  </button>

                  {/* Categorize Action */}
                  <div className="relative group">
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-neutral-200 text-neutral-500 cursor-not-allowed opacity-80"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Categorize: {classifyEmailCategory(selectedEmail)}</span>
                      <span className="text-[9px] uppercase font-bold px-1 rounded bg-neutral-300 text-neutral-700">
                        Auto
                      </span>
                    </button>
                    <div className="hidden group-hover:block absolute bottom-full mb-1.5 left-0 z-20 w-64 p-2 bg-neutral-900 text-white text-[10px] rounded shadow-lg leading-relaxed">
                      Classified via heuristic content detection. Manual category overrides will be saved once category column is migrated.
                    </div>
                  </div>
                </div>

                {/* Mark for HR Review Status */}
                <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <BookmarkCheck className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="font-semibold text-[11px]">Processing Status:</span>
                  <span className="font-bold text-neutral-900 uppercase text-[10px] px-1.5 py-0.5 rounded bg-neutral-200">
                    {selectedEmail.processing_status}
                  </span>
                </div>
              </div>

              {/* Attachment Metadata Panel */}
              {selectedEmail.has_attachments && (
                <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900">
                      <Paperclip className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Attachments ({selectedEmail.attachments?.length || 0})</span>
                    </div>
                    <span className="text-[10px] text-neutral-500 font-medium">
                      Metadata summary only · Binary payloads excluded
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    {(selectedEmail.attachments || []).map((att, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-md border border-neutral-200 bg-white flex items-center gap-2 text-xs"
                      >
                        <FileText className="w-4 h-4 text-neutral-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-neutral-900 truncate text-[11px]">
                            {att.filename || 'attachment'}
                          </p>
                          <p className="text-[10px] text-neutral-400 truncate">
                            {att.contentType} · {formatFileSize(att.size)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-neutral-400 italic">
                    Note: Attachment contents reside securely on Titan IMAP. Document vault storage will be enabled in Stage B.
                  </p>
                </div>
              )}

              {/* Message Body Section with Mode Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Message Body
                  </span>

                  <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-md border border-neutral-200">
                    <button
                      type="button"
                      onClick={() => setViewMode('text')}
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        viewMode === 'text'
                          ? 'bg-white text-neutral-900 shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      Plain Text
                    </button>
                    {selectedEmail.body_html && (
                      <button
                        type="button"
                        onClick={() => setViewMode('html')}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          viewMode === 'html'
                            ? 'bg-white text-neutral-900 shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-900'
                        }`}
                      >
                        Isolated HTML
                      </button>
                    )}
                  </div>
                </div>

                {viewMode === 'text' ? (
                  <div className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50/20 max-h-[380px] overflow-y-auto">
                    <pre className="font-sans whitespace-pre-wrap text-xs text-neutral-800 leading-relaxed break-words">
                      {selectedEmail.body_text || selectedEmail.snippet || '(Empty message body)'}
                    </pre>
                  </div>
                ) : (
                  <div className="rounded-lg border border-neutral-200 overflow-hidden bg-white">
                    <iframe
                      title="Email Preview"
                      sandbox=""
                      srcDoc={sandboxedSrcDoc}
                      className="w-full h-[380px] border-none"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Footer Metadata */}
          {selectedEmail && (
            <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
              <span className="truncate max-w-[280px]">
                RFC 822: {selectedEmail.message_id || 'None'}
              </span>
              <span>Epoch: {selectedEmail.uidvalidity} · UID: {selectedEmail.uid}</span>
            </div>
          )}
        </div>
      </div>

      {/* Link to Candidate Modal */}
      {showLinkModal && selectedEmail && (
        <div className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-neutral-800" />
                  <span>Link Email to Candidate</span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  UID {selectedEmail.uid} · "{selectedEmail.subject || '(No Subject)'}"
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="p-1 rounded text-neutral-400 hover:text-neutral-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex rounded-lg bg-neutral-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLinkTab('new')}
                className={`flex-1 py-1.5 rounded-md transition-colors cursor-pointer ${
                  linkTab === 'new' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                New Profile from Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkTab('existing');
                  if (candidateOptions.length === 0) searchExistingCandidates('');
                }}
                className={`flex-1 py-1.5 rounded-md transition-colors cursor-pointer ${
                  linkTab === 'existing' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Link to Existing Profile
              </button>
            </div>

            {linkTab === 'new' ? (
              <form onSubmit={handleCreateAndLinkCandidate} className="space-y-3">
                {duplicateWarning && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1.5">
                    <p className="font-semibold">{duplicateWarning}</p>
                    <label className="flex items-center gap-2 font-bold cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={linkForm.allowDuplicate}
                        onChange={(e) => setLinkForm({ ...linkForm, allowDuplicate: e.target.checked })}
                        className="rounded border-neutral-300"
                      />
                      <span>Override duplicate check and proceed</span>
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={linkForm.firstName}
                      onChange={(e) => setLinkForm({ ...linkForm, firstName: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={linkForm.lastName}
                      onChange={(e) => setLinkForm({ ...linkForm, lastName: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={linkForm.email}
                    onChange={(e) => setLinkForm({ ...linkForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={linkForm.phone}
                      onChange={(e) => setLinkForm({ ...linkForm, phone: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Target Role</label>
                    <input
                      type="text"
                      value={linkForm.targetRole}
                      onChange={(e) => setLinkForm({ ...linkForm, targetRole: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Target Job Requisition</label>
                    <select
                      value={linkForm.jobId}
                      onChange={(e) => setLinkForm({ ...linkForm, jobId: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                    >
                      <option value="">Leave Unassigned (Awaiting Review)</option>
                      {availableJobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title} ({j.job_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Application Source</label>
                    <select
                      value={linkForm.source}
                      onChange={(e) => setLinkForm({ ...linkForm, source: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                    >
                      <option value="EMAIL">Inbound Email</option>
                      <option value="INSTAGRAM">Instagram Ad / Post</option>
                      <option value="REFERRAL">Employee Referral</option>
                      <option value="WEBSITE">Careers Website</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={linkingLoading}
                    className="px-4 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {linkingLoading ? 'Creating & Linking...' : 'Create & Link'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Target Job</label>
                    <select
                      value={linkForm.jobId}
                      onChange={(e) => setLinkForm({ ...linkForm, jobId: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                    >
                      <option value="">Leave Unassigned (Review Queue)</option>
                      {availableJobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title} ({j.job_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Source</label>
                    <select
                      value={linkForm.source}
                      onChange={(e) => setLinkForm({ ...linkForm, source: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                    >
                      <option value="EMAIL">Inbound Email</option>
                      <option value="INSTAGRAM">Instagram Ad / Post</option>
                      <option value="REFERRAL">Referral</option>
                      <option value="WEBSITE">Website</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={candidateQuery}
                    onChange={(e) => {
                      setCandidateQuery(e.target.value);
                      searchExistingCandidates(e.target.value);
                    }}
                    placeholder="Search existing candidate..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-neutral-200 text-xs bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 border border-neutral-200 rounded-lg">
                  {loadingCandidates ? (
                    <div className="p-4 text-center text-neutral-400 text-xs">Searching candidates...</div>
                  ) : candidateOptions.length === 0 ? (
                    <div className="p-4 text-center text-neutral-400 text-xs">
                      No matching candidate profiles found.
                    </div>
                  ) : (
                    candidateOptions.map((cand) => (
                      <div key={cand.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-neutral-50">
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-neutral-900 truncate">{cand.full_name}</p>
                          <p className="text-[11px] text-neutral-500 font-mono truncate">{cand.email}</p>
                        </div>
                        <button
                          type="button"
                          disabled={linkingLoading}
                          onClick={() => handleLinkToExisting(cand.id)}
                          className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-bold cursor-pointer shrink-0"
                        >
                          Link Email & Apply
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
