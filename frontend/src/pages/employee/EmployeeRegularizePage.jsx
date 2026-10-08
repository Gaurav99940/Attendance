import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  X,
} from 'lucide-react';
import { portalApi } from '../../services/api';

export const EmployeeRegularizePage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    requestedInTime: '09:00 AM',
    requestedOutTime: '05:00 PM',
    reason: '',
  });

  const fetchRegularizations = async () => {
    try {
      setLoading(true);
      const res = await portalApi.getRegularizations();
      setRequests(res.data);
    } catch (err) {
      console.error('Failed to load regularizations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegularizations();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg('');
      const res = await portalApi.applyRegularization(formData);
      setSuccessMsg(res.data.message);
      setShowModal(false);
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        requestedInTime: '09:00 AM',
        requestedOutTime: '05:00 PM',
        reason: '',
      });
      fetchRegularizations();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit regularization.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Attendance Regularization</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Request correction for missed punches, offsite work meetings, or camera detection issues
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Regularization Request</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Info card */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-start gap-3 text-xs text-blue-900">
        <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">When to use Attendance Regularization?</span>
          <span className="text-blue-700 leading-relaxed block mt-0.5">
            If you were in office but missed camera detection, or were visiting clients for official duty, submit this request. Once approved by Admin/HR, your attendance record will update automatically!
          </span>
        </div>
      </div>

      {/* Request History */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
        <h3 className="text-base font-bold text-slate-900 mb-4">Past Regularization Requests</h3>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading regularization records...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No regularization requests filed yet.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((reg) => {
              let badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
              let StatusIcon = Clock;
              if (reg.status === 'APPROVED') {
                badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                StatusIcon = CheckCircle2;
              } else if (reg.status === 'REJECTED') {
                badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                StatusIcon = XCircle;
              }

              return (
                <div
                  key={reg.id}
                  className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">Date: {reg.date}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${badgeColor}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{reg.status}</span>
                      </span>
                    </div>

                    <div className="text-slate-600 font-medium font-mono">
                      Requested IN: <b className="text-slate-900">{reg.requestedInTime}</b> • Requested OUT:{' '}
                      <b className="text-slate-900">{reg.requestedOutTime}</b>
                    </div>

                    <div className="text-slate-500">
                      <span className="text-slate-400 font-semibold">Reason:</span> {reg.reason}
                    </div>

                    {reg.adminComment && (
                      <div className="text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded-lg text-[11px] font-semibold mt-1">
                        Admin Feedback: {reg.adminComment}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Attendance Regularization Form</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Date of Missed Punch *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Requested IN Time *</label>
                  <input
                    type="text"
                    required
                    value={formData.requestedInTime}
                    onChange={(e) => setFormData({ ...formData, requestedInTime: e.target.value })}
                    placeholder="09:00 AM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Requested OUT Time *</label>
                  <input
                    type="text"
                    required
                    value={formData.requestedOutTime}
                    onChange={(e) => setFormData({ ...formData, requestedOutTime: e.target.value })}
                    placeholder="05:00 PM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason / Explanation *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g. Camera was offline at Gate 1 / On-site client meeting at Cyber City..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
