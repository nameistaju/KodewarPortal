import { useCallback, useEffect, useState } from "react"
import { Navigate, useOutletContext } from "react-router-dom"
import { DEPARTMENTS } from "../assets/assets"
import { Plus, Search, X, LayoutGrid, List, Mail, Phone, Calendar, Shield, Trash2, CheckCircle2, AlertCircle } from "lucide-react"
import EmployeeCard from "../components/EmployeeCard"
import EmployeeForm from "../components/EmployeeForm"
import api from "../api/axios"
import { toastError, unwrapItems } from "../api/helpers"
import EmptyState from "../components/EmptyState"
import Avatar from "../components/Avatar"
import { useAuth } from "../context/AuthContext"
import toast from 'react-hot-toast'

const Employees = () => {
  const { user, token } = useAuth()
  const outletCtx = useOutletContext()
  const navbarSearch = outletCtx?.searchQuery || ""

  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedDept, setSelectedDept] = useState("")
  const [editEmployee, setEditEmployee] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isSuccessActive, setIsSuccessActive] = useState(false)
  const [viewMode, setViewMode] = useState("grid") // grid or table

  const fetchEmployees = useCallback(async ()=> {
    if (!token || !user) return;
    try {
      const params = new URLSearchParams();
      if(selectedDept) params.set("department", selectedDept);
      
      const activeSearch = navbarSearch || search;
      if(activeSearch) params.set("search", activeSearch);
      
      const res = await api.get(`/employees?${params.toString()}`)
      setEmployees(unwrapItems(res))
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false)
    }
  }, [selectedDept, search, navbarSearch, token, user])

  useEffect(()=>{
    fetchEmployees();
  },[fetchEmployees])

  useEffect(() => {
    const isModalOpen = showCreateModal || !!editEmployee;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setShowCreateModal(false);
          setEditEmployee(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showCreateModal, editEmployee]);

  const handleStatusChange = async (emp, inactive) => {
    try {
      await api.post(`/employees/${emp._id}/${inactive ? "activate" : "deactivate"}`)
      toast.success(inactive ? "Employee activated" : "Employee deactivated")
      fetchEmployees()
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status")
    }
  }

  if (user?.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="page-title text-slate-900">Employee Directory</h1>
            <p className="page-subtitle text-slate-500">Manage organizational members, credentials, and access policies</p>
          </div>
          <button onClick={()=> setShowCreateModal(true)} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center font-semibold rounded-xl">
            <Plus size={16}/> Add Employee
          </button>
      </div>

      {/* Directory Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between card p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
          {/* Hide local search input if navbar search is active to prevent confusion */}
          {!navbarSearch && (
            <div className="relative w-full sm:w-72 shrink-0">
              <input 
                type="text" 
                placeholder="Search by name, email..." 
                value={search}
                onChange={(e)=> setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs cursor-pointer bg-white border border-[#CBD5E1] rounded-xl text-[#111827] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2EA8FF]/20 focus:border-[#2EA8FF] transition-all"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          )}
          <select 
            value={selectedDept} 
            onChange={(e)=>setSelectedDept(e.target.value)}
            className="w-full sm:w-48 px-3 py-1.5 text-xs cursor-pointer bg-white border border-[#CBD5E1] rounded-xl text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2EA8FF]/20 focus:border-[#2EA8FF] transition-all"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((deptName)=><option key={deptName} value={deptName}>{deptName}</option>)}
          </select>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200/60 p-1 rounded-xl shrink-0 self-end md:self-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === "grid" 
                ? "bg-white text-[#2EA8FF] shadow-sm border border-slate-200/40" 
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === "table" 
                ? "bg-white text-[#2EA8FF] shadow-sm border border-slate-200/40" 
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Directory Grid/Table View */}
      {loading ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({length: 4}).map((_, index)=><div key={index} className="skeleton h-72 rounded-3xl" />)}
          </div>
        ) : (
          <div className="card p-6 skeleton h-64 rounded-3xl" />
        )
      ) : employees.length === 0 ? (
        <div className="card rounded-3xl p-6">
          <EmptyState 
            title="No employees found" 
            description="We couldn't find any team members matching your filter query." 
            action={
              <button onClick={()=> setShowCreateModal(true)} className="btn-primary font-semibold rounded-xl">
                Add Employee
              </button>
            } 
          />
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {employees.map((emp)=> (
            <EmployeeCard key={emp._id} employee={emp} onDelete={fetchEmployees} onEdit={setEditEmployee}/>
          ))}
        </div>
      ) : (
        /* HR Dense Data Table */
        <div className="card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[#64748B] font-bold uppercase tracking-wider text-[9px] bg-slate-50">
                  <th className="p-3.5 pl-5">Employee</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Team</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">Join Date</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-[#475569]">
                {employees.map((emp) => {
                  const isInactive = emp.status === "INACTIVE";
                  const joinDateStr = new Date(emp.joinDate).toLocaleDateString([], {
                    year: 'numeric', month: 'short', day: 'numeric'
                  });

                  return (
                    <tr key={emp._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center gap-3">
                          <Avatar employee={emp} size="w-8 h-8" rounded="rounded-lg" className="border border-slate-200 shadow-xs" fallbackClassName="text-xs" />
                          <div>
                            <p className="text-[#111827] font-bold leading-tight">{emp.name}</p>
                            <p className="text-[10px] text-[#64748B] mt-0.5 leading-none">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-[#475569]">{emp.department}</td>
                      <td className="p-3.5 text-[#475569]">{emp.teamId?.name || "Unassigned"}</td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                          emp.role === "ADMIN" 
                            ? "bg-blue-50 text-blue-600 border border-blue-100" 
                            : "bg-slate-50 text-slate-500 border border-slate-200"
                        }`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#64748B] font-mono">{emp.phone || '-'}</td>
                      <td className="p-3.5 text-[#64748B]">{joinDateStr}</td>
                      <td className="p-3.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          isInactive 
                            ? "bg-rose-50 text-rose-600 border-rose-100" 
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="p-3.5 pr-5 text-right space-x-2">
                        <button 
                          onClick={() => setEditEmployee(emp)} 
                          className="px-2.5 py-1.2 btn-secondary text-xs font-semibold cursor-pointer"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleStatusChange(emp, isInactive)} 
                          className={`px-2.5 py-1.2 rounded-lg border transition-all font-semibold cursor-pointer ${
                            isInactive 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100/70" 
                              : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100/70"
                          }`}
                        >
                          {isInactive ? "Activate" : "Deactivate"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit / Create Form Modal Container */}
      {(showCreateModal || editEmployee) && (
        <div 
          className="fixed bg-black/50 backdrop-blur-xs inset-0 z-50 flex items-center justify-center p-4" 
          onClick={()=> { if (!isSuccessActive) { setShowCreateModal(false); setEditEmployee(null); } }}
        >
          <div 
            className={`relative card text-slate-800 shadow-2xl w-full ${editEmployee ? 'max-w-3xl' : 'max-w-2xl'} my-auto animate-fade-in overflow-hidden flex flex-col max-h-[90vh]`}
            onClick={(e)=> e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 pb-4 border-b border-slate-100 bg-white z-10 shrink-0">
              <div>
                <h2 className="text-base font-extrabold text-[#111827] leading-tight">
                  {editEmployee ? `Modify Profile: ${editEmployee.name}` : "Create Team Member Profile"}
                </h2>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">
                  {editEmployee ? "Review settings, leave requests, attendance history, and log records" : "Provision a new employee login account"}
                </p>
              </div>
              {!isSuccessActive && (
                <button 
                  onClick={()=> { setShowCreateModal(false); setEditEmployee(null); }} 
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5"/>
                </button>
              )}
            </div>
            
            {/* Modal Body wrapper containing EmployeeForm */}
            <div className="flex-1 min-h-0 flex flex-col bg-white">
              <EmployeeForm 
                initialData={editEmployee} 
                onSuccess={()=>{ setIsSuccessActive(false); setShowCreateModal(false); setEditEmployee(null); fetchEmployees(); }} 
                onCancel={()=> { if (!isSuccessActive) { setIsSuccessActive(false); setShowCreateModal(false); setEditEmployee(null); } }}
                onSuccessStateChange={(isSuccess) => setIsSuccessActive(isSuccess)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Employees
