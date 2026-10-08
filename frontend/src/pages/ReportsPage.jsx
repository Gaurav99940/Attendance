import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  UserX,
  Printer,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { reportsApi, employeeApi } from '../services/api';

const REPORT_TYPES = [
  { id: 'monthly', label: 'Monthly Summary' },
  { id: 'daily', label: 'Daily Attendance' },
  { id: 'weekly', label: 'Weekly Overview' },
  { id: 'late', label: 'Late Arrivals' },
  { id: 'absent', label: 'Absenteeism' },
  { id: 'department', label: 'Department-wise' },
  { id: 'working_hours', label: 'Working Hours Analysis' },
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

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#a855f7', '#f43f5e', '#64748b'];

export const ReportsPage = () => {
  const [reportType, setReportType] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedEmp, setSelectedEmp] = useState('All');
  const [employeesList, setEmployeesList] = useState([]);

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [reportType, selectedMonth, selectedDate, selectedDept, selectedEmp]);

  const fetchEmployees = async () => {
    try {
      const res = await employeeApi.getAll();
      setEmployeesList(res.data);
    } catch (err) {
      console.error('Failed to load employees for report filter:', err);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await reportsApi.getReports({
        reportType,
        month: selectedMonth,
        date: selectedDate,
        department: selectedDept,
        employeeId: selectedEmp,
      });
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    const url = reportsApi.getExportCsvUrl({
      reportType,
      month: selectedMonth,
      department: selectedDept,
    });
    window.open(url, '_blank');
  };

  const handleExportExcel = () => {
    const url = reportsApi.getExportExcelUrl({
      month: selectedMonth,
      department: selectedDept,
    });
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const summary = reportData?.summary;
  const records = reportData?.records || [];

  const pieData = summary
    ? [
        { name: 'Full Day', value: summary.fullDays },
        { name: 'Late Arrival', value: summary.lateArrivals },
        { name: 'Half Day', value: summary.halfDays },
        { name: 'On Leave', value: summary.leaveCount },
        { name: 'Absent', value: summary.absentCount },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Attendance Reports & Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Generate executive compliance summaries, punctuality analytics, and export audit files
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-xl transition cursor-pointer border border-blue-200/60"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Download CSV</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl transition cursor-pointer border border-emerald-200/60"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download Excel</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer border border-slate-200"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Types Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto">
        {REPORT_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setReportType(t.id)}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              reportType === t.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Report Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        {reportType === 'daily' ? (
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Target Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>
        ) : (
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Target Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="font-semibold text-slate-600 block mb-1">Department</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold text-slate-600 block mb-1">Employee Filter</label>
          <select
            value={selectedEmp}
            onChange={(e) => setSelectedEmp(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
          >
            <option value="All">All Staff</option>
            {employeesList.map((emp) => (
              <option key={emp.employeeId} value={emp.employeeId}>
                {emp.name} ({emp.employeeId})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={fetchReports}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
          >
            Refresh Analytics
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500">Total Entries</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{summary.totalEntries}</div>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500">Total Working Hours</div>
            <div className="text-xl font-extrabold text-blue-600 mt-1">{summary.totalWorkingHours}</div>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500">Full Days</div>
            <div className="text-xl font-extrabold text-emerald-600 mt-1">{summary.fullDays}</div>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500">Late Arrivals</div>
            <div className="text-xl font-extrabold text-amber-600 mt-1">{summary.lateArrivals}</div>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500">Half Days</div>
            <div className="text-xl font-extrabold text-orange-600 mt-1">{summary.halfDays}</div>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500">Absences / Leaves</div>
            <div className="text-xl font-extrabold text-rose-600 mt-1">
              {summary.absentCount + summary.leaveCount}
            </div>
          </div>
        </div>
      )}

      {/* Visual Chart & Detailed Report Data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Status Distribution</h3>
          <div className="h-56 w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-xs">No chart data available</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] font-semibold">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-slate-600 truncate">
                  {item.name}: <b className="text-slate-900">{item.value}</b>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Report Data Table ({records.length} records)</h3>
            <span className="text-xs text-slate-500 font-mono font-bold">Month: {selectedMonth}</span>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[420px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Employee</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">IN / OUT</th>
                  <th className="py-2.5 px-4">Duration</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      No records found for current criteria.
                    </td>
                  </tr>
                ) : (
                  records.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-bold text-slate-800">
                        {r.employeeName}
                        <div className="text-[10px] text-slate-400 font-mono font-normal">
                          {r.employeeId} • {r.department}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{r.date}</td>
                      <td className="py-2.5 px-4 font-mono">
                        <span className="text-emerald-700 font-bold">{r.inTime || '--'}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-blue-700 font-bold">{r.outTime || '--'}</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-700">
                        {r.workingDuration || '0h 0m'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'FULL DAY'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'HALF DAY'
                              ? 'bg-orange-100 text-orange-800'
                              : r.status === 'LATE'
                              ? 'bg-amber-100 text-amber-800'
                              : r.status === 'ON LEAVE'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate">{r.remarks || '--'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
