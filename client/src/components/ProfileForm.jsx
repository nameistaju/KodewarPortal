import { Loader2, Save, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { getErrorMessage, unwrap } from '../api/helpers';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const ProfileForm = ({ initialData, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const { setUser } = useAuth();

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPG, PNG, and WEBP images are allowed.');
        e.target.value = '';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB.');
        e.target.value = '';
        return;
      }
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    const formData = new FormData(e.currentTarget);
    try {
      const response = await api.patch('/employees/me/profile', formData);
      const data = unwrap(response);
      if (data.employee) {
        setUser((prev) => ({ ...prev, ...data.employee }));
      }
      toast.success('Profile updated successfully');
      setMessage('Profile updated successfully');
      onSuccess?.();
    } catch (err) {
      const errMsg = getErrorMessage(err) || 'Failed to update profile. Please try again.';
      toast.error(errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const currentUserData = previewUrl
    ? { ...initialData, profilePhoto: { url: previewUrl }, avatar: previewUrl }
    : initialData;

  return (
    <form onSubmit={handleSubmit} className="card p-5 sm:p-6 mb-6 border border-neutral-200 bg-white shadow-sm rounded-2xl">
      <h2 className="text-base font-black text-black mb-6 pb-4 border-b border-neutral-200 flex items-center gap-2">
        <User className="w-5 h-5 text-black" /> Public Profile
      </h2>

      {error && (
        <div className="bg-neutral-900 text-white p-4 rounded-xl text-sm border border-neutral-800 mb-6 font-semibold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="bg-black text-white p-4 rounded-xl text-sm border border-neutral-800 mb-6 font-bold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <Avatar
          user={currentUserData}
          size="h-[72px] w-[72px]"
          className="border-2 border-black shadow-md ring-4 ring-neutral-200 object-cover"
          fallbackClassName="text-2xl bg-black text-white"
          alt="Profile photo preview"
        />
        <div className="min-w-0">
          <p className="truncate text-xl font-black text-black">{initialData?.name || 'Your profile'}</p>
          <p className="mt-1 text-sm font-bold text-neutral-500">
            {initialData?.role || 'Employee'} · {initialData?.department || 'Unassigned'}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-black mb-2">Name</label>
            <input name="name" defaultValue={initialData?.name || ''} className="border-neutral-200 focus:border-black text-black w-full" />
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-2">Phone</label>
            <input name="phone" defaultValue={initialData?.phone || ''} className="border-neutral-200 focus:border-black text-black w-full" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-500 mb-2">Email</label>
            <input disabled value={initialData?.email || ''} className="bg-neutral-100 border-neutral-200 text-neutral-500 cursor-not-allowed w-full" />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-500 mb-2">Department</label>
            <input disabled value={initialData?.department || ''} className="bg-neutral-100 border-neutral-200 text-neutral-500 cursor-not-allowed w-full" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-black mb-2">Profile Photo</label>
          <input
            type="file"
            name="profilePhoto"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-black file:text-white hover:file:bg-neutral-800 cursor-pointer w-full text-sm text-neutral-600"
          />
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center gap-2 justify-center w-full sm:w-auto font-bold cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4 text-white" />}
            Save Changes
          </button>
        </div>
      </div>
    </form>
  );
};

export default ProfileForm;
