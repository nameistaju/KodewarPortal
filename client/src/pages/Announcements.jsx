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
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token || !user) return;
    try {
      setLoading(true)
      const res = await api.get("/announcements?activeOnly=true")
      setItems(unwrapItems(res))
    } catch (error) {
      toastError(error)
    } finally {
      setLoading(false)
    }
  }, [token, user])

  useEffect(()=>{ load() }, [load])

  const submit = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const payload = Object.fromEntries(new FormData(form).entries())
    payload.isPinned = payload.isPinned === "on"
    try {
      await api.post("/announcements", payload)
      toast.success("Announcement published")
      form.reset()
      load()
    } catch (error) { toastError(error) }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title text-black">Announcements</h1>
        <p className="page-subtitle text-neutral-500 font-medium">Pinned and active company updates</p>
      </div>
      {isAdmin && (
        <form onSubmit={submit} className="card p-5 sm:p-6 mb-6 space-y-4 shadow-sm border border-neutral-200 bg-white">
          <h2 className="text-sm font-black text-black">Publish New Announcement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-neutral-700">
            <div>
              <label htmlFor="announcementTitle" className="block mb-1.5 font-bold uppercase tracking-wider text-[9px] text-neutral-500">Announcement Title *</label>
              <input id="announcementTitle" name="title" required placeholder="E.g., System Maintenance" className="w-full rounded-xl border-neutral-200 focus:border-black text-black" />
            </div>
            <div>
              <label htmlFor="announcementDate" className="block mb-1.5 font-bold uppercase tracking-wider text-[9px] text-neutral-500">Visible From Date</label>
              <input type="date" id="announcementDate" name="visibleFrom" className="w-full rounded-xl border-neutral-200 focus:border-black text-black" />
            </div>
          </div>
          <div className="text-xs font-semibold text-neutral-700">
            <label htmlFor="announcementMessage" className="block mb-1.5 font-bold uppercase tracking-wider text-[9px] text-neutral-500">Announcement Message *</label>
            <textarea id="announcementMessage" name="message" required rows={3} placeholder="Type announcement description here..." className="w-full rounded-xl border-neutral-200 focus:border-black text-black" />
          </div>
          <div className="flex items-center gap-2">
            <input className="w-4 h-4 rounded border-neutral-300 text-black focus:ring-black/20 focus:ring-offset-0 cursor-pointer" type="checkbox" id="isPinned" name="isPinned" />
            <label htmlFor="isPinned" className="text-xs font-bold text-neutral-800 cursor-pointer select-none">Pin announcement at the top of the feed</label>
          </div>
          <button className="btn-primary font-bold rounded-xl py-2.5 w-full sm:w-auto px-6 cursor-pointer">Publish Update</button>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <>
            <div className="card p-5 border border-neutral-200 bg-white space-y-3">
              <div className="h-5 w-1/2 skeleton rounded" />
              <div className="h-3 w-1/4 skeleton rounded" />
              <div className="h-12 w-full skeleton rounded mt-4" />
            </div>
            <div className="card p-5 border border-neutral-200 bg-white space-y-3 hidden md:block">
              <div className="h-5 w-1/2 skeleton rounded" />
              <div className="h-3 w-1/4 skeleton rounded" />
              <div className="h-12 w-full skeleton rounded mt-4" />
            </div>
          </>
        ) : items.length === 0 ? (
          <div className="md:col-span-2 card border border-neutral-200 bg-white">
            <EmptyState title="No active announcements" description="Published announcements will show up here for the team." />
          </div>
        ) : (
          items.map((item) => (
            <article 
              key={item._id || item.id} 
              className={`card p-5 shadow-sm transition-all duration-300 border ${
                item.isPinned 
                  ? '!bg-black !text-white border-neutral-900 shadow-md' 
                  : 'hover:shadow-md border-neutral-200 !bg-white !text-black'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className={`font-black text-base ${item.isPinned ? '!text-white' : '!text-black'}`}>{item.title}</h2>
                {item.isPinned && <span className="badge !bg-white !text-black border border-white font-bold text-[10px] shrink-0">📌 Pinned</span>}
              </div>
              <p className={`text-xs font-medium mt-1 ${item.isPinned ? '!text-neutral-400' : '!text-neutral-500'}`}>{formatDate(item.visibleFrom)}</p>
              <p className={`text-sm mt-4 whitespace-pre-wrap leading-relaxed ${item.isPinned ? '!text-neutral-200' : '!text-neutral-800'}`}>{item.message || item.content}</p>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

export default Announcements
