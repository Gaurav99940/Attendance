import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  Eye,
  X,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { attendanceApi, employeeApi } from '../services/api';

const DEPARTMENTS = [
  'All',
  'Engineering',
  'Human Resources',
  'Sales',
  'Design',
  'Marketing',
  'Finance',
  'Operations',
  'Legal',
  'Customer Success',
];

export const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('All');
  const [employeesList, setEmployeesList] = useState([]);

  // Modal for Day Details
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const fetchEmployees = async () => {
    try {
      const res = await employeeApi.getAll();
      setEmployeesList(res.data);
    } catch (err) {
      console.error('Failed to load employees for calendar:', err);
    }
  };

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const res = await attendanceApi.getCalendar({
        month: monthStr,
        department: selectedDept,
        employeeId: selectedEmployeeId,
      });
      setCalendarData(res.data.days || []);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchCalendar();
  }, [monthStr, selectedDept, selectedEmployeeId]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate calendar grid days
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  // Blank padding for days before the 1st
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = `${monthStr}-${String(day).padStart(2, '0')}`;
    const dayRecord = calendarData.find((d) => d.date === dStr) || null;
    calendarDays.push({ day, date: dStr, data: dayRecord });
  }

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Monthly Attendance Calendar</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Visual day-by-day attendance distribution, working shifts, and punch verifications
          </p>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-extrabold text-base text-slate-800 px-3 min-w-40 text-center">{monthLabel}</span>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:w-64">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                Department: {d}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-72">
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
          >
            <option value="All">All Employees (Company Overview)</option>
            {employeesList.map((emp) => (
              <option key={emp.employeeId} value={emp.employeeId}>
                {emp.name} ({emp.employeeId})
              </option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-3 ml-auto text-xs font-semibold">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Full Day</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="text-slate-600">Half Day</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-600">Late</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="text-slate-600">Leave</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-600">Absent</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        {/* Days Header */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <div key={d} className={`py-2 ${i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-700'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((cell, idx) => {
            if (!cell) {
              return <div key={idx} className="aspect-square bg-slate-50/40 rounded-xl border border-transparent" />;
            }

            const { day, date, data } = cell;
            const hasData = data && data.total > 0;
            const isSingleEmp = selectedEmployeeId !== 'All';
            const singleRecord = isSingleEmp && hasData && data.records?.length > 0 ? data.records[0] : null;

            return (
              <div
                key={date}
                onClick={() => hasData && setSelectedDayDetail(data)}
                className={`aspect-square rounded-2xl border p-2 flex flex-col justify-between transition cursor-pointer select-none ${
                  hasData
                    ? 'border-slate-200 hover:border-blue-400 hover:shadow-md bg-white'
                    : 'border-slate-100 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{day}</span>
                  {singleRecord && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                        singleRecord.status === 'FULL DAY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : singleRecord.status === 'HALF DAY'
                          ? 'bg-orange-100 text-orange-800'
                          : singleRecord.status === 'LATE'
                          ? 'bg-amber-100 text-amber-800'
                          : singleRecord.status === 'ON LEAVE'
                          ? 'bg-purple-100 text-purple-800'
                          : singleRecord.status === 'ABSENT'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {singleRecord.status.substring(0, 4)}
                    </span>
                  )}
                </div>

                {/* Day Summary Badges */}
                {hasData && !isSingleEmp && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="text-emerald-700">{data.fullDay} Full</span>
                      <span className="text-amber-700">{data.late} Late</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-semibold">
                      <span className="text-orange-700">{data.halfDay} Half</span>
                      <span className="text-rose-700">{data.absent} Abs</span>
                    </div>
                  </div>
                )}

                {/* Single Employee punch timings */}
                {singleRecord && (
                  <div className="text-[10px] text-slate-500 font-mono">
                    <div>IN: {singleRecord.inTime || '--'}</div>
                    <div>OUT: {singleRecord.outTime || '--'}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Details Popup Modal */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Attendance Log — {selectedDayDetail.date}</h3>
                <p className="text-xs text-slate-500">
                  {selectedDayDetail.total} records logged for this calendar date
                </p>
              </div>
              <button onClick={() => setSelectedDayDetail(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedDayDetail.records?.map((rec, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {rec.verificationImage ? (
                      <img
                        src={rec.verificationImage}
                        alt={rec.employeeName}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                        {rec.employeeName ? rec.employeeName[0] : 'E'}
                      </div>
                    )}

                    <div>
                      <div className="font-bold text-slate-900">{rec.employeeName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {rec.employeeId} • {rec.department}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-left sm:text-right font-mono">
                    <div>
                      <div className="text-slate-700">IN: <span className="font-bold text-emerald-700">{rec.inTime || '--'}</span></div>
                      <div className="text-slate-700">OUT: <span className="font-bold text-blue-700">{rec.outTime || '--'}</span></div>
                    </div>

                    <div>
                      <div className="font-bold text-slate-900">{rec.workingDuration || '0h 0m'}</div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.status === 'FULL DAY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.status === 'HALF DAY'
                            ? 'bg-orange-100 text-orange-800'
                            : rec.status === 'LATE'
                            ? 'bg-amber-100 text-amber-800'
                            : rec.status === 'ON LEAVE'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
