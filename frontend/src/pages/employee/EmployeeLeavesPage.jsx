import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Trash2,
  X,
  FileText,
} from 'lucide-react';
import { portalApi } from '../../services/api';

export const EmployeeLeavesPage = () => {
  const [leaves, setLeaves] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    leaveType: 'Casual Leave',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const [leavesRes, meRes] = await Promise.all([
        portalApi.getLeaves(),
        portalApi.getMe(),
      ]);
      const rawLeaves = leavesRes.data;
      if (Array.isArray(rawLeaves)) {
        setLeaves(rawLeaves);
      } else if (rawLeaves && typeof rawLeaves === 'object') {
        setLeaves(rawLeaves.requests || []);
        setLeaveBalances(rawLeaves.balances || null);
      } else {
        setLeaves([]);
      }
      setProfileData(meRes.data);
    } catch (err) {
      console.error('Failed to load leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await portalApi.applyLeave(formData);
      setSuccessMsg(res.data.message);
      setShowApplyModal(false);
      setFormData({
        leaveType: 'Casual Leave',
        fromDate: new Date().toISOString().slice(0, 10),
        toDate: new Date().toISOString().slice(0, 10),
        reason: '',
      });
      fetchLeaves();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId) => {
    if (window.confirm('Are you sure you want to cancel this leave application?')) {
      try {
        await portalApi.cancelLeave(leaveId);
        fetchLeaves();
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to cancel leave.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Leave Management</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Apply for time-off, track approval status, and check your leave quotas
          </p>
        </div>

        <button
          onClick={() => setShowApplyModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Leave Quota Balances */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 block">Casual Leave</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {leaveBalances?.casual?.remaining ?? profileData?.leaveBalances?.casual?.remaining ?? 12}
          </span>
          <span className="text-[10px] text-slate-400">
            {leaveBalances?.casual?.used ?? profileData?.leaveBalances?.casual?.used ?? 0} days used of 12
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 block">Sick Leave</span>
          <span className="text-2xl font-black text-amber-700 mt-1 block">
            {leaveBalances?.sick?.remaining ?? profileData?.leaveBalances?.sick?.remaining ?? 10}
          </span>
          <span className="text-[10px] text-slate-400">
            {leaveBalances?.sick?.used ?? profileData?.leaveBalances?.sick?.used ?? 0} days used of 10
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 block">Paid Leave</span>
          <span className="text-2xl font-black text-blue-700 mt-1 block">
            {leaveBalances?.paid?.remaining ?? profileData?.leaveBalances?.paid?.remaining ?? 15}
          </span>
          <span className="text-[10px] text-slate-400">
            {leaveBalances?.paid?.used ?? profileData?.leaveBalances?.paid?.used ?? 0} days used of 15
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 block">Work From Home (WFH)</span>
          <span className="text-2xl font-black text-indigo-700 mt-1 block">
            {leaveBalances?.wfh?.used ?? profileData?.leaveBalances?.wfh?.used ?? 0}
          </span>
          <span className="text-[10px] text-slate-400">Approved remote days</span>
        </div>
      </div>

      {/* Applied Leaves History */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">My Leave Applications & Requests</h3>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading leave records...
          </div>
        ) : leaves.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            You haven't submitted any leave requests yet.
          </div>
        ) : (
          <div className="space-y-3">
            {leaves.map((leave) => {
              let statusBadge = 'bg-amber-100 text-amber-800 border-amber-200';
              let StatusIcon = Clock;
              if (leave.status === 'APPROVED') {
                statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                StatusIcon = CheckCircle2;
              } else if (leave.status === 'REJECTED') {
                statusBadge = 'bg-rose-100 text-rose-800 border-rose-200';
                StatusIcon = XCircle;
              }

              return (
                <div
                  key={leave.id}
                  className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{leave.leaveType}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${statusBadge}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{leave.status}</span>
                      </span>
                    </div>

                    <div className="text-slate-600 font-medium">
                      <b className="text-slate-900">{leave.fromDate}</b> to <b className="text-slate-900">{leave.toDate}</b>{' '}
                      <span className="text-slate-400">({leave.totalDays} Day{leave.totalDays > 1 ? 's' : ''})</span>
                    </div>

                    <div className="text-slate-500">
                      <span className="text-slate-400 font-semibold">Reason:</span> {leave.reason}
                    </div>

                    {leave.adminComment && (
                      <div className="text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded-lg text-[11px] font-semibold mt-1">
                        Admin Note: {leave.adminComment}
                      </div>
                    )}
                  </div>

                  {leave.status === 'PENDING' && (
                    <button
                      onClick={() => handleCancelLeave(leave.id)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-[11px] transition cursor-pointer self-start sm:self-center"
                    >
                      Cancel Application
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Submit Leave Application</h3>
              <button onClick={() => setShowApplyModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Leave Type *</label>
                <select
                  value={formData.leaveType}
                  onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-xs"
                >
                  <option value="Casual Leave">Casual Leave (CL)</option>
                  <option value="Sick Leave">Sick Leave (SL)</option>
                  <option value="Paid Leave">Paid Leave (PL)</option>
                  <option value="Work From Home">Work From Home (WFH / Remote)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">From Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.fromDate}
                    onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">To Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.toDate}
                    onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for Leave *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Explain reason for leave..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
