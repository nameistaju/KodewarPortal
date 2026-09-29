import { useCallback, useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Search,
  Users,
  X
} from "lucide-react"
import api from "../api/axios"
import { toastError, unwrap } from "../api/helpers"
import { useAuth } from "../context/AuthContext"
import Loading from "../components/Loading"
import Avatar from "../components/Avatar"

const departments = ["ADMIN", "HR", "IT", "SALES", "MARKETING", "FINANCE", "OPERATIONS"]
const statuses = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE"]
const pageSizes = [25, 50, 100]

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "-")
const formatTime = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-")
const asHours = (value) => `${Number(value || 0).toFixed(2)}h`

const statusTone = {
  PRESENT: "bg-emerald-50 text-emerald-700 border-emerald-100",
  ABSENT: "bg-rose-50 text-rose-700 border-rose-100",
  LATE: "bg-amber-50 text-amber-700 border-amber-100",
  HALF_DAY: "bg-orange-50 text-orange-700 border-orange-100",
  LEAVE: "bg-blue-50 text-blue-700 border-blue-100"
}

const AdminAttendance = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({})
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 })
  const [sort, setSort] = useState("-date")
  const [selected, setSelected] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: "",
    employeeName: "",
    department: "",
    date: new Date().toISOString().slice(0, 10),
    from: "",
    to: "",
    status: "",
    page: 1,
    limit: 25
  })

  const params = useMemo(() => {
    const entries = Object.entries({ ...filters, sort }).filter(([, value]) => value !== "" && value !== null && value !== undefined)
    return Object.fromEntries(entries)
  }, [filters, sort])

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get("/attendance/admin", { params })
      const payload = unwrap(response)
      setRows(payload.items || [])
      setSummary(payload.summary || {})
      setPagination(payload.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 })
    } catch (error) {
      toastError(error)
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    loadAttendance()
  }, [loadAttendance])

  if (user?.role !== "ADMIN") return <Navigate to="/dashboard" replace />

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value, page: 1 }))
  }

  const resetFilters = () => {
    setFilters({
      search: "",
      employeeName: "",
      department: "",
      date: new Date().toISOString().slice(0, 10),
      from: "",
      to: "",
      status: "",
      page: 1,
      limit: 25
    })
    setSort("-date")
  }

  const openDrawer = async (row) => {
    setDrawerLoading(true)
    try {
      const response = await api.get(`/attendance/admin/${row._id}`)
      setSelected(unwrap(response).attendance)
    } catch {
      setSelected(row)
    } finally {
      setDrawerLoading(false)
    }
  }

  const triggerExport = async (format = "csv") => {
    try {
      const response = await api.get("/attendance/admin/export", {
        params: { ...params, format },
        responseType: "blob"
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `attendance-${new Date().toISOString().slice(0, 10)}.${format === "excel" ? "xls" : "csv"}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      toastError(error)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Attendance Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage and review employee office attendance records</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerExport("csv")}
            className="flex items-center gap-1.5 btn-secondary text-xs py-2 px-3"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => triggerExport("excel")}
            className="flex items-center gap-1.5 btn-primary text-xs py-2 px-3"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      {/* Numerical Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Present Today</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{summary.presentToday ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Late Arrivals</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{summary.lateEmployees ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Absent Today</p>
          <p className="text-2xl font-black text-rose-600 mt-1">{summary.absentEmployees ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">On Leave</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{summary.onLeave ?? 0}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs w-full focus:outline-none focus:border-[#2EA8FF]"
            />
          </div>

          <select
            value={filters.department}
            onChange={(e) => updateFilter("department", e.target.value)}
            className="border border-slate-200 rounded-xl text-xs py-2 px-3 focus:outline-none focus:border-[#2EA8FF]"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="border border-slate-200 rounded-xl text-xs py-2 px-3 focus:outline-none focus:border-[#2EA8FF]"
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.date}
            onChange={(e) => updateFilter("date", e.target.value)}
            className="border border-slate-200 rounded-xl text-xs py-2 px-3 focus:outline-none focus:border-[#2EA8FF]"
          />

          <button
            onClick={resetFilters}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20"><Loading /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Punch In</th>
                  <th className="py-3 px-4">Punch Out</th>
                  <th className="py-3 px-4">Working Hours</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">GPS Verification</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      No attendance records found matching filters
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar user={row.employee} size="w-8 h-8" />
                          <div>
                            <p className="font-bold text-slate-900">{row.employee?.name}</p>
                            <p className="text-[10px] text-slate-400">{row.employee?.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{formatDate(row.date)}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{formatTime(row.punchIn?.time)}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{formatTime(row.punchOut?.time)}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{asHours(row.workingHours)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusTone[row.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${row.gpsVerification === 'Verified' ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {row.gpsVerification}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openDrawer(row)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs">
          <p className="text-slate-500">
            Showing <strong className="text-slate-800">{rows.length}</strong> of <strong className="text-slate-800">{pagination.total}</strong> records
          </p>

          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => updateFilter("page", pagination.page - 1)}
              className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateFilter("page", pagination.page + 1)}
              className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Record Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-900 text-base">Attendance Detail</h3>
              <button onClick={() => setSelected(null)} className="p-1 text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {drawerLoading ? (
              <Loading />
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <Avatar user={selected.employee} size="w-10 h-10" />
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{selected.employee?.name}</p>
                    <p className="text-slate-500">{selected.employee?.department}</p>
                  </div>
                </div>

                <div className="space-y-2 border-b border-slate-100 pb-4">
                  <div className="flex justify-between"><span className="text-slate-500">Date:</span><span className="font-bold text-slate-800">{formatDate(selected.date)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Punch In:</span><span className="font-mono font-bold text-slate-800">{formatTime(selected.punchIn?.time)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Punch Out:</span><span className="font-mono font-bold text-slate-800">{formatTime(selected.punchOut?.time)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Working Hours:</span><span className="font-bold text-slate-800">{asHours(selected.workingHours)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status:</span><span className="font-bold text-slate-800">{selected.status}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">GPS Status:</span><span className="font-bold text-slate-800">{selected.gpsVerification}</span></div>
                </div>

                {selected.adminNotes && (
                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Notes:</span>
                    <p className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">{selected.adminNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminAttendance
