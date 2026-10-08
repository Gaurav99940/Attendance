import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  AlertCircle,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import { adminLeavesApi } from '../services/api';

export const AdminLeavesPage = () => {
  const [activeTab, setActiveTab] = useState('leaves'); // 'leaves' | 'regularization'
  const [leaves, setLeaves] = useState([]);
  const [regularizations, setRegularizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');

  // Action modal
  const [actionModal, setActionModal] = useState({
    show: false,
    type: 'leave', // 'leave' | 'reg'
    id: null,
    targetStatus: 'APPROVED',
    comment: '',
    title: '',
  });
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [actionError, setActionError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leaveRes, regRes] = await Promise.all([
        adminLeavesApi.getLeaves({ status: statusFilter }),
        adminLeavesApi.getRegularizations({ status: statusFilter }),
      ]);
      setLeaves(Array.isArray(leaveRes.data) ? leaveRes.data : []);
      setRegularizations(Array.isArray(regRes.data) ? regRes.data : []);
    } catch (err) {
      console.error('Failed to load admin leaves & regularizations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleOpenAction = (type, item, targetStatus) => {
    const targetId = type === 'leave' ? (item.leaveRequestId || item.id) : (item.regRequestId || item.id);
    setActionError('');
    setActionModal({
      show: true,
      type,
      id: targetId,
      item,
      targetStatus,
      comment: '',
      title: `${targetStatus === 'APPROVED' ? 'Approve' : 'Reject'} ${
        type === 'leave' ? `Leave for ${item.employeeName}` : `Regularization for ${item.employeeName}`
      }`,
    });
  };

  const handleConfirmAction = async (e) => {
    e.preventDefault();
    try {
      setActionSubmitting(true);
      setActionError('');
      const targetId = actionModal.id;
      if (actionModal.type === 'leave') {
        if (actionModal.targetStatus === 'APPROVED') {
          await adminLeavesApi.approveLeave(targetId, actionModal.comment || undefined);
        } else {
          await adminLeavesApi.rejectLeave(targetId, actionModal.comment || undefined);
        }
      } else {
        if (actionModal.targetStatus === 'APPROVED') {
          await adminLeavesApi.approveRegularization(targetId, actionModal.comment || undefined);
        } else {
          await adminLeavesApi.rejectRegularization(targetId, actionModal.comment || undefined);
        }
      }
      setActionModal({ show: false, type: 'leave', id: null, targetStatus: '', comment: '', title: '' });
      setToastMsg(`Request marked as ${actionModal.targetStatus} successfully.`);
      await fetchData();
      setTimeout(() => setToastMsg(''), 4000);
    } catch (err) {
      const errorText = err.response?.data?.detail || err.response?.data?.message || 'Failed to update request.';
      setActionError(errorText);
      alert(errorText);
    } finally {
      setActionSubmitting(false);
    }
  };

  const filteredLeaves = (Array.isArray(leaves) ? leaves : []).filter(
    (l) =>
      l.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      l.employeeId?.toLowerCase().includes(search.toLowerCase()) ||
      l.department?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRegs = (Array.isArray(regularizations) ? regularizations : []).filter(
    (r) =>
      r.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Leaves & Attendance Regularization Review
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Approve employee time-off applications and resolve missed biometric punch requests
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('leaves')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'leaves' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Leave Requests ({leaves.filter((l) => l.status === 'PENDING').length} Pending)</span>
          </button>

          <button
            onClick={() => setActiveTab('regularization')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'regularization' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Regularizations ({regularizations.filter((r) => r.status === 'PENDING').length} Pending)</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
          >
            <option value="All">Status: All</option>
            <option value="PENDING">Pending Only</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* TAB 1: LEAVE REQUESTS */}
      {activeTab === 'leaves' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-6">Employee</th>
                <th className="py-3.5 px-4">Leave Type</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-4">Reason</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading leave requests...
                  </td>
                </tr>
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No leave requests matching filter.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => {
                  let badge = 'bg-amber-100 text-amber-800';
                  if (leave.status === 'APPROVED') badge = 'bg-emerald-100 text-emerald-800';
                  else if (leave.status === 'REJECTED') badge = 'bg-rose-100 text-rose-800';

                  return (
                    <tr key={leave.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-900">{leave.employeeName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {leave.employeeId} • {leave.department}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{leave.leaveType}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {leave.fromDate} → {leave.toDate}
                        </div>
                        <div className="text-[10px] text-slate-400">{leave.totalDays} Day(s)</div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">{leave.reason}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {leave.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenAction('leave', leave, 'APPROVED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleOpenAction('leave', leave, 'REJECTED')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-semibold">
                            Reviewed by {leave.reviewedBy || 'Admin'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: REGULARIZATION REQUESTS */}
      {activeTab === 'regularization' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-6">Employee</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Requested Times</th>
                <th className="py-3.5 px-4">Reason</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading regularization requests...
                  </td>
                </tr>
              ) : filteredRegs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No regularization requests matching filter.
                  </td>
                </tr>
              ) : (
                filteredRegs.map((reg) => {
                  let badge = 'bg-amber-100 text-amber-800';
                  if (reg.status === 'APPROVED') badge = 'bg-emerald-100 text-emerald-800';
                  else if (reg.status === 'REJECTED') badge = 'bg-rose-100 text-rose-800';

                  return (
                    <tr key={reg.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-900">{reg.employeeName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {reg.employeeId} • {reg.department}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{reg.date}</td>
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-semibold text-slate-900">
                          IN: {reg.requestedInTime} • OUT: {reg.requestedOutTime}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">{reg.reason}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge}`}>
                          {reg.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        {reg.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenAction('reg', reg, 'APPROVED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleOpenAction('reg', reg, 'REJECTED')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-semibold">
                            Reviewed by {reg.reviewedBy || 'Admin'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {actionModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">{actionModal.title}</h3>
              <button
                onClick={() => setActionModal({ ...actionModal, show: false })}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmAction} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Admin Feedback / Remarks (Optional)</label>
                <textarea
                  rows={3}
                  value={actionModal.comment}
                  onChange={(e) => setActionModal({ ...actionModal, comment: e.target.value })}
                  placeholder="Add note for employee..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionModal({ ...actionModal, show: false })}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className={`px-5 py-2 font-bold text-white rounded-xl shadow-xs transition disabled:opacity-50 ${
                    actionModal.targetStatus === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {actionSubmitting ? 'Processing...' : `Confirm ${actionModal.targetStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
