import { useCallback, useEffect, useMemo, useState } from "react"
import { Navigate } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  Search,
  X
} from "lucide-react"
import api from "../api/axios"
import { toastError, unwrap } from "../api/helpers"
import { useAuth } from "../context/AuthContext"
import Loading from "../components/Loading"
import Avatar from "../components/Avatar"

const departments = ["ADMIN", "HR", "IT", "SALES", "MARKETING", "FINANCE", "OPERATIONS"]
const statuses = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "LEAVE"]

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "-")
const formatTime = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-")
const asHours = (value) => `${Number(value || 0).toFixed(2)}h`

const statusTone = {
  PRESENT: "bg-black text-white border-neutral-900",
  ABSENT: "bg-neutral-200 text-neutral-900 border-neutral-300",
  LATE: "bg-neutral-100 text-neutral-800 border-neutral-300",
  HALF_DAY: "bg-neutral-100 text-neutral-800 border-neutral-300",
  LEAVE: "bg-neutral-900 text-white border-neutral-800"
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
          <h1 className="text-2xl font-black tracking-tight text-black">Attendance Center</h1>
          <p className="text-xs text-neutral-500 mt-0.5 font-medium">Manage and review employee office attendance records</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerExport("csv")}
            className="flex items-center gap-1.5 btn-secondary text-xs py-2 px-3 font-bold"
          >
            <Download className="w-4 h-4 text-black" />
            CSV
          </button>
          <button
            onClick={() => triggerExport("excel")}
            className="flex items-center gap-1.5 btn-primary text-xs py-2 px-3 font-bold"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            Excel
          </button>
        </div>
      </div>

      {/* Numerical Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-neutral-500">Present Today</p>
          <p className="text-2xl font-black text-black mt-1">{summary.presentToday ?? 0}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-neutral-500">Late Arrivals</p>
          <p className="text-2xl font-black text-black mt-1">{summary.lateEmployees ?? 0}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-neutral-500">Absent Today</p>
          <p className="text-2xl font-black text-black mt-1">{summary.absentEmployees ?? 0}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-neutral-500">On Leave</p>
          <p className="text-2xl font-black text-black mt-1">{summary.onLeave ?? 0}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="pl-9 pr-4 py-2 border border-neutral-200 rounded-xl text-xs w-full focus:outline-none focus:border-black text-black"
            />
          </div>

          <select
            value={filters.department}
            onChange={(e) => updateFilter("department", e.target.value)}
            className="border border-neutral-200 rounded-xl text-xs py-2 px-3 focus:outline-none focus:border-black text-black"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="border border-neutral-200 rounded-xl text-xs py-2 px-3 focus:outline-none focus:border-black text-black"
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
            className="border border-neutral-200 rounded-xl text-xs py-2 px-3 focus:outline-none focus:border-black text-black"
          />

          <button
            onClick={resetFilters}
            className="text-xs text-neutral-500 hover:text-black font-bold px-2 py-1 cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20"><Loading /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 uppercase text-[10px] tracking-wider font-bold">
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
              <tbody className="divide-y divide-neutral-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-neutral-400">
                      No attendance records found matching filters
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row._id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar user={row.employee} size="w-8 h-8" />
                          <div>
                            <p className="font-bold text-black">{row.employee?.name}</p>
                            <p className="text-[10px] text-neutral-500">{row.employee?.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-neutral-800">{formatDate(row.date)}</td>
                      <td className="py-3 px-4 font-mono text-neutral-700">{formatTime(row.punchIn?.time)}</td>
                      <td className="py-3 px-4 font-mono text-neutral-700">{formatTime(row.punchOut?.time)}</td>
                      <td className="py-3 px-4 font-bold text-neutral-900">{asHours(row.workingHours)}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusTone[row.status] || "bg-neutral-100 text-neutral-700 border-neutral-200"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${row.gpsVerification === 'Verified' ? 'text-black' : 'text-neutral-500'}`}>
                          {row.gpsVerification}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openDrawer(row)}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg text-black transition-colors cursor-pointer"
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 text-xs">
          <p className="text-neutral-500 font-medium">
            Showing <strong className="text-black">{rows.length}</strong> of <strong className="text-black">{pagination.total}</strong> records
          </p>

          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => updateFilter("page", pagination.page - 1)}
              className="p-1.5 border border-neutral-200 rounded-lg disabled:opacity-40 hover:bg-neutral-100 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-black" />
            </button>
            <span className="font-bold text-black">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateFilter("page", pagination.page + 1)}
              className="p-1.5 border border-neutral-200 rounded-lg disabled:opacity-40 hover:bg-neutral-100 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-black" />
            </button>
          </div>
        </div>
      </div>

      {/* Record Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6 border-l border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <h3 className="font-black text-black text-base">Attendance Detail</h3>
              <button onClick={() => setSelected(null)} className="p-1 text-neutral-400 hover:text-black cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {drawerLoading ? (
              <Loading />
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <Avatar user={selected.employee} size="w-10 h-10" />
                  <div>
                    <p className="font-extrabold text-black text-sm">{selected.employee?.name}</p>
                    <p className="text-neutral-500 font-medium">{selected.employee?.department}</p>
                  </div>
                </div>

                <div className="space-y-2 border-b border-neutral-200 pb-4">
                  <div className="flex justify-between"><span className="text-neutral-500 font-semibold">Date:</span><span className="font-bold text-black">{formatDate(selected.date)}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500 font-semibold">Punch In:</span><span className="font-mono font-bold text-black">{formatTime(selected.punchIn?.time)}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500 font-semibold">Punch Out:</span><span className="font-mono font-bold text-black">{formatTime(selected.punchOut?.time)}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500 font-semibold">Working Hours:</span><span className="font-bold text-black">{asHours(selected.workingHours)}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500 font-semibold">Status:</span><span className="font-bold text-black">{selected.status}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500 font-semibold">GPS Status:</span><span className="font-bold text-black">{selected.gpsVerification}</span></div>
                </div>

                {selected.adminNotes && (
                  <div>
                    <span className="font-bold text-black block mb-1">Notes:</span>
                    <p className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-800">{selected.adminNotes}</p>
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
