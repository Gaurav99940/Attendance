import React, { useState, useEffect } from 'react';
import { CalendarDays, Sparkles, MapPin } from 'lucide-react';
import { portalApi } from '../../services/api';

export const EmployeeHolidaysPage = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        setLoading(true);
        const res = await portalApi.getHolidays();
        setHolidays(res.data);
      } catch (err) {
        console.error('Failed to load holidays:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHolidays();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Company Holiday Calendar</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Official public, national, and gazetted company holidays for {new Date().getFullYear()}
          </p>
        </div>
        <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 font-extrabold text-xs border border-emerald-200">
          {holidays.length} Paid Holidays
        </div>
      </div>

      {/* Holidays List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {holidays.map((h, idx) => {
          const dateObj = new Date(h.date);
          const dayName = h.day || dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });
          const dayNum = dateObj.getDate();

          return (
            <div
              key={idx}
              className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center gap-4 hover:border-blue-300 transition"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-200 text-blue-700 flex flex-col items-center justify-center shrink-0">
                <span className="text-[10px] font-bold uppercase leading-none">{monthShort}</span>
                <span className="text-xl font-black leading-none mt-1">{dayNum}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-slate-900 text-sm truncate">{h.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{dayName}</div>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                  {h.type}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
