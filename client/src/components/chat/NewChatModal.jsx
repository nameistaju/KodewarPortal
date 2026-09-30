import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2, MessageSquare, Users, SearchX, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { unwrapItems, getErrorMessage } from '../../api/helpers';
import Avatar from '../Avatar';
import { useAuth } from '../../context/AuthContext';

// In-memory session cache for active teammates
let cachedTeammates = null;

const NewChatModal = ({ isOpen, onClose, onSelectRecipient }) => {
  const [employees, setEmployees] = useState(cachedTeammates || []);
  const [loading, setLoading] = useState(!cachedTeammates);
  const [search, setSearch] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const { user: currentUser } = useAuth();
  const inputRef = useRef(null);

  // Exclude current logged in employee & sort (Admins first, then alphabetical)
  const currentUserId = String(currentUser?._id || currentUser?.id || currentUser?.employeeId || '');

  const processAndSortTeammates = (items) => {
    const list = Array.isArray(items) ? items : [];
    const filtered = list.filter((emp) => {
      const empId = String(emp._id || emp.id || '');
      return empId && empId !== currentUserId;
    });

    return filtered.sort((a, b) => {
      const aIsAdmin = a.role === 'ADMIN' ? 1 : 0;
      const bIsAdmin = b.role === 'ADMIN' ? 1 : 0;
      if (aIsAdmin !== bIsAdmin) return bIsAdmin - aIsAdmin;
      return (a.name || '').localeCompare(b.name || '');
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    // Focus input on open
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    const fetchTeammates = async () => {
      if (!cachedTeammates) {
        setLoading(true);
      }

      try {
        const res = await api.get('/employees?status=ACTIVE&limit=100');
        const items = unwrapItems(res);
        const sorted = processAndSortTeammates(items);

        cachedTeammates = sorted;
        setEmployees(sorted);
      } catch (err) {
        if (!cachedTeammates) {
          toast.error(getErrorMessage(err) || 'Failed to load team members');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTeammates();
  }, [isOpen, currentUserId]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Search filtering logic (Name, Email, Department, Designation, Role)
  const searchTerm = search.trim().toLowerCase();
  const filteredEmployees = employees.filter((emp) => {
    if (!searchTerm) return true;

    const nameMatch = emp.name?.toLowerCase().includes(searchTerm);
    const emailMatch = emp.email?.toLowerCase().includes(searchTerm);
    const deptMatch = emp.department?.toLowerCase().includes(searchTerm);
    const desigMatch = emp.designation?.toLowerCase().includes(searchTerm);
    const roleMatch = emp.role?.toLowerCase().includes(searchTerm);

    return Boolean(nameMatch || emailMatch || deptMatch || desigMatch || roleMatch);
  });

  const handleSelect = async (recipientId) => {
    if (submittingId) return;
    setSubmittingId(recipientId);
    try {
      await onSelectRecipient(recipientId);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Could not start conversation');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 max-sm:p-0 bg-black/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-chat-title"
    >
      <div className="bg-white border border-neutral-200 rounded-3xl max-sm:rounded-t-3xl max-sm:rounded-b-none w-full max-w-md max-sm:max-w-full max-sm:fixed max-sm:bottom-0 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-100 rounded-xl text-black">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 id="new-chat-title" className="font-extrabold text-base text-black tracking-tight">
                New Chat
              </h3>
              <p className="text-xs text-neutral-500 font-medium">Start a private conversation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Box */}
        <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees by name, email or department..."
              aria-label="Search employees by name, email or department"
              className="w-full pl-9 pr-9 py-2.5 bg-white text-black text-xs font-semibold rounded-xl border border-neutral-200 focus:outline-none focus:border-black focus:ring-2 focus:ring-black/5 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search text"
                className="absolute right-3 text-neutral-400 hover:text-black p-0.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Employee List Section */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2 min-h-[220px] max-h-[380px]">
          {loading && employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-black" />
              <span className="text-xs font-semibold text-neutral-500">Loading teammates...</span>
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4 space-y-2">
              <Users className="w-10 h-10 text-neutral-300 stroke-1" />
              <h4 className="text-sm font-bold text-black">No teammates available</h4>
              <p className="text-xs text-neutral-500 max-w-xs">
                There are currently no active employees available to chat with.
              </p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4 space-y-2">
              <SearchX className="w-9 h-9 text-neutral-300 stroke-1" />
              <h4 className="text-sm font-bold text-black">No employees found</h4>
              <p className="text-xs text-neutral-500 max-w-xs">
                Try searching by name, email, or department.
              </p>
              <button
                onClick={() => setSearch('')}
                className="mt-2 text-xs font-bold text-black hover:underline cursor-pointer"
              >
                Clear search
              </button>
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const empId = emp._id || emp.id;
              const isSubmitting = submittingId === empId;

              return (
                <button
                  key={empId}
                  onClick={() => handleSelect(empId)}
                  disabled={isSubmitting}
                  className="w-full min-h-[52px] flex items-center justify-between p-3 hover:bg-neutral-50 border border-neutral-100 hover:border-neutral-200 rounded-2xl transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <Avatar user={emp} size="h-10 w-10 sm:h-11 sm:w-11" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-black truncate group-hover:text-neutral-900">
                          {emp.name}
                        </p>
                        {emp.role === 'ADMIN' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-black text-white rounded-md tracking-wider shrink-0">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 font-medium truncate mt-0.5">
                        {emp.designation || 'Staff'} · {emp.department || 'GENERAL'}
                      </p>
                      {emp.email && (
                        <p className="text-[11px] text-neutral-400 font-normal truncate mt-0.5">
                          {emp.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSubmitting ? (
                    <div className="px-3 py-1.5 shrink-0">
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-black bg-neutral-100 group-hover:bg-black group-hover:text-white px-3.5 py-2 rounded-xl transition-all shrink-0">
                      <span>Message</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;

