import { Navigate, Outlet, useLocation, Link } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import Avatar from "../components/Avatar"
import { useAuth } from "../context/AuthContext"
import { EmployeeTrackingProvider } from '../context/EmployeeTrackingContext'
import DashboardLoader from "../components/DashboardLoader"
import api from "../api/axios"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import {
  LayoutGrid, Calendar, Settings, MessageSquare,
  Bell, Smartphone, X, Download, ShieldCheck, FileText, User, LogOut,
  MoreHorizontal, Share2
} from "lucide-react"

const MotionDiv = motion.div

const Layout = () => {
  const { user, loading, token, logout } = useAuth()
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const location = useLocation()

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Notification center state
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])

  // Fetch notifications
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
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi|Tablet/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(navigator.userAgent));
    setIsMobile(mobileCheck)

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      window.deferredPWAInstallPrompt = e

      const isDismissed = localStorage.getItem("pwaDismissed") === "true";
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

      if (!isDismissed && !isStandalone) {
        setShowInstallPrompt(true);
      }
      window.dispatchEvent(new CustomEvent('pwa:installable'))
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      window.deferredPWAInstallPrompt = null
      setShowInstallPrompt(false)
      window.dispatchEvent(new CustomEvent('pwa:installed'))
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    const promptEvent = deferredPrompt || window.deferredPWAInstallPrompt
    if (!promptEvent) {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isIOS) {
        setShowIosGuide(true);
      }
      return;
    }
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === "accepted") {
      setDeferredPrompt(null)
      window.deferredPWAInstallPrompt = null
      setShowInstallPrompt(false)
      window.dispatchEvent(new CustomEvent('pwa:installed'))
    }
    setShowInstallPrompt(false)
  }

  const handleDismissPrompt = () => {
    localStorage.setItem("pwaDismissed", "true")
    setShowInstallPrompt(false)
  }

  if (loading) return <DashboardLoader />
  if (!user) return <Navigate to="/login" />

  if ((user.mustChangePassword || user.forcePasswordChange) && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />
  }

  const role = user?.role

  // Mobile Bottom Bar Primary Destinations (Home, Attendance, Leave, More)
  const mobileNavDestinations = [
    { name: "Home", href: "/dashboard", icon: LayoutGrid },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Attendance", href: role === "ADMIN" ? "/admin-attendance" : "/attendance", icon: Calendar },
    { name: "Leave", href: "/leave", icon: FileText },
  ]

  return (
    <EmployeeTrackingProvider enabled={role === 'EMPLOYEE'}>
    <div className="flex h-screen bg-[#F5F5F5] overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 border-b border-neutral-200 bg-white/80 backdrop-blur-md items-center justify-between px-6 z-20 sticky top-0 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <span className="text-base font-black tracking-tight text-black">KODEWAR Workforce</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all border border-transparent hover:border-neutral-200 relative cursor-pointer"
              >
                <Bell className="w-5 h-5 text-black" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-black ring-2 ring-white" />
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2.5 w-80 bg-white border border-neutral-200 shadow-2xl rounded-2xl p-4 z-40"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-2">
                        <h4 className="font-bold text-black text-sm">Notifications</h4>
                        <button className="text-[11px] font-bold text-neutral-900 underline hover:text-black">Mark all read</button>
                      </div>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {notifications.map((n) => (
                          <div key={n.id} className="text-xs p-2.5 hover:bg-neutral-50 rounded-xl transition-colors text-left border border-transparent hover:border-neutral-200">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-bold text-neutral-900">{n.title}</span>
                              <span className="text-[9px] text-neutral-500 font-mono">{n.time}</span>
                            </div>
                            <p className="text-neutral-600 mt-0.5 leading-relaxed">{n.desc}</p>
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
                className="flex items-center gap-2 pl-2 border-l border-neutral-200 focus:outline-none hover:opacity-80 transition-opacity cursor-pointer text-left"
              >
                <Avatar user={user} size="w-8 h-8" rounded="rounded-lg" className="border border-neutral-300 shadow-xs" fallbackClassName="bg-neutral-900 text-white text-xs" />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-black leading-none">{user.name}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5 leading-none">
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
                      className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 shadow-2xl rounded-2xl p-2 z-40"
                    >
                      <div className="flex items-center gap-3 px-3 py-2 border-b border-neutral-200 mb-1">
                        <Avatar user={user} size="h-10 w-10" className="border border-neutral-300" fallbackClassName="bg-neutral-900 text-white text-sm" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-black">{user.name}</p>
                          <p className="text-[10px] text-neutral-500">{role === "ADMIN" ? "Admin" : "Employee"}</p>
                        </div>
                      </div>
                      <Link
                        to="/settings"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-100 hover:text-black rounded-xl transition-colors"
                      >
                        <User className="w-4 h-4 text-black" />
                        My Profile
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-100 hover:text-black rounded-xl transition-colors"
                      >
                        <Settings className="w-4 h-4 text-neutral-500" />
                        Settings
                      </Link>
                      <hr className="my-1 border-neutral-200" />
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-neutral-700" />
                        Logout
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Mobile Header (Compact & Clean) */}
        <header className="flex lg:hidden sticky top-0 z-30 h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white/95 backdrop-blur-md px-4">
          <Link to="/dashboard" className="flex items-center gap-2" aria-label="KODEWAR Home">
            <span className="text-sm font-black tracking-widest text-black uppercase">KODEWAR</span>
          </Link>

          <div className="flex items-center gap-1">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-neutral-700 active:bg-neutral-100"
                aria-label="Open notifications"
              >
                <Bell className="h-5 w-5 text-black" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-black ring-2 ring-white" />
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <button type="button" className="fixed inset-0 top-14 z-30 cursor-default" onClick={() => setShowNotifications(false)} aria-label="Close notifications" />
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="fixed left-4 right-4 top-16 z-40 max-h-[60vh] overflow-y-auto rounded-[20px] border border-neutral-200 bg-white p-4 shadow-2xl"
                    >
                      <div className="mb-2 flex items-center justify-between border-b border-neutral-200 pb-3">
                        <h2 className="text-sm font-extrabold text-black">Notifications</h2>
                        <button type="button" onClick={() => setShowNotifications(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="space-y-1">
                        {notifications.map((notification) => (
                          <div key={notification.id} className="rounded-2xl p-3 text-left active:bg-neutral-50 border border-transparent hover:border-neutral-200">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-bold text-black">{notification.title}</p>
                              <span className="shrink-0 text-[10px] text-neutral-500">{notification.time}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-neutral-600">{notification.desc}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Avatar Trigger */}
            <Link
              to="/settings"
              className="flex h-10 w-10 items-center justify-center focus:outline-none hover:opacity-80 transition-opacity cursor-pointer ml-1"
              aria-label="Profile and Settings"
            >
              <Avatar user={user} size="h-8 w-8" rounded="rounded-xl" fallbackClassName="bg-black text-white text-xs" />
            </Link>
          </div>
        </header>

        {/* Main Content Container */}
        <main className="flex-1 overflow-y-auto relative pb-24 lg:pb-0">
          <MotionDiv
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto"
          >
            <Outlet />
          </MotionDiv>
        </main>
      </div>

      {/* Fixed Mobile Bottom Navigation Bar ([ Home ] [ Attendance ] [ Leave ] [ More ]) */}
      <nav aria-label="Mobile bottom navigation" className="h-[calc(60px+env(safe-area-inset-bottom))] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden fixed bottom-0 left-0 right-0 border-t border-neutral-200 flex items-center justify-around px-2 z-40 shadow-xl">
        {mobileNavDestinations.map((item) => {
          const isActive = location.pathname === item.href || (item.href !== "/dashboard" && location.pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              to={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center py-1 font-bold transition-colors text-[10px] ${
                isActive ? "text-black font-extrabold" : "text-neutral-500 hover:text-black"
              }`}
            >
              <item.icon className={`h-5 w-5 mb-0.5 ${isActive ? "text-black stroke-[2.5]" : "text-neutral-500"}`} />
              <span>{item.name}</span>
            </Link>
          )
        })}

        {/* More Tab Button */}
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          type="button"
          className={`flex min-h-12 flex-1 flex-col items-center justify-center py-1 font-bold transition-colors text-[10px] cursor-pointer ${
            showMoreMenu || location.pathname === "/announcements" || location.pathname === "/settings"
              ? "text-black font-extrabold"
              : "text-neutral-500 hover:text-black"
          }`}
        >
          <MoreHorizontal className={`h-5 w-5 mb-0.5 ${showMoreMenu || location.pathname === "/announcements" || location.pathname === "/settings" ? "text-black stroke-[2.5]" : "text-neutral-500"}`} />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Sheet Drawer */}
      <AnimatePresence>
        {showMoreMenu && (
          <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-45 lg:hidden" onClick={() => setShowMoreMenu(false)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-[calc(60px+env(safe-area-inset-bottom))] left-0 right-0 bg-white border-t border-neutral-200 rounded-t-3xl p-5 z-50 shadow-2xl flex flex-col space-y-2 lg:hidden text-black"
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-500">More Destinations</span>
                <button onClick={() => setShowMoreMenu(false)} className="p-1 text-neutral-400 hover:text-black cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {role === "ADMIN" && (
                <>
                  <Link
                    to="/employees"
                    onClick={() => setShowMoreMenu(false)}
                    className="flex items-center gap-3 p-3 font-bold text-xs text-black hover:bg-neutral-100 rounded-xl transition-colors"
                  >
                    <User className="w-4.5 h-4.5 text-black" />
                    <span>Employees</span>
                  </Link>
                  <Link
                    to="/teams"
                    onClick={() => setShowMoreMenu(false)}
                    className="flex items-center gap-3 p-3 font-bold text-xs text-black hover:bg-neutral-100 rounded-xl transition-colors"
                  >
                    <User className="w-4.5 h-4.5 text-black" />
                    <span>Teams</span>
                  </Link>
                </>
              )}

              <Link
                to="/announcements"
                onClick={() => setShowMoreMenu(false)}
                className="flex items-center gap-3 p-3 font-bold text-xs text-black hover:bg-neutral-100 rounded-xl transition-colors"
              >
                <Bell className="w-4.5 h-4.5 text-black" />
                <span>Announcements</span>
              </Link>

              <Link
                to="/settings"
                onClick={() => setShowMoreMenu(false)}
                className="flex items-center gap-3 p-3 font-bold text-xs text-black hover:bg-neutral-100 rounded-xl transition-colors"
              >
                <Settings className="w-4.5 h-4.5 text-black" />
                <span>Profile & Settings</span>
              </Link>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  logout();
                }}
                className="flex items-center gap-3 p-3 font-bold text-xs text-black hover:bg-neutral-100 rounded-xl transition-colors w-full text-left cursor-pointer"
              >
                <LogOut className="w-4.5 h-4.5 text-black" />
                <span>Logout</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* PWA Mobile Install Banner */}
      <AnimatePresence>
        {showInstallPrompt && isMobile && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed bottom-[calc(70px+env(safe-area-inset-bottom))] left-4 right-4 bg-black text-white border border-neutral-800 rounded-2xl p-4 z-50 shadow-2xl flex flex-col space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl shrink-0">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">Install KODEWAR</h4>
                  <p className="text-xs text-neutral-400 mt-0.5">Get faster access to attendance, leave and announcements.</p>
                </div>
              </div>
              <button onClick={handleDismissPrompt} className="p-1 text-neutral-500 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleInstallApp}
                className="flex-1 bg-white text-black font-extrabold py-2 text-xs rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Install App
              </button>
              <button
                onClick={handleDismissPrompt}
                className="px-4 bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold py-2 text-xs rounded-xl hover:text-white transition-colors cursor-pointer"
              >
                Later
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Safari Installation Instructions Sheet */}
      <AnimatePresence>
        {showIosGuide && (
          <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50" onClick={() => setShowIosGuide(false)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 bg-black text-white border-t border-neutral-800 rounded-t-3xl p-6 z-55 shadow-2xl flex flex-col space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <h3 className="font-extrabold text-base text-white">Install KODEWAR on iOS</h3>
                <button onClick={() => setShowIosGuide(false)} className="p-1 text-neutral-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-neutral-300">To install KODEWAR on your iPhone or iPad:</p>
              <div className="space-y-2 bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-xs">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-white shrink-0" />
                  <span>1. Tap the <strong>Share</strong> button in Safari toolbar.</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Download className="w-4 h-4 text-white shrink-0" />
                  <span>2. Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                </div>
              </div>
              <button onClick={() => setShowIosGuide(false)} className="btn-primary py-2.5 text-xs font-bold rounded-xl w-full cursor-pointer">
                Got it
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
    </EmployeeTrackingProvider>
  )
}

export default Layout
