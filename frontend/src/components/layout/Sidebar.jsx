import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Camera,
  History,
  Calendar,
  BarChart3,
  UserX,
  Settings,
  ShieldCheck,
  Sparkles,
  Briefcase,
  Smartphone,
} from 'lucide-react';
import { useWebSocket } from '../../context/WebSocketContext';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/employees', label: 'Employees', icon: Users },
  { path: '/live', label: 'Live Attendance', icon: Camera, badge: 'Live' },
  { path: '/history', label: 'Attendance History', icon: History },
  { path: '/leaves', label: 'Leaves & Approvals', icon: Briefcase },
  { path: '/calendar', label: 'Calendar', icon: Calendar },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/unknown', label: 'Unknown Detections', icon: UserX },
  { path: '/settings', label: 'Settings', icon: Settings },
];


export const Sidebar = () => {
  const { connected } = useWebSocket();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-screen select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900 tracking-tight text-base">SmartFace</span>
            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 tracking-wider">AI</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">Enterprise Attendance</p>
        </div>
      </div>

      {/* Real-time Engine Status Pill */}
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-xs font-semibold text-slate-700">
              {connected ? 'Vision AI Live' : 'Connecting Engine...'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
            WS Active
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Main Menu
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 animate-pulse">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Footer / Employee App Switcher */}
      <div className="p-3.5 border-t border-slate-100 m-3 bg-gradient-to-br from-slate-50 to-blue-50/60 rounded-2xl border border-slate-200/80 space-y-2">
        <NavLink
          to="/app"
          className="flex items-center justify-center gap-2 w-full py-2 bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs rounded-xl border border-blue-200/80 shadow-2xs transition"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Open Employee App</span>
        </NavLink>
        <p className="text-[10px] text-slate-400 text-center leading-tight">
          Staff can view daily logs, punch time & apply for leaves.
        </p>
      </div>
    </aside>
  );
};

