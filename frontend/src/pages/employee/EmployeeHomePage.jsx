import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  Sparkles,
  Camera,
  Eye,
  Briefcase,
  ChevronRight,
  TrendingUp,
  Layers,
  MapPin,
  X,
  History,
  Activity,
} from 'lucide-react';
import { portalApi } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';

export const EmployeeHomePage = () => {
  const { user } = useAuth();
  const { latestPunch } = useWebSocket();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await portalApi.getDashboard();
      setDashboardData(res.data);
    } catch (err) {
      console.error('Failed to load employee dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (latestPunch && user?.employeeId && latestPunch.employeeId === user.employeeId) {
      fetchDashboard();
    }
  }, [latestPunch, user]);

  const today = dashboardData?.today;
  const monthSummary = dashboardData?.monthSummary;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      {/* Header Greeting & Profile Bar */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={user?.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Staff')}&background=2563EB&color=fff`}
              alt={user?.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40 shadow-sm shrink-0"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {dashboardData?.greeting || `Good Morning, ${user?.name || 'Staff'} 👋`}
              </h1>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-100 mt-1 font-medium flex-wrap">
                <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded-md text-white">
                  {user?.employeeId}
                </span>
                <span>•</span>
                <span>{user?.department}</span>
                <span>•</span>
                <span>{user?.designation}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => navigate('/app/today')}
              className="px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Today's Detail</span>
            </button>
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* TODAY'S ATTENDANCE CARD */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-2">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Presence</span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">Today's Attendance</h2>
            <p className="text-xs text-slate-500">{today?.formattedDate || 'Today'}</p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                today?.isInside
                  ? 'bg-emerald-100 text-emerald-800'
                  : today?.hasPunched
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  today?.isInside ? 'bg-emerald-500 animate-pulse' : today?.hasPunched ? 'bg-rose-500' : 'bg-slate-400'
                }`}
              />
              {today?.isInside
                ? '🟢 INSIDE OFFICE'
                : today?.hasPunched
                ? '🔴 OUTSIDE OFFICE'
                : '⚪ NOT CHECKED IN'}
            </span>

            {today?.hasPunched && (
              <button
                onClick={() => navigate('/app/today')}
                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200/70 transition cursor-pointer flex items-center gap-1"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{today?.totalSessions || 1} Sessions</span>
              </button>
            )}
          </div>
        </div>

        {/* Timestamps Box */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 my-6">
          {/* First IN Time */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <LogIn className="w-4 h-4 text-emerald-600" />
                <span>First IN</span>
              </span>
              {today?.verificationImage && (
                <button
                  onClick={() => setPreviewImage(today.verificationImage)}
                  title="View Verification Snapshot"
                  className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {today?.firstIn || today?.inTime || '— — : — —'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {today?.lateBy > 0 ? (
                  <span className="text-amber-700 font-bold">Late +{today.lateBy}m</span>
                ) : today?.inTime ? (
                  <span className="text-emerald-700 font-bold">On Time</span>
                ) : (
                  <span>Shift: {today?.expectedIn || '10:30 AM'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Last OUT Time */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <LogOut className="w-4 h-4 text-indigo-600" />
                <span>Last OUT</span>
              </span>
              {today?.outVerificationImage && (
                <button
                  onClick={() => setPreviewImage(today.outVerificationImage)}
                  title="View Exit Snapshot"
                  className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {today?.lastOut || (today?.isInside ? 'Active Inside' : today?.outTime) || '— — : — —'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {today?.earlyExitBy > 0 ? (
                  <span className="text-orange-700 font-bold">Early -{today.earlyExitBy}m</span>
                ) : today?.isInside ? (
                  <span className="text-emerald-700 font-bold">Currently in session</span>
                ) : today?.outTime ? (
                  <span className="text-indigo-700 font-bold">Shift complete</span>
                ) : (
                  <span>Shift: {today?.expectedOut || '06:00 PM'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Working Hours */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Working Hours</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {today?.status || 'PENDING'}
              </span>
            </div>

            <div>
              <div className="text-xl sm:text-2xl font-black text-blue-900 font-mono">
                {today?.workingDuration || today?.totalWorkingHours || '0h 0m'}
              </div>
              <div className="text-[11px] text-blue-700 font-semibold mt-1">
                Sum of inside sessions
              </div>
            </div>
          </div>

          {/* Outside Time */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-amber-600" />
                <span>Outside Time</span>
              </span>
            </div>

            <div>
              <div className="text-xl sm:text-2xl font-black text-amber-950 font-mono">
                {today?.totalOutsideHours || '0h 0m'}
              </div>
              <div className="text-[11px] text-amber-700 font-semibold mt-1">
                Total time outside office
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ATTENDANCE THIS MONTH */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Attendance This Month ({monthSummary?.monthName})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Attendance Percentage: <b className="text-emerald-700">{monthSummary?.attendancePercentage}%</b> • Total Working Hours: <b className="text-blue-700">{monthSummary?.totalWorkingHours}</b>
            </p>
          </div>

          <button
            onClick={() => navigate('/app/calendar')}
            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>View Calendar</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
            <span className="text-xs font-bold text-emerald-800 block">Present</span>
            <span className="text-2xl font-black text-emerald-950 mt-1 block">{monthSummary?.presentDays ?? 0}</span>
            <span className="text-[10px] text-emerald-700 font-semibold">
              {monthSummary?.fullDays ?? 0} Full • {monthSummary?.halfDays ?? 0} Half
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-center">
            <span className="text-xs font-bold text-amber-800 block">Late Arrivals</span>
            <span className="text-2xl font-black text-amber-950 mt-1 block">{monthSummary?.lateDays ?? 0}</span>
            <span className="text-[10px] text-amber-700 font-semibold">Within grace window</span>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 text-center">
            <span className="text-xs font-bold text-purple-800 block">Leaves Taken</span>
            <span className="text-2xl font-black text-purple-950 mt-1 block">{monthSummary?.leaveDays ?? 0}</span>
            <span className="text-[10px] text-purple-700 font-semibold">Approved by Admin</span>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 text-center">
            <span className="text-xs font-bold text-rose-800 block">Absent Days</span>
            <span className="text-2xl font-black text-rose-950 mt-1 block">{monthSummary?.absentDays ?? 0}</span>
            <span className="text-[10px] text-rose-700 font-semibold">No punch logged</span>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS & RECENT ACTIVITY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
          <h3 className="text-base font-extrabold text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/app/leaves')}
              className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition flex flex-col items-center text-center cursor-pointer"
            >
              <Briefcase className="w-6 h-6 mb-2 text-blue-600" />
              <span className="text-xs font-bold">Apply Leave</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Request time off</span>
            </button>

            <button
              onClick={() => navigate('/app/attendance')}
              className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition flex flex-col items-center text-center cursor-pointer"
            >
              <History className="w-6 h-6 mb-2 text-indigo-600" />
              <span className="text-xs font-bold">Attendance History</span>
              <span className="text-[10px] text-slate-400 mt-0.5">View all logs</span>
            </button>

            <button
              onClick={() => navigate('/app/regularize')}
              className="p-4 rounded-2xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition flex flex-col items-center text-center cursor-pointer"
            >
              <Layers className="w-6 h-6 mb-2 text-amber-600" />
              <span className="text-xs font-bold">Correction Request</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Fix missed punch</span>
            </button>
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Recent Activity</span>
            </h3>

            {dashboardData?.recentActivity?.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.recentActivity.map((act, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      {act.type === 'IN' ? (
                        <LogIn className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <LogOut className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                      <span className="font-bold text-slate-800">{act.event}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">{act.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                No recent punch activity recorded yet today.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Gate Face Recognition</span>
            <span className="font-bold text-emerald-600">● Real-Time WebSocket Connected</span>
          </div>
        </div>
      </div>

      {/* Snapshot Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-scale-up text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h4 className="text-sm font-bold text-slate-900">Attendance Verification Snapshot</h4>
              <button onClick={() => setPreviewImage(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={previewImage} alt="Punch Verification" className="w-full h-64 object-cover rounded-2xl border border-slate-200" />
            <p className="text-[11px] text-slate-400 mt-3">Captured automatically by gate AI recognition camera.</p>
          </div>
        </div>
      )}
    </div>
  );
};
