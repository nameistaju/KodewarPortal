import { useCallback, useEffect, useState } from "react"
import api from "../api/axios"
import toast from "react-hot-toast"
import { formatDate, toastError, unwrapItems } from "../api/helpers"
import { useAuth } from "../context/AuthContext"
import EmptyState from "../components/EmptyState"

const Announcements = () => {
  const { user, token } = useAuth()
  const isAdmin = user?.role === "ADMIN"
  const [items, setItems] = useState([])

  const load = useCallback(async () => {
    if (!token || !user) return;
    try { setItems(unwrapItems(await api.get("/announcements?activeOnly=true"))) }
    catch (error) { toastError(error) }
  }, [token, user])

  useEffect(()=>{ load() }, [load])

  const submit = async (event) => {
    event.preventDefault()
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries())
    payload.isPinned = payload.isPinned === "on"
    try {
      await api.post("/announcements", payload)
      toast.success("Announcement published")
      event.currentTarget.reset()
      load()
    } catch (error) { toastError(error) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title text-slate-900">Announcements</h1>
        <p className="page-subtitle text-slate-500">Pinned and active company updates</p>
      </div>
      {isAdmin && (
        <form onSubmit={submit} className="card p-5 sm:p-6 mb-6 space-y-4 shadow-sm">
          <h2 className="text-sm font-extrabold text-[#111827]">Publish New Announcement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-[#475569]">
            <div>
              <label htmlFor="announcementTitle" className="block mb-1.5 font-bold uppercase tracking-wider text-[9px] text-slate-500">Announcement Title *</label>
              <input id="announcementTitle" name="title" required placeholder="E.g., System Maintenance" className="w-full rounded-xl" />
            </div>
            <div>
              <label htmlFor="announcementDate" className="block mb-1.5 font-bold uppercase tracking-wider text-[9px] text-slate-500">Visible From Date</label>
              <input type="date" id="announcementDate" name="visibleFrom" className="w-full rounded-xl" />
            </div>
          </div>
          <div className="text-xs font-semibold text-[#475569]">
            <label htmlFor="announcementMessage" className="block mb-1.5 font-bold uppercase tracking-wider text-[9px] text-slate-500">Announcement Message *</label>
            <textarea id="announcementMessage" name="message" required rows={3} placeholder="Type announcement description here..." className="w-full rounded-xl" />
          </div>
          <div className="flex items-center gap-2">
            <input className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 cursor-pointer" type="checkbox" id="isPinned" name="isPinned" />
            <label htmlFor="isPinned" className="text-xs font-semibold text-[#475569] cursor-pointer select-none">Pin announcement at the top of the feed</label>
          </div>
          <button className="btn-primary font-semibold rounded-xl py-2.5 w-full sm:w-auto px-6">Publish Update</button>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item)=>(
          <article 
            key={item._id} 
            className={`card p-5 shadow-sm transition-all duration-300 ${
              item.isPinned 
                ? 'bg-[#EBF7FF] border-[#53B8FF] hover:bg-[#DDF0FF]' 
                : 'hover:shadow-md border-slate-200/80 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-bold text-[#111827]">{item.title}</h2>
              {item.isPinned && <span className="badge bg-amber-500/10 text-amber-600 border border-amber-500/25">📌 Pinned</span>}
            </div>
            <p className="text-xs text-[#64748B] font-medium mt-1">{formatDate(item.visibleFrom)}</p>
            <p className="text-sm text-[#475569] mt-4 whitespace-pre-wrap">{item.message}</p>
          </article>
        ))}
        {items.length === 0 && <div className="md:col-span-2 card"><EmptyState title="No active announcements" description="Published announcements will show up here for the team." /></div>}
      </div>
    </div>
  )
}

export default Announcements
