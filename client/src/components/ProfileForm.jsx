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
    <form onSubmit={handleSubmit} className='card p-5 sm:p-6 mb-6 border border-neutral-200 bg-white'>
        <h2 className='text-base font-black text-black mb-6 pb-4 border-b border-neutral-200 flex items-center gap-2'>
           <User className="w-5 h-5 text-black"/> Public Profile
        </h2>

        {error && <div className='bg-neutral-100 text-neutral-900 p-4 rounded-xl text-sm border border-neutral-300 mb-6 font-semibold'>{error}</div>}
        {message && <div className='bg-neutral-900 text-white p-4 rounded-xl text-sm border border-neutral-800 mb-6 font-bold'>{message}</div>}

        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <Avatar user={initialData} size="h-[72px] w-[72px]" className="border-2 border-black shadow-md ring-4 ring-neutral-200" fallbackClassName="text-2xl bg-black text-white" alt="Profile photo preview" />
            <div className="min-w-0">
                <p className="truncate text-xl font-black text-black">{initialData.name || 'Your profile'}</p>
                <p className="mt-1 text-sm font-bold text-neutral-500">{initialData.role || 'Employee'} · {initialData.department || 'Unassigned'}</p>
            </div>
        </div>

        <div className='space-y-5'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                    <label className="block text-sm font-bold text-black mb-2">Name</label>
                    <input name="name" defaultValue={initialData.name || ""} className="border-neutral-200 focus:border-black text-black"/>
                </div>
                <div>
                    <label className="block text-sm font-bold text-black mb-2">Phone</label>
                    <input name="phone" defaultValue={initialData.phone || ""} className="border-neutral-200 focus:border-black text-black"/>
                </div>
                <div>
                    <label className="block text-sm font-bold text-neutral-500 mb-2">Email</label>
                    <input disabled value={initialData.email || ""} className='bg-neutral-100 border-neutral-200 text-neutral-500 cursor-not-allowed'/>
                </div>
                <div>
                    <label className="block text-sm font-bold text-neutral-500 mb-2">Department</label>
                    <input disabled value={initialData.department || ""} className='bg-neutral-100 border-neutral-200 text-neutral-500 cursor-not-allowed'/>
                </div>
            </div>
            <div>
                <label className="block text-sm font-bold text-black mb-2">Profile Photo</label>
                <input type="file" name="profilePhoto" accept="image/*" className="file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-black file:text-white hover:file:bg-neutral-800 cursor-pointer"/>
            </div>
            <div className='flex justify-end pt-2'>
                <button type='submit' disabled={loading} className='btn-primary flex items-center gap-2 justify-center w-full sm:w-auto font-bold cursor-pointer'>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-white"/> : <Save className="w-4 h-4 text-white"/>}
                    Save Changes
                </button>
            </div>
        </div>
    </form>
  )
}

export default ProfileForm
