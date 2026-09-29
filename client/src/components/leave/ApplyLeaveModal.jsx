import { Loader2, Send, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../api/helpers';

const getTodayString = () => {
  return new Date().toISOString().slice(0, 10);
};

const getTomorrowString = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const formatDateWithCheck = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = d.getDate().toString().padStart(2, '0');
  const monthName = d.toLocaleDateString('en-US', { month: 'short' });
  return `✓ ${dayNum} ${monthName} — ${dayName}`;
};

const ApplyLeaveModal = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [durationType, setDurationType] = useState('single'); // Default: 'single'
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTomorrowString());
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [open, onClose]);

  const handleSingleDateChange = (val) => {
    setStartDate(val);
    setEndDate(val);
  };

  const handleDurationToggle = (type) => {
    setDurationType(type);
    if (type === 'single') {
      setEndDate(startDate);
    } else if (startDate === endDate) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + 1);
      setEndDate(d.toISOString().slice(0, 10));
    }
  };

  const activeEndDate = durationType === 'single' ? startDate : endDate;

  // Calculate total leave days (inclusive)
  const startObj = new Date(startDate);
  const endObj = new Date(activeEndDate);
  startObj.setHours(0, 0, 0, 0);
  endObj.setHours(0, 0, 0, 0);

  let calculatedDays = 1;
  if (endObj.getTime() >= startObj.getTime()) {
    calculatedDays = Math.floor((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const start = new Date(startDate);
    const end = new Date(activeEndDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end.getTime() < start.getTime()) {
      toast.error('To Date cannot be earlier than From Date');
      setLoading(false);
      return;
    }

    const requestedDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (requestedDays > 10) {
      toast.error('Maximum 10 leave days can be applied per month');
      setLoading(false);
      return;
    }

    try {
      await api.post('/leaves', {
        leaveType,
        startDate,
        endDate: activeEndDate,
        reason
      });
      toast.success('Leave request submitted');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div className="relative card w-full max-w-lg animate-fade-in text-neutral-800 border border-neutral-200 bg-white p-6 shadow-2xl rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 mb-5">
          <div>
            <h2 className="text-xl font-black text-black tracking-tight">Apply for Leave</h2>
            <p className="text-xs text-neutral-500 mt-0.5 font-medium">Request your leave for approval</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-black cursor-pointer" aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Leave Type */}
          <div>
            <label htmlFor="modalLeaveType" className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Leave Type
            </label>
            <select
              id="modalLeaveType"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              required
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-black font-semibold focus:outline-none focus:border-black"
            >
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="ANNUAL">Annual Leave</option>
            </select>
          </div>

          {/* Leave Duration */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Leave Duration
            </label>
            <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1 rounded-xl border border-neutral-200 mb-3">
              <button
                type="button"
                onClick={() => handleDurationToggle('single')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  durationType === 'single'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                Single Day
              </button>
              <button
                type="button"
                onClick={() => handleDurationToggle('multiple')}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  durationType === 'multiple'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                Multiple Days
              </button>
            </div>

            {/* Date Inputs */}
            {durationType === 'single' ? (
              <div>
                <label htmlFor="singleDateInput" className="block text-[11px] font-bold text-neutral-500 uppercase mb-1">
                  Select Date
                </label>
                <input
                  type="date"
                  id="singleDateInput"
                  value={startDate}
                  onChange={(e) => handleSingleDateChange(e.target.value)}
                  required
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2 text-xs text-black font-semibold focus:outline-none focus:border-black"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="startDateInput" className="block text-[11px] font-bold text-neutral-500 uppercase mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    id="startDateInput"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2 text-xs text-black font-semibold focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label htmlFor="endDateInput" className="block text-[11px] font-bold text-neutral-500 uppercase mb-1">
                    To
                  </label>
                  <input
                    type="date"
                    id="endDateInput"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2 text-xs text-black font-semibold focus:outline-none focus:border-black"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Interactive Date Summary Card */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs font-semibold text-neutral-900 space-y-2">
            <span className="block font-bold text-neutral-500 text-[10px] uppercase tracking-wider mb-1">
              Selected Leave
            </span>
            <div className="flex flex-col gap-1 text-black font-bold">
              <div>{formatDateWithCheck(startDate)}</div>
              {durationType === 'multiple' && startDate !== activeEndDate && (
                <div>{formatDateWithCheck(activeEndDate)}</div>
              )}
            </div>

            <div className="border-t border-neutral-200 pt-2.5 mt-2 flex items-center justify-between font-extrabold text-black text-xs">
              <span>Total Leave</span>
              <span className="text-sm font-black">{calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}</span>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label htmlFor="modalReason" className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Reason
            </label>
            <textarea
              id="modalReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              placeholder="Enter reason for leave..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-black font-medium focus:outline-none focus:border-black resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              type="button"
              className="btn-secondary flex-1 font-bold py-2.5 text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center gap-2 font-bold py-2.5 text-xs rounded-xl cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
              {loading ? 'Submitting...' : 'Submit Leave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyLeaveModal;
