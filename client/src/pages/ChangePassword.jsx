import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2Icon, LockIcon, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { getErrorMessage, unwrap } from "../api/helpers";
import { useAuth } from "../context/AuthContext";
import DashboardLoader from "../components/DashboardLoader";

const ChangePassword = () => {
  const { user, loading, refreshSession, setUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  if (loading) return <DashboardLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.mustChangePassword && !user.forcePasswordChange) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      setSaving(false);
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
      toast.success("Password changed successfully");
      navigate("/dashboard", { replace: true });
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
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen surface-gradient flex items-center justify-center p-6">
      {user.role === "EMPLOYEE" && (
        <div className="absolute inset-x-0 top-0 flex h-16 items-center gap-2 border-b border-slate-200 bg-white px-4 lg:hidden">
          <img src="/whiteLogo.png" alt="KODEWAR logo" className="h-7 w-10 object-contain" />
          <span className="text-sm font-black tracking-tight text-slate-900">KODEWAR</span>
        </div>
      )}
      <div className="w-full max-w-md card p-7">
        <div className="mb-6">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-4">
            <LockIcon className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-950">Change your temporary password</h1>
          <p className="text-sm text-slate-500 mt-2">
            This account was created with a temporary password. Update it before continuing to KODEWAR Workforce.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 mb-2">Temporary password</label>
            <div className="relative">
              <input id="currentPassword" type={showCurrent ? "text" : "password"} name="currentPassword" required autoComplete="current-password" className="pr-10" />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                aria-label={showCurrent ? "Hide current password" : "Show current password"}
              >
                {showCurrent ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-2">New password</label>
            <div className="relative">
              <input id="newPassword" type={showNew ? "text" : "password"} name="newPassword" required autoComplete="new-password" className="pr-10" />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                aria-label={showNew ? "Hide new password" : "Show new password"}
              >
                {showNew ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Use at least 8 characters with uppercase, lowercase, number, and special character.
            </p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">Confirm new password</label>
            <div className="relative">
              <input id="confirmPassword" type={showConfirm ? "text" : "password"} name="confirmPassword" required autoComplete="new-password" className="pr-10" />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirm ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving && <Loader2Icon className="w-4 h-4 animate-spin" />}
            Update password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
