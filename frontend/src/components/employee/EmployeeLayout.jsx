import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home,
  Calendar,
  Clock,
  Briefcase,
  Layers,
  User,
  LogOut,
  Bell,
  Megaphone,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Sun,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { portalApi } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';

export const EmployeeLayout = () => {
  const { user, logout } = useAuth();
  const { latestPunch } = useWebSocket();
  const navigate = useNavigate();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [liveToast, setLiveToast] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const fetchNotifsAndAnnouncements = async () => {
    try {
      const [nRes, aRes] = await Promise.all([
        portalApi.getNotifications(),
        portalApi.getAnnouncements(),
      ]);
      setNotifications(nRes.data);
      setUnreadCount(nRes.data.filter((n) => !n.read).length);
      setAnnouncements(aRes.data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifsAndAnnouncements();
  }, []);

  // Listen to WebSocket punch events for this employee
  useEffect(() => {
    if (latestPunch && user?.employeeId && latestPunch.employeeId === user.employeeId) {
      setLiveToast({
        title: latestPunch.eventTriggered === 'IN' ? '✅ Checked In Successfully' : '👋 Checked Out Successfully',
        message: latestPunch.message || `Attendance punch recorded at ${latestPunch.time || 'now'}.`,
      });
      fetchNotifsAndAnnouncements();
      setTimeout(() => setLiveToast(null), 5000);
    }
  }, [latestPunch, user]);

  const handleMarkNotifsRead = async () => {
    try {
      await portalApi.markNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      // ignore
    }
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      alert(
        'To install this app on your mobile or PC:\n1. On Chrome/Edge: Click the install icon in the URL address bar.\n2. On Mobile (Android/iOS): Tap "Add to Home screen" in browser menu.'
      );
    }
  };

  const navItems = [
    { to: '/app', label: 'Home', icon: Home, end: true },
    { to: '/app/attendance', label: 'Records', icon: Clock },
    { to: '/app/calendar', label: 'Calendar', icon: Calendar },
    { to: '/app/leaves', label: 'Leaves', icon: Briefcase },
    { to: '/app/profile', label: 'Profile', icon: User },
  ];

  const secondaryNavItems = [
    { to: '/app/today', label: "Today's Punch", icon: Clock },
    { to: '/app/regularize', label: 'Missed Punch Correction', icon: Layers },
    { to: '/app/shift', label: 'My Shift Timings', icon: Sun },
    { to: '/app/holidays', label: 'Company Holidays', icon: CalendarDays },
  ];

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 pb-20 md:pb-0">
      {/* Live Toast Alert on WebSocket Event */}
      {liveToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-white rounded-2xl p-4 shadow-2xl border-2 border-emerald-500 animate-scale-up flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-xs text-slate-900">{liveToast.title}</div>
            <div className="text-[11px] text-slate-600 mt-0.5">{liveToast.message}</div>
          </div>
          <button onClick={() => setLiveToast(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight flex items-center gap-1.5">
              <span>SmartFace</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200/50">
                Staff Portal
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Employee Attendance & Self-Service</p>
          </div>
        </div>

        {/* Center: Live Clock */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100/90 border border-slate-200 text-xs text-slate-700">
          <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin-slow" />
          <span className="font-mono font-bold text-slate-900">{formattedTime}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-medium">{formattedDate}</span>
        </div>

        {/* Right: Actions, Notifications & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Announcements Button */}
          <button
            onClick={() => setShowAnnouncements(true)}
            title="Company Announcements"
            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition relative cursor-pointer"
          >
            <Megaphone className="w-4 h-4" />
          </button>

          {/* Notifications Button with Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifs(!showNotifs);
                if (!showNotifs && unreadCount > 0) handleMarkNotifsRead();
              }}
              title="Notifications"
              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
              )}
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full" />
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-scale-up">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                  <h4 className="text-xs font-bold text-slate-900">Notifications</h4>
                  <button
                    onClick={handleMarkNotifsRead}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-center py-6 text-slate-400 text-xs">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl text-xs border ${
                          n.read ? 'bg-slate-50 border-slate-100' : 'bg-blue-50/70 border-blue-200/70 font-semibold'
                        }`}
                      >
                        <div className="font-bold text-slate-900">{n.title}</div>
                        <div className="text-[11px] text-slate-600 mt-0.5">{n.message}</div>
                        <div className="text-[9px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleTimeString()}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <img
              src={user?.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Staff')}&background=2563EB&color=fff`}
              alt={user?.name}
              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shadow-2xs"
            />
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-tight">{user?.name || 'Staff'}</div>
              <div className="text-[10px] font-mono text-blue-600 font-semibold">{user?.employeeId || 'EMP'}</div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-4 space-y-1 shrink-0 min-h-[calc(100vh-4rem)]">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Main Features
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <div className="pt-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Self-Service Tools
          </div>
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <div className="mt-auto pt-4 border-t border-slate-100">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100 text-xs">
              <span className="font-bold text-blue-900 block mb-0.5">Real-Time Sync Active</span>
              <span className="text-[10px] text-blue-700 block">
                Camera IN/OUT punches & leave approvals sync instantly to your app.
              </span>
            </div>
          </div>
        </aside>

        {/* Page Content View */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (App-Style) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-40 flex items-center justify-around py-2 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-xl text-[10px] font-bold transition ${
                  isActive ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Announcements Modal */}
      {showAnnouncements && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Company Announcements</h3>
              </div>
              <button onClick={() => setShowAnnouncements(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {announcements.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-xs">No active notices.</p>
              ) : (
                announcements.map((a) => (
                  <div key={a.id} className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-blue-900 text-sm">{a.title}</span>
                      <span className="text-[10px] font-mono text-slate-400">{a.date}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{a.description}</p>
                    <div className="text-[10px] text-blue-600 font-semibold mt-2">Posted by: {a.createdBy || 'HR'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
