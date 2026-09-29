import { CalendarDays, FileText, Loader2, Send, X } from 'lucide-react';
import { useState, useEffect } from 'react'
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../api/helpers';

import { useAuth } from '../../context/AuthContext';

const ApplyLeaveModal = ({open, onClose, onSuccess}) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true)
        const data = Object.fromEntries(new FormData(e.currentTarget).entries())
        const { leaveType, startDate, endDate } = data;

        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);

        if (end.getTime() < start.getTime()) {
            toast.error("End date must be greater than or equal to start date");
            setLoading(false);
            return;
        }

        const requestedDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        if (user && user.leaveBalances) {
            const balanceObj = user.leaveBalances.find(b => b.type === leaveType);
            const remainingBalance = balanceObj ? Math.max(0, balanceObj.allocated - balanceObj.used) : 0;
            if (requestedDays > remainingBalance) {
                toast.error(`Insufficient leave balance. Requested: ${requestedDays}, Available: ${remainingBalance}`);
                setLoading(false);
                return;
            }
        }

        try {
            await api.post('/leaves', data)
            toast.success("Leave request submitted")
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    if(!open) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs' onClick={onClose}>
        <div className='relative card w-full max-w-lg animate-fade-in text-[#475569]' onClick={(e)=>e.stopPropagation()}>
            <div className='flex items-center justify-between p-6 pb-0'>
                <div>
                    <h2 className='text-lg font-bold text-[#111827]'>Apply for Leave</h2>
                    <p className='text-sm text-slate-500 mt-0.5'>Submit your leave request for approval</p>
                </div>
                <button onClick={onClose} className='p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer' aria-label="Close modal">
                     <X className="w-5 h-5" />
                </button>
            </div>
            <form onSubmit={handleSubmit} className='p-6 space-y-5'>
                 <div>
                    <label htmlFor="leaveType" className='flex items-center gap-2 text-sm font-semibold text-[#475569] mb-2'><FileText className="w-4 h-4 text-[#2EA8FF]"/> Leave Type</label>
                    <select id="leaveType" name="leaveType" required>
                        <option value="SICK">Sick Leave</option>
                        <option value="CASUAL">Casual Leave</option>
                        <option value="ANNUAL">Annual Leave</option>
                    </select>
                 </div>
                 <div>
                    <span className='flex items-center gap-2 text-sm font-semibold text-[#475569] mb-2'><CalendarDays className="w-4 h-4 text-[#2EA8FF]"/> Duration</span>
                    <div className='grid grid-cols-2 gap-4'>
                        <div>
                            <label htmlFor="startDate" className="sr-only">Start Date</label>
                            <input type="date" id="startDate" name="startDate" required />
                        </div>
                        <div>
                            <label htmlFor="endDate" className="sr-only">End Date</label>
                            <input type="date" id="endDate" name="endDate" required />
                        </div>
                    </div>
                 </div>
                 <div>
                    <label htmlFor="leaveReason" className='text-sm font-semibold text-[#475569] mb-2 block'>Reason</label>
                    <textarea id="leaveReason" name="reason" required rows={3} className="resize-none" placeholder="Briefly describe why you need this leave..." />
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button onClick={onClose} type='button' className="btn-secondary flex-1">Cancel</button>
                    <button disabled={loading} type='submit' className="btn-primary flex-1 flex items-center justify-center gap-2">
                          {loading ? <Loader2 className='w-4 h-4 animate-spin'/> : <Send className="w-4 h-4"/>}
                          {loading ? "Submitting..." : "Submit"}
                    </button>
                 </div>
            </form>
        </div>
    </div>
  )
}

export default ApplyLeaveModal
