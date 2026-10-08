import React, { useState, useEffect } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkles,
  Calendar,
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  Timer,
  History,
  Activity,
} from 'lucide-react';
import { portalApi } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';

export const EmployeeTodayPage = () => {
  const { user } = useAuth();
  const { latestPunch } = useWebSocket();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewImg, setPreviewImg] = useState(null);
  const [now, setNow] = useState(new Date());

  const fetchToday = async () => {
    try {
      setLoading(true);
      const res = await portalApi.getToday();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load today punch details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToday();
  }, []);

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (latestPunch && user?.employeeId && latestPunch.employeeId === user.employeeId) {
      fetchToday();
    }
  }, [latestPunch, user]);

  const isInside = data?.isInside || data?.currentStatus === 'INSIDE';
  const hasPunched = Boolean(data?.firstIn || data?.actualIn || data?.totalSessions > 0);
  const sessions = data?.sessions || [];
  const timeline = data?.timeline || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Presence & Sessions</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Today's Attendance Breakdown</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">{data?.formattedDate || 'Today'}</p>
        </div>

        {/* Current State Live Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span
            className={`px-4 py-2 rounded-2xl text-xs font-extrabold flex items-center gap-2 border shadow-2xs ${
              isInside
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : hasPunched
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isInside ? 'bg-emerald-500 animate-pulse' : hasPunched ? 'bg-rose-500' : 'bg-amber-400'
              }`}
            />
            <span>
              {isInside
                ? '🟢 CURRENTLY INSIDE'
                : hasPunched
                ? '🔴 CURRENTLY OUTSIDE'
                : '⚪ NOT CHECKED IN'}
            </span>
          </span>
        </div>
      </div>

      {/* Live State Card */}
      {hasPunched && (
        <div
          className={`p-6 rounded-3xl border shadow-xs transition ${
            isInside
              ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border-emerald-200'
              : 'bg-gradient-to-r from-rose-500/10 via-orange-500/5 to-amber-500/10 border-rose-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs ${
                  isInside ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {isInside ? <LogIn className="w-6 h-6" /> : <LogOut className="w-6 h-6" />}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {isInside ? 'Active Session Status' : 'Outside Office Status'}
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {isInside
                    ? `Session #${data?.totalSessions || 1} in Progress`
                    : 'Currently Stepped Out of Office'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  {isInside
                    ? `Entered at ${data?.lastInTime || data?.actualIn || '--'}`
                    : `Last exit at ${data?.lastExitTime || data?.actualOut || '--'}`}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right bg-white/80 backdrop-blur-xs p-4 rounded-2xl border border-slate-200/60 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 block uppercase">
                {isInside ? 'Active Session Time' : 'Time Outside Office'}
              </span>
              <div className="text-2xl font-black font-mono text-slate-900 mt-0.5">
                {isInside
                  ? data?.currentSessionDurationStr || 'Active'
                  : data?.timeOutsideStr || 'Outside'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4-Card Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Working Hours */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Working Time</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {data?.workingHours || data?.totalWorkingHours || '0h 0m'}
          </div>
          <span className="text-[11px] text-blue-700 font-semibold mt-1 block">
            Sum of completed sessions
          </span>
        </div>

        {/* Outside Time */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Outside Time</span>
            <Timer className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-950 font-mono">
            {data?.totalOutsideHours || '0h 0m'}
          </div>
          <span className="text-[11px] text-amber-700 font-semibold mt-1 block">
            Total outside office
          </span>
        </div>

        {/* Total Sessions */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Sessions</span>
            <Layers className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {data?.totalSessions || sessions.length || (hasPunched ? 1 : 0)}
          </div>
          <span className="text-[11px] text-indigo-700 font-semibold mt-1 block">
            {data?.completedSessions || 0} completed
          </span>
        </div>

        {/* Status */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Day Status</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-950">
            {data?.status || 'NOT PUNCHED'}
          </div>
          <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
            {data?.lateBy > 0 ? `Late by ${data.lateBy}m` : 'Shift: 10:30 - 06:00'}
          </span>
        </div>
      </div>

      {/* Movement Timeline */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <span>Daily Attendance Timeline</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological records of every IN and OUT event captured today
            </p>
          </div>
        </div>

        {timeline.length > 0 ? (
          <div className="relative pl-6 border-l-2 border-slate-200 space-y-4 my-2">
            {timeline.map((item, idx) => {
              const isIN = item.type === 'IN';
              return (
                <div key={idx} className="relative">
                  {/* Dot indicator */}
                  <span
                    className={`absolute -left-[31px] top-2.5 w-4 h-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center ${
                      isIN ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />

                  <div className="p-4 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200 transition flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase ${
                          isIN ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isIN ? '🟢 IN' : '🔴 OUT'}
                      </span>
                      <div>
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {item.time}
                        </span>
                        <span className="text-xs text-slate-500 block">
                          {isIN
                            ? `Session #${item.sessionIndex || 1} Entry`
                            : `Session #${item.sessionIndex || 1} Departure`}
                        </span>
                      </div>
                    </div>

                    {item.image && (
                      <button
                        onClick={() => setPreviewImg(item.image)}
                        className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Photo</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <span>No punch events recorded for today yet. Scan your face at the terminal to check in.</span>
          </div>
        )}
      </div>

      {/* Session Durations Breakdown */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>Session Duration Breakdown</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Individual attendance session lengths contributing to total working hours
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sessions.map((sess, idx) => {
              const isActive = sess.status === 'ACTIVE';
              return (
                <div
                  key={idx}
                  className={`p-5 rounded-3xl border transition ${
                    isActive
                      ? 'bg-blue-50/60 border-blue-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-800 shadow-2xs">
                      Session #{sess.sessionIndex || idx + 1}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isActive ? 'Active (Inside)' : 'Completed'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between my-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Punch IN</span>
                      <span className="text-base font-black font-mono text-emerald-700">
                        {sess.inTime || '--'}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-300" />

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Punch OUT</span>
                      <span className="text-base font-black font-mono text-indigo-700">
                        {sess.outTime || 'In Progress'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Session Duration</span>
                    <span className="font-black font-mono text-slate-900 text-sm">
                      {sess.durationStr || '0h 0m'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Snapshot Preview Modal */}
      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-scale-up text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h4 className="text-sm font-bold text-slate-900">Attendance Verification Photo</h4>
              <button onClick={() => setPreviewImg(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={previewImg} alt="Snapshot" className="w-full h-64 object-cover rounded-2xl border border-slate-200" />
            <p className="text-[11px] text-slate-400 mt-3">Captured live at attendance terminal camera.</p>
          </div>
        </div>
      )}
    </div>
  );
};
