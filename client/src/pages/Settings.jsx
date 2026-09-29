import { useCallback, useEffect, useState } from "react"
import Loading from "../components/Loading"
import { Lock, Mail, Smartphone } from "lucide-react"
import ProfileForm from "../components/ProfileForm"
import ChangePasswordModal from "../components/ChangePasswordModal"
import { useAuth } from "../context/AuthContext"
import api from "../api/axios"
import { toastError, unwrap } from "../api/helpers"

const ToggleRow = ({ title, description, defaultChecked }) => {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-slate-50/50 border border-slate-200 rounded-xl">
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-900">{title}</p>
        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => setChecked(!checked)}
        className={`w-10 h-5.5 rounded-full p-0.5 transition-all duration-200 shrink-0 flex items-center ${
          checked ? "bg-[#1F7AE0] justify-end" : "bg-slate-300 justify-start"
        }`}
      >
        <span className="w-4.5 h-4.5 rounded-full bg-white shadow-xs" />
      </button>
    </div>
  );
};

const Settings = () => {
  const { user, token } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  const [installable, setInstallable] = useState(!!window.deferredPWAInstallPrompt)

  useEffect(() => {
    const handleInstallable = () => {
      setInstallable(true)
    }
    const handleInstalled = () => {
      setInstallable(false)
    }

    window.addEventListener('pwa:installable', handleInstallable)
    window.addEventListener('pwa:installed', handleInstalled)

    // Initial check for standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
    if (isStandalone) {
      setInstallable(false)
    }

    return () => {
      window.removeEventListener('pwa:installable', handleInstallable)
      window.removeEventListener('pwa:installed', handleInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    const promptEvent = window.deferredPWAInstallPrompt
    if (!promptEvent) return
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') {
      window.deferredPWAInstallPrompt = null
      setInstallable(false)
    }
  }

  const fetchProfile = useCallback(async () => {
    if (!token || !user) return;
    try {
      const data = unwrap(await api.get("/employees/me/profile"))
      if (data.employee) setProfile(data.employee)
    } catch (err) {
      toastError(err)
    } finally {
      setLoading(false)
    }
  }, [token, user])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  if (loading) return <Loading />

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header">
        <h1 className="page-title text-slate-900 text-2xl font-black">Settings</h1>
        <p className="page-subtitle text-slate-500 text-xs mt-1">Manage your account configurations and user preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-6 items-start">
        {/* Navigation Sidebar/Top Bar */}
        <div className="flex lg:flex-col gap-1 border-b lg:border-b-0 lg:border-r border-slate-200 pb-3 lg:pb-0 lg:pr-4 overflow-x-auto shrink-0 scrollbar-none">
          {["profile", "security", "notifications", "preferences"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-left text-xs font-bold uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                activeTab === tab
                  ? "bg-[#EBF7FF] text-[#1F7AE0] font-black"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content Panel */}
        <div className="flex-1 min-w-0 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          {activeTab === "profile" && profile && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-base font-black text-[#111827]">Personal Profile</h2>
              <p className="text-xs text-slate-500">Update your name, phone number, and address details.</p>
              <ProfileForm initialData={profile} onSuccess={fetchProfile} />
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-base font-black text-[#111827]">Security & Password</h2>
              <p className="text-xs text-slate-500 flex-1">Update your password to keep your account secure.</p>
              <div className="card max-w-md p-6 flex items-center justify-between shadow-xs border border-slate-200 mt-2 bg-slate-50/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#2EA8FF]/10 text-[#1F7AE0] border border-[#2EA8FF]/20 rounded-xl"><Lock className="w-5 h-5" /></div>
                  <div>
                    <p className="font-bold text-[#111827]">Password</p>
                    <p className="text-xs text-[#64748B] mt-0.5">Update your account password</p>
                  </div>
                </div>
                <button onClick={() => setShowPasswordModal(true)} className="btn-secondary text-xs font-semibold py-2">Change</button>
              </div>
              <ChangePasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-base font-black text-[#111827]">Notification Alerts</h2>
                <p className="text-xs text-slate-500 mt-0.5">Control how and when you receive emails and system alerts.</p>
              </div>
              <div className="space-y-4 max-w-md">
                <ToggleRow title="Email Notifications" description="Receive task updates and system change emails." defaultChecked={true} />
                <ToggleRow title="Push Notifications" description="Get instant alerts for clock-ins, clock-outs, and visits." defaultChecked={true} />
                <ToggleRow title="Daily Attendance Digest" description="A clean morning report listing team schedules." defaultChecked={false} />
                <ToggleRow title="Weekly Performance Digest" description="A weekly review containing visit stats and travel data." defaultChecked={true} />
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-base font-black text-[#111827]">System Preferences</h2>
                <p className="text-xs text-slate-500 mt-0.5">Optimize your EMS experience with personalization.</p>
              </div>
              <div className="space-y-4 max-w-md">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500">Interface Language</label>
                  <select className="w-full rounded-xl border border-slate-200 py-2 px-3 text-sm focus:border-[#2EA8FF] focus:outline-none bg-white">
                    <option value="en">English (US)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="hi">हिन्दी</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 pt-2">
                  <label className="text-xs font-bold text-slate-500">Color Theme</label>
                  <select className="w-full rounded-xl border border-slate-200 py-2 px-3 text-sm focus:border-[#2EA8FF] focus:outline-none bg-white">
                    <option value="system">System Default</option>
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                </div>
                <ToggleRow title="Dense View" description="Compact spacing and smaller fonts for table rows." defaultChecked={false} />

                {installable && (
                  <div className="card p-5 border border-[#2EA8FF]/20 bg-[#EBF7FF]/35 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 mt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-[#2EA8FF]/10 text-[#1F7AE0] border border-[#2EA8FF]/20 rounded-xl">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#111827] text-sm">Install KODEWAR App</p>
                        <p className="text-xs text-[#64748B] mt-0.5">Access EMS as a native desktop or mobile app</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      className="btn-primary text-xs font-semibold py-2 px-4 shrink-0 rounded-xl"
                    >
                      Install App
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
