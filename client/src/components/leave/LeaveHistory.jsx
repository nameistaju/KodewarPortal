import { Check, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import {formatDate, employeeName} from '../../api/helpers'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../../api/helpers'

const LeaveHistory = ({leaves, isAdmin, onUpdate}) => {
    const [processing, setProcessing] = useState(null)

    const review = async (id, action) => {
        setProcessing(id)
        try {
            await api.post(`/leaves/${id}/${action}`, {})
            toast.success(`Leave ${action}d`)
            onUpdate();
        } catch (error) {
            toast.error(getErrorMessage(error))
        }finally{
            setProcessing(null)
        }
    }

    const getStatusBadge = (status) => {
      if (status === "APPROVED") return "bg-black text-white border border-neutral-900"
      if (status === "REJECTED") return "bg-neutral-200 text-neutral-900 border border-neutral-300"
      return "bg-neutral-100 text-neutral-800 border border-neutral-300"
    }

  return (
      <div className='card overflow-hidden shadow-sm border border-neutral-200 bg-white'>
            <div className="overflow-x-auto">
                <table className="table-modern">
                    <thead>
                        <tr className="border-b border-neutral-200">
                            {isAdmin && <th>Employee</th>}
                            <th>Type</th>
                            <th>Dates</th>
                            <th>Reason</th>
                            <th>Status</th>
                            {isAdmin && <th className='text-center'>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {leaves.length === 0 ? (
                            <tr><td colSpan={isAdmin ? 6 : 4} className="text-center py-12 text-neutral-400">No leave applications found</td></tr>
                        ) : leaves.map((leave)=>(
                            <tr key={leave._id} className="hover:bg-neutral-50">
                                {isAdmin && <td className='text-black font-bold'>{employeeName(leave.employee)}</td>}
                                <td><span className='badge bg-neutral-100 border border-neutral-200 text-neutral-800 font-bold'>{leave.leaveType}</span></td>
                                <td className='text-xs text-neutral-700 font-medium'>{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</td>
                                <td className='max-w-xs truncate text-neutral-700' title={leave.reason}>{leave.reason}</td>
                                <td><span className={`badge ${getStatusBadge(leave.status)}`}>{leave.status}</span></td>
                                {isAdmin && (
                                    <td>
                                        {leave.status === "PENDING" && (
                                            <div className='flex justify-center gap-2'>
                                                <button disabled={!!processing} onClick={()=> review(leave._id, "approve")} className='p-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-900' title="Approve">
                                                    {processing === leave._id ? <Loader2 className="w-4 h-4 animate-spin text-white"/> : <Check className="w-4 h-4 text-white"/>}
                                                </button>
                                                <button onClick={()=> review(leave._id, "reject")} disabled={!!processing} className='p-1.5 rounded-xl bg-white text-black border border-neutral-300 hover:bg-neutral-100 transition-colors cursor-pointer' title="Reject">
                                                    {processing === leave._id ? <Loader2 className="w-4 h-4 animate-spin text-black"/> : <X className="w-4 h-4 text-black"/>}
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
  )
}

export default LeaveHistory
