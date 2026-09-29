import { Navigate, Outlet, useLocation, Link } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import Avatar from "../components/Avatar"
import { useAuth } from "../context/AuthContext"
import { EmployeeTrackingProvider } from '../context/EmployeeTrackingContext'
import Loading from "../components/Loading"
import api from "../api/axios"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import {
  LayoutGrid, Calendar, Users, Settings,
  Bell, Smartphone, X, Download, ShieldCheck, FileText, User, LogOut
} from "lucide-react"

const MotionDiv = motion.div

const Layout = () => {
  const { user, loading, token, logout } = useAuth()
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const location = useLocation()

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [showFloatingButton, setShowFloatingButton] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Notification center state
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])

  // Fetch real notifications based on role
  useEffect(() => {
    if (!token || !user) return;

    const fetchNotifications = async () => {
      try {
        if (user.role === "ADMIN") {
          const leavesRes = await api.get('/leaves?status=PENDING');
          const leaves = leavesRes.data.data.items || [];

          const list = [];
          leaves.forEach((l, idx) => {
            list.push({
              id: `leave-${l._id}-${idx}`,
              title: "Pending Leave Request",
              desc: `${l.employee?.name || 'Employee'} requested leave starting ${new Date(l.startDate).toLocaleDateString()}`,
              time: "Action required"
            });
          });

          if (list.length === 0) {
            list.push({
              id: 'empty',
              title: "All Caught Up!",
              desc: "No pending leave approvals.",
              time: "Now"
            });
          }
          setNotifications(list);
        } else {
          // Employee
          const leavesRes = await api.get('/leaves?limit=5');
          const leaves = leavesRes.data.data.items || [];

          const list = [];
          leaves.forEach((l, idx) => {
            list.push({
              id: `leave-${l._id}-${idx}`,
              title: `Leave: ${l.status}`,
              desc: `Your leave request for ${new Date(l.startDate).toLocaleDateString()} is ${l.status.toLowerCase()}.`,
              time: new Date(l.updatedAt || l.createdAt).toLocaleDateString()
            });
          });

          if (list.length === 0) {
            list.push({
              id: 'empty',
              title: "Welcome to KODEWAR",
              desc: "No recent leave alerts.",
              time: "Now"
            });
          }
          setNotifications(list);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [token, user]);

  useEffect(() => {
    const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi|Tablet/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(navigator.userAgent));
    setIsMobile(mobileCheck)

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      window.deferredPWAInstallPrompt = e
      setShowFloatingButton(true)
      window.dispatchEvent(new CustomEvent('pwa:installable'))
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      window.deferredPWAInstallPrompt = null
      setShowFloatingButton(false)
      setShowInstallPrompt(false)
      window.dispatchEvent(new CustomEvent('pwa:installed'))
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (isStandalone) {
      setShowFloatingButton(false)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    const promptEvent = deferredPrompt || window.deferredPWAInstallPrompt
    if (!promptEvent) return
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === "accepted") {
      setDeferredPrompt(null)
      window.deferredPWAInstallPrompt = null
      setShowFloatingButton(false)
      window.dispatchEvent(new CustomEvent('pwa:installed'))
    }
    setShowInstallPrompt(false)
  }

  const handleDismissPrompt = () => {
    localStorage.setItem("pwaDismissed", "true")
    setShowInstallPrompt(false)
  }

  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" />

  if ((user.mustChangePassword || user.forcePasswordChange) && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />
  }

  const role = user?.role
  const mobileNavItems = [
    ...(role === "ADMIN"
      ? [
          { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
          { name: "Attendance", href: "/admin-attendance", icon: Calendar },
          { name: "Employees", href: "/employees", icon: Users },
          { name: "Settings", href: "/settings", icon: Settings }
        ]
      : [
          { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
          { name: "Attendance", href: "/attendance", icon: Calendar },
          { name: "Leave", href: "/leave", icon: FileText },
          { name: "Settings", href: "/settings", icon: Settings }
        ]
    )
  ]

  return (
    <EmployeeTrackingProvider enabled={role === 'EMPLOYEE'}>
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Universal Top Navbar */}
        <header className={`${role === "EMPLOYEE" ? "hidden lg:flex" : "flex"} h-16 border-b border-slate-200/60 bg-white/70 backdrop-blur-md items-center justify-between px-6 z-20 sticky top-0 shrink-0`}>
          <div className="flex items-center gap-4 flex-1">
            <span className="text-base font-bold text-slate-800">KODEWAR Workforce</span>
          </div>

          {/* Top Actions Right Side */}
          <div className="flex items-center gap-3">
            {showFloatingButton && (
              <button
                onClick={handleInstallApp}
                className="hidden md:flex items-center gap-1.5 btn-secondary text-xs py-1.5 px-3 border-[#2EA8FF]/20 hover:bg-[#2EA8FF]/10 text-[#2EA8FF] font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                Install App
              </button>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 text-slate-600 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-200/50 relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
              </button>

              {/* Notifications Dropdown Panel */}
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 z-40"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                        <h4 className="font-bold text-slate-800 text-sm">Notifications</h4>
                        <button className="text-[11px] font-bold text-[#2EA8FF] hover:text-[#1F7AE0]">Mark all read</button>
                      </div>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {notifications.map((n) => (
                          <div key={n.id} className="text-xs p-2 hover:bg-slate-50 rounded-xl transition-colors text-left">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-semibold text-slate-800">{n.title}</span>
                              <span className="text-[9px] text-slate-400 font-mono">{n.time}</span>
                            </div>
                            <p className="text-slate-500 mt-0.5 leading-relaxed">{n.desc}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile Summary */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 pl-2 border-l border-slate-200/60 focus:outline-none hover:opacity-80 transition-opacity cursor-pointer text-left"
                aria-haspopup="true"
                aria-expanded={showUserDropdown}
              >
                <Avatar user={user} size="w-8 h-8" rounded="rounded-lg" className="border border-slate-200 shadow-xs" fallbackClassName="bg-slate-800 text-white text-xs" />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-800 leading-none">{user.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                    {role === "ADMIN" ? "Admin" : "Employee"}
                  </p>
                </div>
              </button>

              <AnimatePresence>
                {showUserDropdown && (
                  <>
                    <div className="fixed inset-0 z-30 animate-none" onClick={() => setShowUserDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 z-40"
                    >
                      <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 mb-1">
                        <Avatar user={user} size="h-10 w-10" className="border border-[#2EA8FF]/30" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">{user.name}</p>
                          <p className="text-[10px] text-slate-500">{role === "ADMIN" ? "Admin" : "Employee"}</p>
                        </div>
                      </div>
                      <Link
                        to="/settings"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors"
                      >
                        <User className="w-4 h-4 text-[#2EA8FF]" />
                        My Profile
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        Settings
                      </Link>
                      <hr className="my-1 border-slate-100" />
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        Logout
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {role === "EMPLOYEE" && (
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
            <Link to="/dashboard" className="flex min-h-12 items-center gap-2" aria-label="KODEWAR dashboard">
              <span className="text-sm font-black tracking-tight text-[#07152E]">KODEWAR</span>
            </Link>
            <div className="flex items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications((value) => !value)}
                  className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-slate-600 active:bg-slate-100"
                  aria-label="Open notifications"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                </button>
                <AnimatePresence>
                  {showNotifications && (
                    <>
                      <button type="button" className="fixed inset-0 top-16 z-30 cursor-default" onClick={() => setShowNotifications(false)} aria-label="Close notifications" />
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="fixed left-4 right-4 top-[68px] z-40 max-h-[60vh] overflow-y-auto rounded-[20px] border border-slate-200 bg-white p-4 shadow-2xl"
                      >
                        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-3">
                          <h2 className="text-sm font-extrabold text-slate-900">Notifications</h2>
                          <button type="button" onClick={() => setShowNotifications(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500" aria-label="Close notifications"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-1">
                          {notifications.map((notification) => (
                            <div key={notification.id} className="rounded-2xl p-3 text-left active:bg-slate-50">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-bold text-slate-800">{notification.title}</p>
                                <span className="shrink-0 text-[10px] text-slate-400">{notification.time}</span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{notification.desc}</p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex h-12 w-12 items-center justify-center focus:outline-none hover:opacity-80 transition-opacity cursor-pointer"
                  aria-label="Open user menu"
                  aria-haspopup="true"
                  aria-expanded={showUserDropdown}
                >
                  <Avatar user={user} size="h-10 w-10" rounded="rounded-2xl" fallbackClassName="bg-[#07152E] text-white text-sm" />
                </button>

                <AnimatePresence>
                  {showUserDropdown && (
                    <>
                      <div className="fixed inset-0 z-30 animate-none" onClick={() => setShowUserDropdown(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 z-[45]"
                      >
                        <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 mb-1">
                        <Avatar user={user} size="h-10 w-10" className="border border-[#2EA8FF]/30" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">{user.name}</p>
                          <p className="text-[10px] text-slate-500">{role === "ADMIN" ? "Admin" : "Employee"}</p>
                        </div>
                      </div>
                      <Link
                          to="/settings"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors"
                        >
                          <User className="w-4 h-4 text-[#2EA8FF]" />
                          My Profile
                        </Link>
                        <Link
                          to="/settings"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors"
                        >
                          <Settings className="w-4 h-4 text-slate-400" />
                          Settings
                        </Link>
                        <hr className="my-1 border-slate-100" />
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-rose-500" />
                          Logout
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>
        )}

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto relative pb-20 lg:pb-0">
          <MotionDiv
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto"
          >
            <Outlet />
          </MotionDiv>
        </main>
      </div>

      <nav aria-label="Mobile navigation" className="h-[calc(64px+env(safe-area-inset-bottom))] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden fixed bottom-0 left-0 right-0 border-t border-slate-200/60 flex items-center justify-around px-2 z-35 shadow-xl">
        {mobileNavItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              to={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center py-1 font-medium transition-colors text-[10px] ${
                isActive ? "text-[#2EA8FF] font-bold" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <item.icon className={`${role === "EMPLOYEE" ? "h-[22px] w-[22px]" : "h-5 w-5"} mb-0.5 ${isActive ? "text-[#2EA8FF]" : "text-slate-400"}`} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* PWA Floating Install Button (Mobile Only) */}
      {showFloatingButton && isMobile && role !== "EMPLOYEE" && (
        <button
          onClick={handleInstallApp}
          className="fixed bottom-20 right-4 z-40 p-3 bg-[#2EA8FF] hover:bg-[#1F7AE0] text-white rounded-full shadow-2xl flex items-center justify-center ring-4 ring-[#2EA8FF]/10"
        >
          <Download className="w-5 h-5" />
        </button>
      )}

      {/* Mobile Slide-Up Install App Prompt Overlay */}
      <AnimatePresence>
        {showInstallPrompt && (
          <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-45" onClick={handleDismissPrompt} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 bg-[#071426]/90 backdrop-blur-xl border-t border-white/10 rounded-t-3xl p-6 z-50 shadow-2xl flex flex-col space-y-5 text-white"
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="p-3 bg-[#2EA8FF]/10 text-[#2EA8FF] rounded-2xl"><Smartphone className="w-6 h-6" /></div>
                  <div>
                    <h3 className="font-bold text-white text-base">Install KODEWAR</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Add to your home screen for native access.</p>
                  </div>
                </div>
                <button onClick={handleDismissPrompt} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
                  <span>Faster Login & Dashboard Loads</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
                  <span>Better GPS & Geolocation Access</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleDismissPrompt} className="btn-secondary py-3 text-sm font-semibold">
                  Not Now
                </button>
                <button onClick={handleInstallApp} className="btn-primary py-3 text-sm font-semibold rounded-xl">
                  Install App
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </EmployeeTrackingProvider>
  )
}

export default Layout
