import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Camera,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    year: 'numeric',
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 sticky top-0">
      {/* Left: Quick status & shortcuts */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/live')}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition border border-blue-200/60 shadow-xs cursor-pointer"
        >
          <Camera className="w-4 h-4 text-blue-600" />
          <span>Launch Camera Feed</span>
        </button>
      </div>

      {/* Center: Live Clock */}
      <div className="hidden md:flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-100/80 border border-slate-200 text-slate-700 shadow-2xs">
        <Clock className="w-4 h-4 text-blue-600 animate-spin-slow" />
        <span className="font-mono text-xs font-bold tracking-tight text-slate-900">{formattedTime}</span>
        <span className="text-slate-300 font-light">|</span>
        <span className="text-xs font-medium text-slate-600">{formattedDate}</span>
      </div>

      {/* Right: Admin Profile & Logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 pl-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            {user?.name ? user.name[0].toUpperCase() : 'A'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-slate-800 leading-none">{user?.name || 'Administrator'}</div>
            <div className="text-[10px] text-blue-600 font-medium leading-tight mt-0.5">{user?.role || 'Super Admin'}</div>
          </div>
        </div>

        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition ml-1 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
