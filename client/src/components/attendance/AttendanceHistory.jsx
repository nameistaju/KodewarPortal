import {formatDateTime} from '../../api/helpers'

const AttendanceHistory = ({history}) => {
  return (
    <div className='card overflow-hidden shadow-sm border border-neutral-200'>
        <div className="px-6 py-4 border-b border-neutral-200">
            <h3 className="font-extrabold text-black text-sm">Recent Activity</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="table-modern">
                <thead>
                    <tr className="border-b border-neutral-200">
                        <th>Date</th>
                        <th>Punch In</th>
                        <th>Punch Out</th>
                        <th>Working Hours</th>
                        <th>Auto Closed</th>
                    </tr>
                </thead>
                <tbody>
                    {history.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-12 text-neutral-400">No records found</td></tr>
                    ) : history.map((record)=>(
                        <tr key={record._id} className="hover:bg-neutral-50">
                            <td className='font-bold text-black'>{new Date(record.date).toLocaleDateString()}</td>
                            <td className='text-neutral-700 font-mono'>{formatDateTime(record.punchIn?.time)}</td>
                            <td className='text-neutral-700 font-mono'>{formatDateTime(record.punchOut?.time)}</td>
                            <td className='text-neutral-900 font-bold'>{record.workingHours ? `${record.workingHours}h` : "-"}</td>
                            <td><span className={`badge ${record.isAutoClosed ? "bg-neutral-900 text-white border-neutral-800" : "bg-neutral-100 border border-neutral-200 text-neutral-700"}`}>{record.isAutoClosed ? "Yes" : "No"}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  )
}

export default AttendanceHistory
