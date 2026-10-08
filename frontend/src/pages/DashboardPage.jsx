import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Building2,
  CalendarCheck,
  SunMedium,
  Camera,
  ArrowRight,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sparkles,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi, cameraApi, employeeApi } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { lastEvent, triggerLocalEvent } = useWebSocket();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedSimEmp, setSelectedSimEmp] = useState('');
  const [simMode, setSimMode] = useState('AUTO');
  const [simulating, setSimulating] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await dashboardApi.getStats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await employeeApi.getAll();
      setEmployeesList(res.data);
      if (res.data.length > 0 && !selectedSimEmp) {
        setSelectedSimEmp(res.data[0].employeeId);
      }
    } catch (err) {
      console.error('Failed to load employees for simulation:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchEmployees();
  }, []);

  // When a real-time event arrives via WebSocket, refresh dashboard stats automatically
  useEffect(() => {
    if (lastEvent) {
      fetchStats();
    }
  }, [lastEvent]);

  const handleSimulatePunch = async () => {
    if (!selectedSimEmp) return;
    try {
      setSimulating(true);
      const res = await cameraApi.simulatePunch({
        employeeId: selectedSimEmp,
        mode: simMode,
        cameraId: 'cam_main',
      });
      fetchStats();
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Loading Dashboard Analytics...</p>
        </div>
      </div>
    );
  }

  const { metrics, recentActivity, departmentStats, trend } = stats;

  const statCards = [
    {
      label: 'Total Employees',
      value: metrics.totalEmployees,
      subtext: 'Active workforce',
      icon: Users,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      label: 'Present Today',
      value: metrics.presentToday,
      subtext: `${metrics.totalEmployees ? Math.round((metrics.presentToday / metrics.totalEmployees) * 100) : 0}% turn-out`,
      icon: UserCheck,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      label: 'Currently Inside',
      value: metrics.currentlyInside,
      subtext: 'Active in office premises',
      icon: Building2,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
    {
      label: 'Late Today',
      value: metrics.lateToday,
      subtext: 'Arrived past grace period',
      icon: Clock,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
      label: 'Half Day',
      value: metrics.halfDay,
      subtext: '< 7.5 hrs minimum duration',
      icon: SunMedium,
      color: 'bg-orange-50 text-orange-600 border-orange-100',
    },
    {
      label: 'On Leave',
      value: metrics.onLeave,
      subtext: 'Approved annual/sick leaves',
      icon: CalendarCheck,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
    },
    {
      label: 'Absent Today',
      value: metrics.absentToday,
      subtext: 'No attendance marked',
      icon: UserX,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time biometric attendance monitoring & AI facial recognition metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/live')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm shadow-blue-500/20 transition cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Open Live Camera Feed</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="stat-card bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">{card.label}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{card.value}</div>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">{card.subtext}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Section: Interactive Live Test Bar + Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 7-Day Trend Chart & Department breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* 7-Day Trend */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">7-Day Attendance Trend</h3>
                <p className="text-xs text-slate-400">Daily turn-out breakdown across all departments</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="text-slate-600">Present</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-slate-600">Late</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-slate-600">Absent</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Area type="monotone" dataKey="present" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#presentGrad)" name="Present" />
                  <Area type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} fillOpacity={0} name="Late" />
                  <Area type="monotone" dataKey="absent" stroke="#f43f5e" strokeWidth={2} fillOpacity={0} name="Absent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4">Department Attendance Overview</h3>
            <div className="space-y-3.5">
              {departmentStats.map((dept, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>{dept.department}</span>
                    <span className="font-mono text-slate-500">
                      {dept.present} / {dept.total} ({dept.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${dept.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Activity Stream & Quick Face Punch Simulator */}
        <div className="space-y-6">
          {/* Quick AI Punch Simulator */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md border border-slate-700">
            <div className="flex items-center gap-2 mb-2 text-blue-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">AI Punch Simulator</span>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Test automated IN/OUT recognition logic for any employee without needing a physical webcam.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Select Employee</label>
                <select
                  value={selectedSimEmp}
                  onChange={(e) => setSelectedSimEmp(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {employeesList.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.name} ({emp.employeeId}) — {emp.department}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">Trigger Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {['AUTO', 'IN_ONLY', 'OUT_ONLY'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSimMode(m)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition ${
                        simMode === m ? 'bg-blue-600 text-white' : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSimulatePunch}
                disabled={simulating || !selectedSimEmp}
                className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm cursor-pointer transition disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
                <span>{simulating ? 'Processing AI Recognition...' : 'Simulate Camera Detection'}</span>
              </button>
            </div>
          </div>

          {/* Recent Attendance Activity Stream */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[420px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Recent Activity</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Live Feed</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {recentActivity.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No attendance activity recorded today yet.
                </div>
              ) : (
                recentActivity.map((act, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ${
                          act.eventType === 'IN' ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}
                      >
                        {act.eventType}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 leading-snug">{act.employeeName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {act.employeeId} • {act.department}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800 font-mono">{act.time}</div>
                      <span
                        className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          act.status === 'FULL DAY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : act.status === 'LATE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {act.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => navigate('/history')}
              className="w-full mt-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <span>View Full History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
