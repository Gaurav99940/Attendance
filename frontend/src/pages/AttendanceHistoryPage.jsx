import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  FileSpreadsheet,
  FileText,
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  LogIn,
  LogOut,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { attendanceApi, employeeApi, reportsApi } from '../services/api';

const STATUS_OPTIONS = [
  'All',
  'FULL DAY',
  'HALF DAY',
  'LATE',
  'ABSENT',
  'ON LEAVE',
  'WEEKEND',
  'INCOMPLETE',
];

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

export const AttendanceHistoryPage = () => {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('All');
  const [employeesList, setEmployeesList] = useState([]);

  // Modals
  const [previewImage, setPreviewImage] = useState(null);
  const [timelineModalRecord, setTimelineModalRecord] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    inTime: '10:30 AM',
    outTime: '06:00 PM',
    status: 'FULL DAY',
    remarks: 'Manual attendance adjustment',
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [page, search, startDate, endDate, selectedDept, selectedStatus, selectedEmployeeId]);

  const fetchEmployees = async () => {
    try {
      const res = await employeeApi.getAll();
      setEmployeesList(res.data);
    } catch (err) {
      console.error('Failed to load employees for filter:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await attendanceApi.getHistory({
        page,
        limit: 25,
        search,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        department: selectedDept,
        status: selectedStatus,
        employeeId: selectedEmployeeId,
      });
      setRecords(res.data.records);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error('Failed to fetch attendance history:', err);
    } finally {
      setLoading(false);
    }
  };

  const setDatePreset = (preset) => {
    const today = new Date();
    if (preset === 'today') {
      const d = today.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(today.setDate(today.getDate() - 1)).toISOString().split('T')[0];
      setStartDate(y);
      setEndDate(y);
    } else if (preset === 'week') {
      const past = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
      setStartDate(past);
      setEndDate(new Date().toISOString().split('T')[0]);
    } else if (preset === 'month') {
      const past = new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0];
      setStartDate(past);
      setEndDate(new Date().toISOString().split('T')[0]);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
    setPage(1);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      setManualSubmitting(true);
      await attendanceApi.manualOverride(manualForm);
      setShowManualModal(false);
      fetchHistory();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit manual adjustment.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleDelete = async (rec) => {
    if (window.confirm(`Delete attendance record for ${rec.employeeName} on ${rec.date}?`)) {
      try {
        await attendanceApi.deleteRecord(rec.id);
        fetchHistory();
      } catch (err) {
        alert('Failed to delete attendance record.');
      }
    }
  };

  const openTimelineModal = async (rec) => {
    try {
      const res = await attendanceApi.getEmployeeAttendanceByDate(rec.employeeId, rec.date);
      setTimelineModalRecord(res.data);
    } catch (err) {
      // Fallback to record in list if API fails
      setTimelineModalRecord(rec);
    }
  };

  const downloadCsv = () => {
    const url = reportsApi.getExportCsvUrl({
      month: startDate?.substring(0, 7) || new Date().toISOString().substring(0, 7),
      department: selectedDept,
    });
    window.open(url, '_blank');
  };

  const downloadExcel = () => {
    const url = reportsApi.getExportExcelUrl({
      month: startDate?.substring(0, 7) || new Date().toISOString().substring(0, 7),
      department: selectedDept,
    });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Attendance Logs & History</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Search, filter, review multi-session timeline audits, AI verification snapshots, and export reports
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer border border-slate-200"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Manual Override</span>
          </button>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-xl transition cursor-pointer border border-blue-200/70"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={downloadExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl transition cursor-pointer border border-emerald-200/70"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Department */}
          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  Dept: {d}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            >
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  Status: {st}
                </option>
              ))}
            </select>
          </div>

          {/* Employee dropdown */}
          <div>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            >
              <option value="All">Employee: All</option>
              {employeesList.map((emp) => (
                <option key={emp.employeeId} value={emp.employeeId}>
                  {emp.name} ({emp.employeeId})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date presets & date picker */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-500 mr-1">Date Presets:</span>
            {['today', 'yesterday', 'week', 'month', 'all'].map((p) => (
              <button
                key={p}
                onClick={() => setDatePreset(p)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium capitalize transition cursor-pointer"
              >
                {p === 'week' ? 'Last 7 Days' : p === 'month' ? 'Last 30 Days' : p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-5">Employee</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">First IN</th>
                <th className="py-3 px-4">Last OUT</th>
                <th className="py-3 px-4">Sessions</th>
                <th className="py-3 px-4">Working Hours</th>
                <th className="py-3 px-4">Outside Time</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timeline</th>
                <th className="py-3 px-4">Face Photo</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading attendance logs...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-400">
                    No attendance records found for current criteria.
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const sessionCount = rec.totalSessions || (rec.sessions?.length) || (rec.inTime ? 1 : 0);
                  const isCurrentlyInside = rec.currentStatus === 'INSIDE';

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-5">
                        <div className="font-bold text-slate-900">{rec.employeeName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {rec.employeeId} • {rec.department}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{rec.date}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        {rec.firstIn || rec.inTime || '--'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {rec.lastOut || rec.outTime || (isCurrentlyInside ? 'Active (Inside)' : '--')}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openTimelineModal(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200/70 transition cursor-pointer"
                          title="Click to view detailed session timeline"
                        >
                          <Layers className="w-3 h-3" />
                          <span>{sessionCount} {sessionCount === 1 ? 'Session' : 'Sessions'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {rec.workingDuration || rec.totalWorkingHours || '0h 0m'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 font-semibold">
                        {rec.totalOutsideHours || '0h 0m'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.status === 'FULL DAY'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rec.status === 'HALF DAY'
                              ? 'bg-orange-100 text-orange-800'
                              : rec.status === 'LATE'
                              ? 'bg-amber-100 text-amber-800'
                              : rec.status === 'ON LEAVE'
                              ? 'bg-purple-100 text-purple-800'
                              : rec.status === 'ABSENT'
                              ? 'bg-rose-100 text-rose-800'
                              : rec.status === 'WEEKEND'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openTimelineModal(rec)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-xs cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Timeline</span>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {rec.verificationImage ? (
                          <button
                            onClick={() => setPreviewImage(rec.verificationImage)}
                            className="flex items-center gap-1 text-slate-600 hover:text-blue-600 font-semibold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Photo</span>
                          </button>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() => handleDelete(rec)}
                          title="Delete record"
                          className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>
            Showing {records.length} of {total} total records
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              Previous
            </button>
            <span className="font-bold">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ================= MULTI-SESSION TIMELINE AUDIT MODAL ================= */}
      {timelineModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-scale-up space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {timelineModalRecord.employeeId}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {timelineModalRecord.employeeName}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Daily Attendance & Movement Audit • <b className="text-slate-800">{timelineModalRecord.date}</b>
                </p>
              </div>

              <button
                onClick={() => setTimelineModalRecord(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Real-time Status Banner */}
            {timelineModalRecord.currentStatus && (
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  timelineModalRecord.currentStatus === 'INSIDE'
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      timelineModalRecord.currentStatus === 'INSIDE'
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-rose-500'
                    }`}
                  />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block">Current Presence State</span>
                    <span className="text-sm font-black">
                      {timelineModalRecord.currentStatus === 'INSIDE' ? '🟢 Currently Inside Office' : '🔴 Currently Outside Office'}
                    </span>
                  </div>
                </div>

                <div className="text-right text-xs">
                  <span className="text-slate-500 block font-medium">Shift Window</span>
                  <span className="font-bold text-slate-900">10:30 AM – 06:00 PM</span>
                </div>
              </div>
            )}

            {/* Metrics KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl">
                <span className="text-[11px] font-bold text-blue-700 block">Total Working Hours</span>
                <span className="text-xl font-black text-blue-950 font-mono mt-0.5 block">
                  {timelineModalRecord.workingDuration || timelineModalRecord.totalWorkingHours || '0h 0m'}
                </span>
                <span className="text-[10px] text-blue-600">Sum of inside sessions</span>
              </div>

              <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl">
                <span className="text-[11px] font-bold text-amber-700 block">Total Outside Time</span>
                <span className="text-xl font-black text-amber-950 font-mono mt-0.5 block">
                  {timelineModalRecord.totalOutsideHours || '0h 0m'}
                </span>
                <span className="text-[10px] text-amber-600">Time outside office</span>
              </div>

              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                <span className="text-[11px] font-bold text-indigo-700 block">Total Sessions</span>
                <span className="text-xl font-black text-indigo-950 mt-0.5 block">
                  {timelineModalRecord.totalSessions || timelineModalRecord.sessions?.length || 1}
                </span>
                <span className="text-[10px] text-indigo-600">IN / OUT pairs</span>
              </div>

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                <span className="text-[11px] font-bold text-emerald-700 block">Day Status</span>
                <span className="text-sm font-black text-emerald-950 mt-1 block">
                  {timelineModalRecord.status}
                </span>
                <span className="text-[10px] text-emerald-600">
                  {timelineModalRecord.lateBy > 0 ? `Late +${timelineModalRecord.lateBy}m` : 'On Time'}
                </span>
              </div>
            </div>

            {/* Visual Movement Timeline */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <History className="w-4 h-4 text-blue-600" />
                <span>Chronological In/Out Movement Timeline</span>
              </h4>

              {timelineModalRecord.timeline && timelineModalRecord.timeline.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-slate-200 space-y-4 my-3">
                  {timelineModalRecord.timeline.map((item, idx) => {
                    const isIN = item.type === 'IN';
                    return (
                      <div key={idx} className="relative group">
                        {/* Dot indicator */}
                        <span
                          className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center text-[8px] text-white font-bold ${
                            isIN ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />

                        <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 transition flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                isIN ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isIN ? '🟢 IN' : '🔴 OUT'}
                            </span>
                            <div>
                              <span className="text-xs font-extrabold text-slate-900 font-mono">
                                {item.time}
                              </span>
                              <span className="text-[11px] text-slate-500 block">
                                {isIN ? `Session #${item.sessionIndex || 1} Entry` : `Session #${item.sessionIndex || 1} Exit`}
                              </span>
                            </div>
                          </div>

                          {item.image && (
                            <button
                              onClick={() => setPreviewImage(item.image)}
                              className="px-2 py-1 bg-white hover:bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-slate-200 flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Snapshot</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Fallback single-session timeline if timeline array is empty */
                <div className="relative pl-6 border-l-2 border-slate-200 space-y-4 my-3">
                  <div className="relative">
                    <span className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white bg-emerald-500" />
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase">
                          🟢 IN
                        </span>
                        <span className="text-xs font-mono font-extrabold text-slate-900 ml-2">
                          {timelineModalRecord.firstIn || timelineModalRecord.inTime || '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {timelineModalRecord.lastOut || timelineModalRecord.outTime ? (
                    <div className="relative">
                      <span className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white bg-rose-500" />
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 uppercase">
                            🔴 OUT
                          </span>
                          <span className="text-xs font-mono font-extrabold text-slate-900 ml-2">
                            {timelineModalRecord.lastOut || timelineModalRecord.outTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Session Breakdown Cards */}
            {timelineModalRecord.sessions && timelineModalRecord.sessions.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Session Durations Breakdown</span>
                </h4>

                <div className="space-y-2.5">
                  {timelineModalRecord.sessions.map((sess, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center">
                          #{sess.sessionIndex || idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-emerald-700 font-mono font-extrabold">{sess.inTime || '--'}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-indigo-700 font-mono font-extrabold">{sess.outTime || 'In Progress'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {sess.status === 'ACTIVE' ? 'Active Session (Inside Office)' : 'Completed Session'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-extrabold font-mono text-blue-950 block">
                          {sess.durationStr || '0h 0m'}
                        </span>
                        <span className="text-[10px] text-slate-400">Duration</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setTimelineModalRecord(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Snapshot Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center animate-scale-up">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">AI Verification Snapshot</h3>
              <button onClick={() => setPreviewImage(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <img src={previewImage} alt="Verification" className="w-full aspect-square rounded-xl object-cover border border-slate-200 mb-3" />
            <p className="text-[11px] text-slate-500">Captured by terminal camera at punch timestamp.</p>
          </div>
        </div>
      )}

      {/* Manual Override Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Manual Attendance Adjustment</h3>
              <button onClick={() => setShowManualModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select Employee *</label>
                <select
                  required
                  value={manualForm.employeeId}
                  onChange={(e) => setManualForm({ ...manualForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Employee --</option>
                  {employeesList.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.name} ({emp.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={manualForm.date}
                    onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Attendance Status</label>
                  <select
                    value={manualForm.status}
                    onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="FULL DAY">FULL DAY</option>
                    <option value="HALF DAY">HALF DAY</option>
                    <option value="LATE">LATE</option>
                    <option value="ON LEAVE">ON LEAVE</option>
                    <option value="ABSENT">ABSENT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">First IN Time</label>
                  <input
                    type="text"
                    placeholder="10:30 AM"
                    value={manualForm.inTime}
                    onChange={(e) => setManualForm({ ...manualForm, inTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Last OUT Time</label>
                  <input
                    type="text"
                    placeholder="06:00 PM"
                    value={manualForm.outTime}
                    onChange={(e) => setManualForm({ ...manualForm, outTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Remarks / Audit Note</label>
                <textarea
                  rows={2}
                  value={manualForm.remarks}
                  onChange={(e) => setManualForm({ ...manualForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {manualSubmitting ? 'Saving...' : 'Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
