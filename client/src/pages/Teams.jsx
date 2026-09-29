import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Edit3, Plus, RefreshCw, Search, Trash2, Users, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import { formatDateTime, toastError, unwrap } from '../api/helpers'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'

const emptyForm = { name: '', description: '', status: 'ACTIVE' }

const Teams = () => {
  const { user, token } = useAuth()
  const [teams, setTeams] = useState([])
  const [pagination, setPagination] = useState(null)
  const [filters, setFilters] = useState({ search: '', status: '', page: 1, limit: 50 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const loadTeams = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''))
      const response = await api.get('/teams', { params })
      const result = unwrap(response)
      setTeams(result.items || [])
      setPagination(result.pagination || null)
    } catch (error) {
      toastError(error)
    } finally {
      setLoading(false)
    }
  }, [filters, token])

  useEffect(() => { loadTeams() }, [loadTeams])

  const openCreate = () => { setEditingTeam(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (team) => {
    setEditingTeam(team)
    setShowForm(true)
    setForm({ name: team.name || '', description: team.description || '', status: team.status || 'ACTIVE' })
  }

  const closeForm = () => { setEditingTeam(null); setShowForm(false); setForm(emptyForm) }

  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          closeForm();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showForm])

  const submitTeam = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (editingTeam?._id) {
        await api.put(`/teams/${editingTeam._id}`, form)
        toast.success('Team updated')
      } else {
        await api.post('/teams', form)
        toast.success('Team created')
      }
      closeForm()
      loadTeams()
    } catch (error) {
      toastError(error)
    } finally {
      setSaving(false)
    }
  }

  const deleteTeam = async (team) => {
    if (!window.confirm(`Delete ${team.name}?`)) return
    try {
      await api.delete(`/teams/${team._id}`)
      toast.success('Team deleted')
      loadTeams()
    } catch (error) {
      toastError(error)
    }
  }

  const activeFilterCount = useMemo(() => Object.entries(filters).filter(([key, value]) => !['page', 'limit'].includes(key) && value).length, [filters])

  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />

  return <div className="animate-fade-in space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="page-title text-slate-900">Team Management</h1>
        <p className="page-subtitle text-slate-500">Create teams, manage status, and monitor field performance.</p>
      </div>
      <button onClick={openCreate} className="btn-primary flex items-center justify-center gap-2 rounded-xl font-semibold"><Plus className="h-4 w-4" /> Create Team</button>
    </div>

    <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} className="pl-9" placeholder="Search by team name or status" />
        </div>
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} className="sm:w-48">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        {activeFilterCount > 0 && <button className="text-xs font-bold text-[#1F7AE0]" onClick={() => setFilters({ search: '', status: '', page: 1, limit: 50 })}>Clear filters</button>}
        <button onClick={loadTeams} className="btn-secondary inline-flex items-center gap-2" disabled={loading}><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> Refresh</button>
      </div>
    </div>

    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Teams</h2>
          <p className="mt-1 text-sm text-slate-500">{pagination?.total || 0} teams found</p>
        </div>
      </div>
      {loading ? <div className="space-y-3 p-5"><div className="h-16 animate-pulse rounded-xl bg-slate-100" /><div className="h-16 animate-pulse rounded-xl bg-slate-100" /></div> : teams.length ? <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Team</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Employees</th><th className="px-4 py-3">Business Visits</th><th className="px-4 py-3">High Priority</th><th className="px-4 py-3">Last Visit</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {teams.map((team) => <tr key={team._id} className="hover:bg-slate-50">
              <td className="px-4 py-4"><p className="font-bold text-slate-900">{team.name}</p><p className="mt-1 max-w-md text-xs text-slate-500">{team.description || 'No description'}</p></td>
              <td className="px-4 py-4"><span className={(team.status === 'ACTIVE' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600') + ' rounded-full border px-2 py-1 text-[10px] font-bold'}>{team.status}</span></td>
              <td className="px-4 py-4 font-bold text-slate-700">{team.stats?.employees || 0}</td>
              <td className="px-4 py-4 font-bold text-slate-700">{team.stats?.businessVisits || 0}</td>
              <td className="px-4 py-4 font-bold text-slate-700">{team.stats?.highPriorityClients || 0}</td>
              <td className="px-4 py-4 text-xs text-slate-600">{team.stats?.lastVisit ? formatDateTime(team.stats.lastVisit) : '-'}</td>
              <td className="px-4 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => openEdit(team)} className="btn-secondary !px-2.5 !py-2" aria-label={'Edit ' + team.name}><Edit3 className="h-4 w-4" /></button><button onClick={() => deleteTeam(team)} className="btn-secondary !px-2.5 !py-2 text-rose-600" aria-label={'Delete ' + team.name}><Trash2 className="h-4 w-4" /></button></div></td>
            </tr>)}
          </tbody>
        </table>
      </div> : <div className="p-6"><EmptyState title="No teams found" description="Create the first team to begin assigning employees." /></div>}
    </div>

    {showForm && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={closeForm}>
      <form onSubmit={submitTeam} onClick={(event) => event.stopPropagation()} className="card my-10 w-full max-w-xl space-y-5 p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#1F7AE0]">Team</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">{editingTeam ? 'Edit Team' : 'Create Team'}</h2></div><button type="button" onClick={closeForm} className="btn-secondary !px-2.5 !py-2"><X className="h-4 w-4" /></button></div>
        <div><label className="label">Team Name *</label><input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1.5" placeholder="Team 1" /></div>
        <div><label className="label">Description</label><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows="4" className="mt-1.5" placeholder="Optional team context" /></div>
        <div><label className="label">Status</label><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-1.5"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={closeForm} className="btn-secondary font-bold">Cancel</button><button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 font-bold"><Users className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Team'}</button></div>
      </form>
    </div>}
  </div>
}

export default Teams

