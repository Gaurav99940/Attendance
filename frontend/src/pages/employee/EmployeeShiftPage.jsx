import React, { useState, useEffect } from 'react';
import {
  Sun,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { portalApi } from '../../services/api';

export const EmployeeShiftPage = () => {
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShift = async () => {
      try {
        setLoading(true);
        const res = await portalApi.getShift();
        setShift(res.data);
      } catch (err) {
        console.error('Failed to load shift information:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchShift();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Shift Timings & Policy</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Your official working hours, grace periods, and attendance duration rules
          </p>
        </div>
        <span className="px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 font-extrabold text-xs border border-blue-200">
          Active Schedule
        </span>
      </div>

      {/* Main Shift Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Assigned Shift Schedule</span>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">{shift?.name || 'General Day Shift'}</h2>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 font-semibold block">Required Daily Duration</span>
            <span className="text-lg font-black text-blue-700 font-mono block">{shift?.requiredHours || '7.5 Hours'}</span>
          </div>
        </div>

        {/* Timings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-bold text-slate-400 block">Expected Arrival (Start Time)</span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {shift?.startTime || '10:30 AM'}
            </span>
            <span className="text-xs text-amber-700 font-semibold mt-2 block">
              Grace Period: {shift?.lateGraceMinutes || 15} Minutes
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-xs font-bold text-slate-400 block">Expected Departure (End Time)</span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {shift?.endTime || '06:00 PM'}
            </span>
            <span className="text-xs text-indigo-700 font-semibold mt-2 block">
              Early Exit Tolerance: {shift?.earlyExitGraceMinutes || 15} Minutes
            </span>
          </div>
        </div>

        {/* Attendance Qualification Thresholds */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 space-y-3">
          <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
            Attendance Calculation Thresholds
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-white/80 p-3.5 rounded-xl border border-blue-200/60">
              <span className="font-bold text-emerald-800 block mb-0.5">Full Day Status (Present)</span>
              <span className="text-slate-600 leading-relaxed block">
                Must complete a minimum of <b className="text-emerald-700">{shift?.fullDayMinimumHours || '7.5 Hours'}</b> of working duration.
              </span>
            </div>
            <div className="bg-white/80 p-3.5 rounded-xl border border-blue-200/60">
              <span className="font-bold text-orange-800 block mb-0.5">Half Day Status</span>
              <span className="text-slate-600 leading-relaxed block">
                Completed between <b className="text-orange-700">{shift?.halfDayMinimumHours || '4.0 Hours'}</b> and Full Day minimum.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
