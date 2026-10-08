import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Search,
  Filter,
  Eye,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  Layers,
  History,
  ArrowRight,
  Timer,
} from 'lucide-react';
import { portalApi } from '../../services/api';

export const EmployeeAttendancePage = () => {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [previewImg, setPreviewImg] = useState(null);
  const [selectedDayTimeline, setSelectedDayTimeline] = useState(null);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await portalApi.getAttendance({ month: selectedMonth });
      setRecords(res.data.records);
      setSummary(res.data.summary);
    } catch (err) {
      console.error('Failed to load attendance records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedMonth]);

  const handleExportCsv = () => {
    if (records.length === 0) return alert('No records to export for this month.');
    const headers = ['Date', 'First IN', 'Last OUT', 'Total Sessions', 'Working Duration', 'Outside Time', 'Status', 'Late (Mins)', 'Remarks'];
    const rows = records.map((r) => [
      r.date,
      r.firstIn || r.inTime || '—',
      r.lastOut || r.outTime || '—',
      r.totalSessions || r.sessions?.length || (r.inTime ? 1 : 0),
      r.workingDuration || '0h 0m',
      r.totalOutsideHours || '0h 0m',
      r.status,
      r.lateBy || 0,
      `"${r.remarks || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `My_Attendance_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Attendance History</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            View daily multi-session timestamps, working durations, outside times, and movement logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500"
          />

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Monthly Summary Statistics */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 block">Total Present Days</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{summary.presentDays}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">{summary.fullDays} Full • {summary.halfDays} Half</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 block">Late Arrivals</span>
            <span className="text-2xl font-black text-amber-700 mt-1 block">{summary.lateDays}</span>
            <span className="text-[10px] text-slate-400">Within grace limit</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 block">Total Hours Logged</span>
            <span className="text-2xl font-black text-blue-700 font-mono mt-1 block">{summary.totalWorkingHours}</span>
            <span className="text-[10px] text-slate-400">Avg: {summary.averageDailyHours} / day</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 block">Leave & Absent</span>
            <span className="text-2xl font-black text-rose-700 mt-1 block">{summary.absentDays + summary.leaveDays}</span>
            <span className="text-[10px] text-slate-400">{summary.leaveDays} on leave</span>
          </div>
        </div>
      )}

      {/* Daily Records List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-6">Date</th>
                <th className="py-3.5 px-4">First IN</th>
                <th className="py-3.5 px-4">Last OUT</th>
                <th className="py-3.5 px-4">Sessions</th>
                <th className="py-3.5 px-4">Working Time</th>
                <th className="py-3.5 px-4">Outside Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Late / Early</th>
                <th className="py-3.5 px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading attendance records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    No attendance records found for {selectedMonth}.
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const dateObj = new Date(rec.date);
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const sessionCount = rec.totalSessions || rec.sessions?.length || (rec.inTime ? 1 : 0);

                  let badgeColor = 'bg-slate-100 text-slate-700';
                  if (rec.status === 'FULL DAY' || rec.status === 'PRESENT') badgeColor = 'bg-emerald-100 text-emerald-800';
                  else if (rec.status === 'HALF DAY') badgeColor = 'bg-orange-100 text-orange-800';
                  else if (rec.status === 'LATE') badgeColor = 'bg-amber-100 text-amber-800';
                  else if (rec.status === 'ABSENT') badgeColor = 'bg-rose-100 text-rose-800';
                  else if (rec.status === 'ON LEAVE') badgeColor = 'bg-purple-100 text-purple-800';

                  return (
                    <tr key={rec.date} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-900">{rec.date}</div>
                        <div className="text-[10px] text-slate-400">{dayName}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        {rec.firstIn || rec.inTime || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        {rec.lastOut || rec.outTime || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setSelectedDayTimeline(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200/70 transition cursor-pointer"
                        >
                          <Layers className="w-3 h-3" />
                          <span>{sessionCount} {sessionCount === 1 ? 'Session' : 'Sessions'}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-blue-900">
                        {rec.workingDuration || rec.totalWorkingHours || '0h 0m'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-500">
                        {rec.totalOutsideHours || '0h 0m'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {rec.lateBy > 0 ? (
                          <span className="text-amber-700 font-semibold">Late {rec.lateBy}m</span>
                        ) : rec.earlyExitBy > 0 ? (
                          <span className="text-orange-700 font-semibold">Early {rec.earlyExitBy}m</span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">Normal</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedDayTimeline(rec)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="View Day Movement Timeline"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {rec.verificationImage && (
                            <button
                              onClick={() => setPreviewImg(rec.verificationImage)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                              title="View Camera Verification Photo"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Day Movement Timeline Modal */}
      {selectedDayTimeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-scale-up space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Movement Audit — {selectedDayTimeline.date}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Full chronological session timeline & durations
                </p>
              </div>
              <button
                onClick={() => setSelectedDayTimeline(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                <span className="text-[10px] font-bold text-blue-600 uppercase block">Total Working Time</span>
                <span className="text-lg font-black font-mono text-blue-950 mt-0.5 block">
                  {selectedDayTimeline.workingDuration || selectedDayTimeline.totalWorkingHours || '0h 0m'}
                </span>
              </div>
              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl">
                <span className="text-[10px] font-bold text-amber-600 uppercase block">Total Outside Time</span>
                <span className="text-lg font-black font-mono text-amber-950 mt-0.5 block">
                  {selectedDayTimeline.totalOutsideHours || '0h 0m'}
                </span>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chronological Events</h4>
              {selectedDayTimeline.timeline && selectedDayTimeline.timeline.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-slate-200 space-y-3 my-2">
                  {selectedDayTimeline.timeline.map((item, idx) => {
                    const isIN = item.type === 'IN';
                    return (
                      <div key={idx} className="relative">
                        <span
                          className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                            isIN ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                isIN ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isIN ? '🟢 IN' : '🔴 OUT'}
                            </span>
                            <span className="text-xs font-black font-mono text-slate-900 ml-2">{item.time}</span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Session #{item.sessionIndex || 1}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
                  <div>First IN: <b className="font-mono text-emerald-700">{selectedDayTimeline.firstIn || selectedDayTimeline.inTime || '--'}</b></div>
                  <div>Last OUT: <b className="font-mono text-indigo-700">{selectedDayTimeline.lastOut || selectedDayTimeline.outTime || '--'}</b></div>
                </div>
              )}
            </div>

            {/* Session Cards */}
            {selectedDayTimeline.sessions && selectedDayTimeline.sessions.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sessions Breakdown</h4>
                <div className="space-y-2">
                  {selectedDayTimeline.sessions.map((sess, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">Session #{sess.sessionIndex || idx + 1}:</span>
                        <span className="font-mono text-emerald-700 font-bold">{sess.inTime || '--'}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-mono text-indigo-700 font-bold">{sess.outTime || '--'}</span>
                      </div>
                      <span className="font-black font-mono text-blue-900">{sess.durationStr || '0h 0m'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            <p className="text-[11px] text-slate-400 mt-3">Captured live at attendance terminal.</p>
          </div>
        </div>
      )}
    </div>
  );
};
