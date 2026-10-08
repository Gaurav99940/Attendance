import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Info,
  Layers,
  History,
  ArrowRight,
  Timer,
} from 'lucide-react';
import { portalApi } from '../../services/api';

export const EmployeeCalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState({});
  const [leavesData, setLeavesData] = useState([]);
  const [selectedDayRecord, setSelectedDayRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const res = await portalApi.getCalendar({ month: monthStr });
      setAttendanceData(res.data.attendance || {});
      setLeavesData(res.data.leaves || []);
    } catch (err) {
      console.error('Failed to load employee calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
    setSelectedDayRecord(null);
  }, [monthStr]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Build calendar matrix
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  // Leading empty days
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  // Month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ day: d, dateStr: dStr });
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Monthly Attendance Calendar</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Color-coded view of daily sessions, working durations, and attendance audits
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 transition shadow-2xs cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-extrabold text-xs sm:text-sm text-slate-800 px-3 min-w-[140px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl hover:bg-white text-slate-600 hover:text-slate-900 transition shadow-2xs cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-around flex-wrap gap-2 text-[11px] font-bold">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-emerald-500" />
          <span className="text-slate-700">Present (Full Day)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-amber-500" />
          <span className="text-slate-700">Late Arrival</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-orange-500" />
          <span className="text-slate-700">Half Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-purple-500" />
          <span className="text-slate-700">On Leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-rose-500" />
          <span className="text-slate-700">Absent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-slate-200" />
          <span className="text-slate-500">Weekend / Off</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((item, idx) => {
              if (!item) {
                return <div key={`empty-${idx}`} className="aspect-square rounded-2xl bg-slate-50/50" />;
              }

              const rec = attendanceData[item.dateStr];
              const isWeekend = new Date(item.dateStr).getDay() === 0 || new Date(item.dateStr).getDay() === 6;
              const isToday = item.dateStr === new Date().toISOString().slice(0, 10);
              const isSelected = selectedDayRecord?.date === item.dateStr;

              let cellBg = isWeekend ? 'bg-slate-50 text-slate-400 border-slate-200/50' : 'bg-white text-slate-800 border-slate-200';
              let badgeColor = null;

              if (rec) {
                if (rec.status === 'FULL DAY' || rec.status === 'PRESENT') {
                  badgeColor = 'bg-emerald-500 text-white';
                  cellBg = 'bg-emerald-50/60 border-emerald-200 text-emerald-950 font-bold';
                } else if (rec.status === 'LATE') {
                  badgeColor = 'bg-amber-500 text-white';
                  cellBg = 'bg-amber-50/60 border-amber-200 text-amber-950 font-bold';
                } else if (rec.status === 'HALF DAY') {
                  badgeColor = 'bg-orange-500 text-white';
                  cellBg = 'bg-orange-50/60 border-orange-200 text-orange-950 font-bold';
                } else if (rec.status === 'ON LEAVE') {
                  badgeColor = 'bg-purple-500 text-white';
                  cellBg = 'bg-purple-50/60 border-purple-200 text-purple-950 font-bold';
                } else if (rec.status === 'ABSENT') {
                  badgeColor = 'bg-rose-500 text-white';
                  cellBg = 'bg-rose-50/60 border-rose-200 text-rose-950 font-bold';
                }
              }

              const sessionCount = rec?.totalSessions || rec?.sessions?.length || (rec?.inTime ? 1 : 0);

              return (
                <button
                  key={item.dateStr}
                  onClick={() => setSelectedDayRecord(rec || { date: item.dateStr, status: isWeekend ? 'WEEKEND' : 'NOT LOGGED' })}
                  className={`aspect-square p-2 rounded-2xl border transition flex flex-col justify-between text-left cursor-pointer relative ${cellBg} ${
                    isSelected ? 'ring-2 ring-blue-600 shadow-md' : 'hover:border-blue-300'
                  } ${isToday ? 'border-blue-500' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isToday ? 'text-blue-600 font-black' : ''}`}>
                      {item.day}
                    </span>
                    {isToday && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </div>

                  {rec ? (
                    <div>
                      <div className="text-[9px] font-mono font-bold leading-none truncate">
                        {rec.firstIn || rec.inTime || '—'}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded inline-block ${badgeColor}`}>
                          {rec.status === 'FULL DAY' ? 'FULL' : rec.status === 'HALF DAY' ? 'HALF' : rec.status}
                        </span>
                        {sessionCount > 1 && (
                          <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-blue-100 text-blue-800">
                            {sessionCount}S
                          </span>
                        )}
                      </div>
                    </div>
                  ) : isWeekend ? (
                    <span className="text-[9px] text-slate-300 font-semibold">Off</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base mb-1">Day Attendance Inspection</h3>
            <p className="text-xs text-slate-400 mb-4">
              {selectedDayRecord ? `Inspection for ${selectedDayRecord.date}` : 'Click any date on the calendar to view full breakdown'}
            </p>

            {selectedDayRecord ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span className="font-bold text-slate-900 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800">
                    {selectedDayRecord.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">First IN</span>
                    <b className="text-emerald-700 font-mono text-sm">
                      {selectedDayRecord.firstIn || selectedDayRecord.inTime || '—'}
                    </b>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Last OUT</span>
                    <b className="text-indigo-700 font-mono text-sm">
                      {selectedDayRecord.lastOut || selectedDayRecord.outTime || '—'}
                    </b>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100">
                    <span className="text-blue-600 block text-[10px] font-bold">Working Duration</span>
                    <b className="text-blue-950 font-mono text-base">
                      {selectedDayRecord.workingDuration || selectedDayRecord.totalWorkingHours || '0h 0m'}
                    </b>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
                    <span className="text-amber-600 block text-[10px] font-bold">Outside Time</span>
                    <b className="text-amber-950 font-mono text-base">
                      {selectedDayRecord.totalOutsideHours || '0h 0m'}
                    </b>
                  </div>
                </div>

                {selectedDayRecord.sessions && selectedDayRecord.sessions.length > 0 && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Sessions Breakdown ({selectedDayRecord.sessions.length})
                    </span>
                    {selectedDayRecord.sessions.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-medium">
                          #{s.sessionIndex || idx + 1}: <b className="font-mono text-emerald-700">{s.inTime}</b> → <b className="font-mono text-indigo-700">{s.outTime || '—'}</b>
                        </span>
                        <span className="font-mono font-bold text-slate-800">{s.durationStr || '0h 0m'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedDayRecord.lateBy > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                    <span className="font-bold">Late Arrival:</span> {selectedDayRecord.lateBy} minutes
                  </div>
                )}

                {selectedDayRecord.remarks && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-600">
                    <span className="font-bold block text-[10px] text-slate-400">Remarks:</span>
                    {selectedDayRecord.remarks}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                <CalendarIcon className="w-10 h-10 text-slate-300 mb-2" />
                <span>Select a day from the calendar grid to see punch details and working hours.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
