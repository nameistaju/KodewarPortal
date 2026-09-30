import { useEffect, useState } from 'react';
import { Search, X, Loader2, MessageSquare, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { unwrapItems, getErrorMessage } from '../../api/helpers';
import Avatar from '../Avatar';
import { useAuth } from '../../context/AuthContext';

const NewChatModal = ({ isOpen, onClose, onSelectRecipient }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!isOpen) return;

    const fetchTeammates = async () => {
      setLoading(true);
      try {
        const res = await api.get('/employees?status=ACTIVE&limit=100');
        const items = unwrapItems(res);
        // Exclude current logged in employee
        const filtered = (items || []).filter(
          (emp) => String(emp._id || emp.id) !== String(currentUser?._id || currentUser?.id)
        );
        setEmployees(filtered);
      } catch (err) {
        toast.error(getErrorMessage(err) || 'Failed to load team members');
      } finally {
        setLoading(false);
      }
    };

    fetchTeammates();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const filteredEmployees = employees.filter((emp) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      emp.name?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.department?.toLowerCase().includes(term)
    );
  });

  const handleSelect = async (recipientId) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white border border-neutral-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-black" />
            <h3 className="font-extrabold text-base text-black">New Chat</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or department..."
              className="w-full pl-9 pr-4 py-2 bg-white text-black text-xs font-semibold rounded-xl border border-neutral-200 focus:outline-none focus:border-black"
            />
          </div>
        </div>

        {/* Employee List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-neutral-100">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-neutral-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs font-semibold">Loading team members...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-10 text-neutral-400 space-y-1">
              <User className="w-8 h-8 mx-auto stroke-1" />
              <p className="text-xs font-bold">No teammates found</p>
            </div>
          ) : (
            filteredEmployees.map((emp) => (
              <button
                key={emp._id || emp.id}
                onClick={() => handleSelect(emp._id || emp.id)}
                disabled={submittingId === (emp._id || emp.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 rounded-2xl transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar user={emp} size="h-10 w-10" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-black truncate group-hover:text-neutral-900">
                      {emp.name}
                    </p>
                    <p className="text-xs text-neutral-500 font-medium truncate">
                      {emp.role || 'Employee'} · {emp.department || 'General'}
                    </p>
                  </div>
                </div>

                {submittingId === (emp._id || emp.id) ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black shrink-0" />
                ) : (
                  <span className="text-xs font-extrabold text-black bg-neutral-100 group-hover:bg-black group-hover:text-white px-3 py-1.5 rounded-xl transition-all shrink-0">
                    Chat
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;
