import { useState, useEffect } from 'react'
import {Link, useLocation} from 'react-router-dom'
import {
  BellIcon, CalendarIcon, 
  UsersRoundIcon, 
  ChevronRightIcon, ChevronLeftIcon, 
  FileTextIcon, LayoutGridIcon, Loader2, LogOutIcon, 
  MenuIcon, SettingsIcon, UserIcon, XIcon
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { employeeName } from '../api/helpers'
import { motion } from 'framer-motion'
import Avatar from './Avatar'

const MotionAside = motion.aside

const Sidebar = () => {
    const { pathname } = useLocation()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('sidebar-collapsed') === 'true'
    })

    const {user, loading, logout} = useAuth()

    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = 'hidden';
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    setMobileOpen(false);
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => {
                document.body.style.overflow = '';
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [mobileOpen]);

    const role = user?.role;
    const userName = employeeName(user);

    const employeeNavigation = [
        {name: "Dashboard", href: "/dashboard", icon: LayoutGridIcon},
        {name: "Attendance", href: "/attendance", icon: CalendarIcon},
        {name: "Leave", href: "/leave", icon: FileTextIcon},
        {name: "Announcements", href: "/announcements", icon: BellIcon},
        {name: "Profile & Settings", href: "/settings", icon: SettingsIcon},
    ]

    const adminNavigation = [
        {name: "Dashboard", href: "/dashboard", icon: LayoutGridIcon},
        {name: "Attendance", href: "/admin-attendance", icon: CalendarIcon},
        {name: "Leave Requests", href: "/leave", icon: FileTextIcon},
        {name: "Employees", href: "/employees", icon: UserIcon},
        {name: "Teams", href: "/teams", icon: UsersRoundIcon},
        {name: "Announcements", href: "/announcements", icon: BellIcon},
        {name: "Settings", href: "/settings", icon: SettingsIcon},
    ]

    const navItems = role === "ADMIN" ? adminNavigation : employeeNavigation

    const handleLogout = ()=>{
        logout()
    }

    const toggleCollapse = () => {
        const nextState = !isCollapsed
        setIsCollapsed(nextState)
        localStorage.setItem('sidebar-collapsed', String(nextState))
    }

    const sidebarContent = (isMobileView = false) => {
        const showCollapsed = isCollapsed && !isMobileView
        return (
            <div className="flex flex-col h-full select-none overflow-hidden">
                {/* Brand header */}
                <div className="pt-6 pb-5 border-b border-white/6 flex items-center justify-center relative shrink-0">
                    <div className={`flex items-center ${showCollapsed ? 'justify-center' : 'justify-between w-full px-5'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                            <p className={`font-extrabold text-sm text-white tracking-wider uppercase transition-all duration-300 overflow-hidden whitespace-nowrap ${showCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100'}`}>KODEWAR</p>
                        </div>
                        {isMobileView && (
                            <button onClick={()=>setMobileOpen(false)} className='lg:hidden text-slate-400 hover:text-white p-1 cursor-pointer shrink-0'>
                                <XIcon size={20}/>
                            </button>
                        )}
                    </div>
                </div>

                {/* User profile card */}
                {userName && (
                    <div className={`transition-all duration-300 ${showCollapsed ? 'mx-0 px-0 bg-transparent border-transparent shadow-none mt-6' : 'mx-3 p-3 bg-white/5 border border-white/10 shadow-lg mt-4'} rounded-2xl shrink-0`}>
                        <div className={`flex items-center ${showCollapsed ? 'justify-center' : 'gap-3'}`}>
                            <div className='w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center ring-1 ring-white/15 shrink-0 overflow-hidden' title={showCollapsed ? `${userName} (${role === "ADMIN" ? "Administrator" : "Employee"})` : undefined}>
                                <Avatar user={user} name={userName} size="w-9 h-9" className="ring-1 ring-white/15" fallbackClassName="bg-slate-800 text-[#37B6FF] text-xs" />
                            </div>
                            <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap flex flex-col ${showCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 flex-1 min-w-0'}`}>
                                <p className='text-[13px] font-semibold text-slate-200 truncate'>{userName}</p>
                                <p className='text-[11px] text-slate-400 font-medium truncate'>{role === "ADMIN" ? "Administrator" : "Employee"}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Section label */}
                <div className={`transition-all duration-300 ${showCollapsed ? 'px-3 pt-6 pb-2 text-center' : 'px-5 pt-5 pb-2'} shrink-0`}>
                    {showCollapsed ? (
                        <div className="h-[1px] bg-white/10 mx-auto w-6" />
                    ) : (
                        <p className='text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 overflow-hidden whitespace-nowrap transition-all duration-300'>Navigation</p>
                    )}
                </div>

                {/* Navigation List */}
                <div className='flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden mt-2'>
                    {loading ? (
                        <div className='px-3 py-3 flex items-center gap-2 text-slate-500'>
                            <Loader2 className="animate-spin w-4 h-4 shrink-0" />
                            {!showCollapsed && <span className="text-sm">Loading...</span>}
                        </div>
                    ) : (
                        navItems.map((item)=>{
                        const isActive = pathname.startsWith(item.href)
                        return (
                            <Link 
                                onClick={()=> setMobileOpen(false)} 
                                key={item.name} 
                                to={item.href} 
                                className={`group flex items-center rounded-xl text-[13px] font-semibold transition-all duration-200 relative ${
                                    showCollapsed 
                                        ? 'justify-center p-2.5 mx-0' 
                                        : `px-3 py-2.5 border-l-4 ${isActive ? 'border-[#2EA8FF]' : 'border-transparent'}`
                                } ${
                                    isActive 
                                        ? "bg-[rgba(46,168,255,0.12)] text-[#2EA8FF] shadow-[0_0_12px_rgba(46,168,255,0.15)]" 
                                        : "text-slate-300 hover:text-white hover:bg-[rgba(46,168,255,0.12)]"
                                }`}
                            >
                                <item.icon className={`w-[17px] h-[17px] shrink-0 transition-transform group-hover:scale-105 ${isActive ? "text-[#2EA8FF]" : "text-slate-400 group-hover:text-slate-300"}`}/>
                                <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${showCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100 ml-3'}`}>
                                    {item.name}
                                </span>
                                {!showCollapsed && isActive && <ChevronRightIcon className="w-3.5 h-3.5 text-[#2EA8FF]/70 animate-pulse ml-auto shrink-0"/>}

                                {showCollapsed && (
                                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#07152E] border border-white/10 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
                                        {item.name}
                                    </div>
                                )}
                            </Link>
                        )
                    })
                    )}
                </div>

                {/* Logout */}
                <div className="p-3 border-t border-white/6 mt-auto shrink-0">
                    <button onClick={handleLogout} className={`flex items-center rounded-xl text-[13px] font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/8 transition-all duration-150 relative group cursor-pointer ${
                        showCollapsed ? 'justify-center p-2.5 mx-0' : 'w-full px-3 py-2.5 border-l-4 border-transparent'
                    }`}>
                        <LogOutIcon className="w-[17px] h-[17px] shrink-0"/>
                        <span className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${showCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100 ml-3'}`}>Log out</span>
                        {showCollapsed && (
                            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#07152E] border border-white/10 text-white text-xs font-semibold rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
                                Log out
                            </div>
                        )}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <>
            <button onClick={()=>setMobileOpen(true)} className='lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#07152E] text-white rounded-lg shadow-lg border border-white/10 cursor-pointer'>
                <MenuIcon size={20}/>
            </button>

            {mobileOpen && <div className='lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40' onClick={()=>setMobileOpen(false)}/>}

            <aside className={`hidden lg:flex flex-col h-full bg-[#07152E] text-white shrink-0 border-r border-white/5 shadow-[18px_0_55px_rgba(15,23,42,0.04)] transition-all duration-300 ease-in-out relative ${isCollapsed ? 'w-20' : 'w-68'}`}>
                <button 
                    onClick={toggleCollapse} 
                    className="absolute -right-3 top-6 z-50 w-6 h-6 rounded-full bg-[#07152E] border border-white/10 text-[#2EA8FF] hover:text-white hover:bg-[#2EA8FF] flex items-center justify-center shadow-md cursor-pointer transition-all duration-200 hover:scale-105"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? <ChevronRightIcon size={12}/> : <ChevronLeftIcon size={12}/>}
                </button>
                {sidebarContent(false)}
            </aside>

            <MotionAside
              initial={false}
              animate={{ x: mobileOpen ? 0 : "-100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className='lg:hidden fixed inset-y-0 left-0 w-72 bg-[#07152E] text-white z-50 flex flex-col shadow-2xl'
            >
                {sidebarContent(true)}
            </MotionAside>
        </>
    )
}

export default Sidebar
