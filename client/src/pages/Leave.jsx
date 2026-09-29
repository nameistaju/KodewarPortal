import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import Loading from "../components/Loading"
import { PalmtreeIcon, PlusIcon, ThermometerIcon, UmbrellaIcon } from "lucide-react"
import LeaveHistory from "../components/leave/LeaveHistory"
import ApplyLeaveModal from "../components/leave/ApplyLeaveModal"
import { useAuth } from "../context/AuthContext"
import api from "../api/axios"
import { toastError, unwrapItems } from "../api/helpers"

const Leave = () => {
  const {user, token, refreshSession} = useAuth()
  const outletCtx = useOutletContext()
  const searchQuery = outletCtx?.searchQuery?.toLowerCase() || ""

  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const isAdmin = user?.role === "ADMIN";

  const fetchLeaves = useCallback(async ()=>{
   if (!token || !user) return;
   try {
    const res = await api.get('/leaves');
    setLeaves(unwrapItems(res))
    if (user.role !== "ADMIN") {
      await refreshSession();
    }
   } catch (error) {
    toastError(error)
   }finally{
    setLoading(false)
   }
  },[token, user, refreshSession])

  useEffect(()=>{ fetchLeaves() },[fetchLeaves])

  if(loading) return <Loading />

  const getRemainingBalance = (type) => {
    if (!user || !user.leaveBalances) return 0;
    const balance = user.leaveBalances.find((b) => b.type === type);
    return balance ? Math.max(0, balance.allocated - balance.used) : 0;
  };

  const leaveStats = [
    {label: "Sick Leave", value: getRemainingBalance("SICK"), icon: ThermometerIcon},
    {label: "Casual Leave", value: getRemainingBalance("CASUAL"), icon: UmbrellaIcon},
    {label: "Annual Leave", value: getRemainingBalance("ANNUAL"), icon: PalmtreeIcon},
  ]

  const filteredLeaves = leaves.filter((l) => {
    const empName = l.employee?.name?.toLowerCase() || "";
    const reason = l.reason?.toLowerCase() || "";
    const type = l.leaveType?.toLowerCase() || "";
    return empName.includes(searchQuery) || reason.includes(searchQuery) || type.includes(searchQuery);
  })

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="page-title text-black">Leave Management</h1>
          <p className="page-subtitle text-neutral-500 font-medium">{isAdmin ? "Manage leave applications" : "Your leave history and requests"}</p>
        </div>
        {!isAdmin && (
          <button onClick={()=> setShowModal(true)} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center font-bold rounded-xl cursor-pointer">
            <PlusIcon className="w-4 h-4 text-white" /> Apply for Leave
          </button>
        )}
      </div>
        {!isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-8">
            {leaveStats.map((s)=>(
              <div key={s.label} className="card card-hover p-5 sm:p-6 flex items-center gap-4 relative overflow-hidden group border border-neutral-200">
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-neutral-200 group-hover:bg-black" />
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl group-hover:bg-neutral-100 transition-colors duration-200">
                    <s.icon className="w-5 h-5 text-neutral-500 group-hover:text-black transition-colors duration-200" />
                </div>
                <div>
                  <p className="text-xs text-neutral-500 font-bold uppercase">{s.label}</p>
                  <p className="text-2xl font-black text-black tracking-tight">{s.value} <span className="text-sm font-normal text-neutral-500">remaining</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
        <LeaveHistory leaves={filteredLeaves} isAdmin={isAdmin} onUpdate={fetchLeaves}/>
        <ApplyLeaveModal open={showModal} onClose={()=> setShowModal(false)} onSuccess={fetchLeaves}/>
    </div>
  )
}

export default Leave
