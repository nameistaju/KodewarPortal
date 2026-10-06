import { useEffect, useState } from 'react';
import { X, Loader2, Hash, Lock, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { unwrapItems, getErrorMessage } from '../../api/helpers';
import { createChannel } from '../../api/chatApi';
import { useAuth } from '../../context/AuthContext';

const NewChannelModal = ({ isOpen, onClose, onCreated }) => {
  const { user } = useAuth();
  const isAdminOrHr = user?.role === 'ADMIN' || user?.department?.toUpperCase() === 'HR';

  const [type, setType] = useState('CHANNEL');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setName('');
    setDescription('');
    setIsPrivate(false);
    setSelectedParticipants([]);
    setType(isAdminOrHr ? 'CHANNEL' : 'GROUP');

    const fetchEmps = async () => {
      setLoadingEmps(true);
      try {
        const res = await api.get('/employees?status=ACTIVE&limit=100');
        const items = unwrapItems(res);
        const currentUserId = String(user?._id || user?.id || user?.employeeId || '');
        setEmployees(items.filter((e) => String(e._id || e.id) !== currentUserId));
      } catch (err) {
        console.error('Failed to fetch employees for channel creation', err);
      } finally {
        setLoadingEmps(false);
      }
    };

    fetchEmps();
  }, [isOpen, isAdminOrHr, user]);

  if (!isOpen) return null;

  const toggleParticipant = (empId) => {
    setSelectedParticipants((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createChannel({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        isPrivate: type === 'CHANNEL' ? isPrivate : false,
        participantIds: selectedParticipants
      });
      toast.success(`${type === 'CHANNEL' ? 'Channel' : 'Group'} created successfully`);
      onCreated(res.conversation);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to create channel');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-neutral-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-100 rounded-xl text-black">
              {type === 'CHANNEL' ? (isPrivate ? <Lock className="w-5 h-5" /> : <Hash className="w-5 h-5" />) : <Users className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-black tracking-tight">
                {isAdminOrHr ? 'Create Channel or Group' : 'Create Group Chat'}
              </h3>
              <p className="text-xs text-neutral-500 font-medium">Teams-style collaboration space</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Type Selector (Admins/HR only) */}
          {isAdminOrHr && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('CHANNEL')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    type === 'CHANNEL'
                      ? 'bg-black text-white border-black shadow-xs'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  <span>Channel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('GROUP')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    type === 'GROUP'
                      ? 'bg-black text-white border-black shadow-xs'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Group Chat</span>
                </button>
              </div>
            </div>
          )}

          {/* Name Input */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              {type === 'CHANNEL' ? 'Channel Name' : 'Group Name'}
            </label>
            <div className="relative">
              {type === 'CHANNEL' && (
                <span className="absolute left-3.5 top-2.5 font-bold text-neutral-400 text-sm">
                  {isPrivate ? '🔒' : '#'}
                </span>
              )}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'CHANNEL' ? 'e.g. project-launch' : 'e.g. Frontend Team'}
                className={`w-full py-2.5 pr-4 text-xs font-semibold bg-white text-black border border-neutral-200 rounded-xl focus:outline-none focus:border-black ${
                  type === 'CHANNEL' ? 'pl-8' : 'pl-3.5'
                }`}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              className="w-full p-3 text-xs font-semibold bg-white text-black border border-neutral-200 rounded-xl focus:outline-none focus:border-black h-20 resize-none"
            />
          </div>

          {/* Privacy Toggle (For Channels) */}
          {type === 'CHANNEL' && (
            <div className="flex items-center justify-between p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl">
              <div>
                <p className="text-xs font-bold text-black flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Make Private</span>
                </p>
                <p className="text-[11px] text-neutral-500 font-normal mt-0.5">
                  Only invited members can view and access messages.
                </p>
              </div>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 text-black rounded focus:ring-black cursor-pointer"
              />
            </div>
          )}

          {/* Participant Selection */}
          {(isPrivate || type === 'GROUP') && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
                Add Members
              </label>
              <div className="max-h-40 overflow-y-auto border border-neutral-200 rounded-xl p-2 space-y-1 bg-white">
                {loadingEmps ? (
                  <div className="p-3 text-center text-xs text-neutral-400">Loading members...</div>
                ) : employees.length === 0 ? (
                  <div className="p-3 text-center text-xs text-neutral-400">No members found</div>
                ) : (
                  employees.map((emp) => {
                    const empId = emp._id || emp.id;
                    const isSelected = selectedParticipants.includes(empId);
                    return (
                      <div
                        key={empId}
                        onClick={() => toggleParticipant(empId)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                          isSelected ? 'bg-neutral-100 font-bold text-black' : 'hover:bg-neutral-50 text-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>{emp.name}</span>
                          <span className="text-[10px] text-neutral-400 uppercase">({emp.department})</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 text-black rounded pointer-events-none"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-black rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-black text-white hover:bg-neutral-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Create</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewChannelModal;
