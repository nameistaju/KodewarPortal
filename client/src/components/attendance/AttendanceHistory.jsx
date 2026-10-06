import { formatDate, formatDateTime } from '../../api/helpers'

const AttendanceHistory = ({ history }) => {
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
                    ) : history.map((record)=>{
                        const isAuto = record.status === 'AUTO_PUNCHED_OUT' || record.isAutoClosed;
                        return (
                          <tr key={record._id} className="hover:bg-neutral-50">
                              <td className='font-bold text-black'>{formatDate(record.date)}</td>
                              <td className='text-neutral-700 font-mono'>{formatDateTime(record.punchIn?.time)}</td>
                              <td className='text-neutral-700 font-mono'>{formatDateTime(record.punchOut?.time)}</td>
                              <td className='text-neutral-900 font-bold'>{record.workingHoursText || (record.workingHours ? `${record.workingHours}h` : "—")}</td>
                              <td><span className={`badge ${isAuto ? "bg-neutral-900 text-amber-300 border-neutral-800 font-bold" : "bg-neutral-100 border border-neutral-200 text-neutral-700"}`}>{isAuto ? "Auto Closed (18:30)" : "No"}</span></td>
                          </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
  )
}

export default AttendanceHistory
