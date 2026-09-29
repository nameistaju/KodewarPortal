import { Loader2Icon, LockIcon, X, Eye, EyeOff } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../api/axios'
import { getErrorMessage, unwrap } from '../api/helpers'
import { useAuth } from '../context/AuthContext'

const ChangePasswordModal = ({open, onClose }) => {
     const [loading, setLoading] = useState(false)
     const [message, setMessage] = useState({type: "", text: ""})
     const [showCurrent, setShowCurrent] = useState(false)
     const [showNew, setShowNew] = useState(false)
     const [showConfirm, setShowConfirm] = useState(false)
     const { setUser, refreshSession } = useAuth()

     useEffect(() => {
         if (open) {
             document.body.style.overflow = 'hidden';
             const handleKeyDown = (e) => {
                 if (e.key === 'Escape') {
                     onClose();
                 }
             };
             window.addEventListener('keydown', handleKeyDown);
             return () => {
                 document.body.style.overflow = '';
                 window.removeEventListener('keydown', handleKeyDown);
             };
         }
     }, [open, onClose]);

     const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true)
        setMessage({ type: "", text: "" });
        const formData = new FormData(e.currentTarget)
        const currentPassword = formData.get("currentPassword");
        const newPassword = formData.get("newPassword");
        const confirmPassword = formData.get("confirmPassword");

        if (newPassword !== confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match." });
            setLoading(false);
            return;
        }

        try {
            const data = unwrap(await api.post("/auth/change-password", {
                currentPassword,
                newPassword
            }));
            localStorage.setItem("token", data.accessToken || data.token);
            localStorage.setItem("refreshToken", data.refreshToken);
            setUser(data.user);
            await refreshSession();
            setMessage({type: "success", text: "Password updated successfully"})
            e.target.reset();
        } catch (error) {
            let errorMsg = getErrorMessage(error);
            const details = error.response?.data?.details;
            if (Array.isArray(details) && details.length > 0) {
                const errorMessages = details.map((d) => {
                    if (d.field === "newPassword") {
                        const msg = d.message;
                        if (
                            msg.includes("at least 8 characters") ||
                            msg.includes("uppercase") ||
                            msg.includes("lowercase") ||
                            msg.includes("number") ||
                            msg.includes("special character") ||
                            msg.includes("complexity") ||
                            msg.includes("strong")
                        ) {
                            return "Password must contain at least 8 characters, uppercase, lowercase, number, and special character.";
                        }
                        return msg;
                    }
                    if (d.field === "currentPassword") {
                        return "Current password is required.";
                    }
                    return d.message;
                });
                errorMsg = errorMessages.filter(Boolean).join(" ");
            }
            setMessage({ type: "error", text: errorMsg });
        }finally{
            setLoading(false);
        }
     }

     if(!open) return null;

  return (
    <div onClick={onClose} className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs'>
        <div className='relative card w-full max-w-md animate-fade-in text-neutral-800 border border-neutral-200 bg-white' onClick={(e) => e.stopPropagation()}>
            <div className='flex items-center justify-between p-6 pb-0'>
                <h2 className='text-lg font-black text-black flex items-center gap-2'>
                    <LockIcon className="w-5 h-5 text-black"/> Change Password
                </h2>
                <button onClick={onClose} className='p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-black cursor-pointer' aria-label="Close modal"><X className="w-5 h-5"/></button>
            </div>
            <form className="p-6 space-y-5" onSubmit={handleSubmit}>
                {message.text && (
                    <div className={`p-3 rounded-xl text-sm border font-bold ${message.type === "success" ? "bg-black text-white border-neutral-900" : "bg-neutral-100 text-neutral-900 border-neutral-300"}`}>
                        {message.text}
                    </div>
                )}
                <div>
                    <label htmlFor="currentPassword" className="block text-sm font-bold text-black mb-2">Current Password</label>
                    <div className="relative">
                        <input id="currentPassword" type={showCurrent ? "text" : "password"} name="currentPassword" required className="pr-10 border-neutral-200 focus:border-black text-black"/>
                        <button
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black focus:outline-none cursor-pointer"
                            aria-label={showCurrent ? "Hide current password" : "Show current password"}
                        >
                            {showCurrent ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                    </div>
                </div>
                <div>
                    <label htmlFor="newPassword" className="block text-sm font-bold text-black mb-2">New Password</label>
                    <div className="relative">
                        <input id="newPassword" type={showNew ? "text" : "password"} name="newPassword" required className="pr-10 border-neutral-200 focus:border-black text-black"/>
                        <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black focus:outline-none cursor-pointer"
                            aria-label={showNew ? "Hide new password" : "Show new password"}
                        >
                            {showNew ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                    </div>
                </div>
                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-bold text-black mb-2">Confirm New Password</label>
                    <div className="relative">
                        <input id="confirmPassword" type={showConfirm ? "text" : "password"} name="confirmPassword" required className="pr-10 border-neutral-200 focus:border-black text-black"/>
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black focus:outline-none cursor-pointer"
                            aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                        >
                            {showConfirm ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                    </div>
                </div>
                <div className='flex gap-3 pt-2'>
                    <button type="button" onClick={onClose} className="btn-secondary flex-1 font-bold cursor-pointer">Cancel</button>
                    <button type="submit" disabled={loading} className="btn-primary flex-1 flex justify-center items-center gap-2 font-bold cursor-pointer">
                        {loading && <Loader2Icon className="w-4 h-4 animate-spin text-white"/>}
                        Update Password
                    </button>
                </div>
            </form>
        </div>
    </div>
  )
}

export default ChangePasswordModal
