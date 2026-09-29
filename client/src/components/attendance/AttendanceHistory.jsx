import {formatDateTime} from '../../api/helpers'

const AttendanceHistory = ({history}) => {
  return (
    <div className='card overflow-hidden shadow-sm'>
        <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-[#111827] text-sm">Recent Activity</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="table-modern">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Punch In</th>
                        <th>Punch Out</th>
                        <th>Working Hours</th>
                        <th>Auto Closed</th>
                    </tr>
                </thead>
                <tbody>
                    {history.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-12 text-slate-400">No records found</td></tr>
                    ) : history.map((record)=>(
                        <tr key={record._id}>
                            <td className='font-bold text-[#111827]'>{new Date(record.date).toLocaleDateString()}</td>
                            <td className='text-[#475569]'>{formatDateTime(record.punchIn?.time)}</td>
                            <td className='text-[#475569]'>{formatDateTime(record.punchOut?.time)}</td>
                            <td className='text-[#475569] font-medium'>{record.workingHours ? `${record.workingHours}h` : "-"}</td>
                            <td><span className={`badge ${record.isAutoClosed ? "badge-warning" : "bg-slate-50 border border-slate-200 text-slate-500"}`}>{record.isAutoClosed ? "Yes" : "No"}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  )
}

export default AttendanceHistory
