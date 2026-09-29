import { Loader2, Save, User } from 'lucide-react';
import { useState } from 'react'
import api from '../api/axios';
import { getErrorMessage, unwrap } from '../api/helpers';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const ProfileForm = ({initialData, onSuccess}) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const { setUser } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true)
        setError("")
        setMessage("")
        const formData = new FormData(e.currentTarget)
        try {
            const response = await api.patch("/employees/me/profile", formData)
            const data = unwrap(response);
            if (data.employee) {
                setUser((prev) => ({ ...prev, ...data.employee }));
            }
            setMessage("Profile updated successfully")
            onSuccess?.()
        } catch (err) {
            setError(getErrorMessage(err));
        }finally{
            setLoading(false)
        }
    }

  return (
    <form onSubmit={handleSubmit} className='card p-5 sm:p-6 mb-6'>
        <h2 className='text-base font-bold text-[#111827] mb-6 pb-4 border-b border-slate-200 flex items-center gap-2'>
           <User className="w-5 h-5 text-[#2EA8FF]"/> Public Profile
        </h2>

        {error && <div className='bg-rose-50 text-rose-700 p-4 rounded-xl text-sm border border-rose-100 mb-6'>{error}</div>}
        {message && <div className='bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm border border-emerald-100 mb-6'>{message}</div>}

        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <Avatar user={initialData} size="h-[72px] w-[72px]" className="border-2 border-[#2EA8FF] shadow-[0_14px_30px_rgba(31,122,224,0.16)] ring-4 ring-white" fallbackClassName="text-2xl" alt="Profile photo preview" />
            <div className="min-w-0">
                <p className="truncate text-xl font-black text-[#111827]">{initialData.name || 'Your profile'}</p>
                <p className="mt-1 text-sm font-semibold text-[#64748B]">{initialData.role || 'Employee'} · {initialData.department || 'Unassigned'}</p>
            </div>
        </div>

        <div className='space-y-5'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                    <label className="block text-sm font-semibold text-[#475569] mb-2">Name</label>
                    <input name="name" defaultValue={initialData.name || ""}/>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-[#475569] mb-2">Phone</label>
                    <input name="phone" defaultValue={initialData.phone || ""}/>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-[#475569] mb-2">Email</label>
                    <input disabled value={initialData.email || ""} className='bg-slate-100 border-slate-200 text-[#94A3B8] cursor-not-allowed'/>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-[#475569] mb-2">Department</label>
                    <input disabled value={initialData.department || ""} className='bg-slate-100 border-slate-200 text-[#94A3B8] cursor-not-allowed'/>
                </div>
            </div>
            <div>
                <label className="block text-sm font-semibold text-[#475569] mb-2">Profile Photo</label>
                <input type="file" name="profilePhoto" accept="image/*" className="file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#2EA8FF]/10 file:text-[#2EA8FF] hover:file:bg-[#2EA8FF]/20"/>
            </div>
            <div className='flex justify-end pt-2'>
                <button type='submit' disabled={loading} className='btn-primary flex items-center gap-2 justify-center w-full sm:w-auto font-semibold'>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                    Save Changes
                </button>
            </div>
        </div>
    </form>
  )
}

export default ProfileForm
