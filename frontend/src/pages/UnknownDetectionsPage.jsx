import React, { useState, useEffect } from 'react';
import {
  UserX,
  Camera,
  Trash2,
  UserPlus,
  Clock,
  ShieldAlert,
  CheckCircle2,
  X,
  Sparkles,
} from 'lucide-react';
import { unknownApi, employeeApi } from '../services/api';

export const UnknownDetectionsPage = () => {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeesList, setEmployeesList] = useState([]);

  const [assignModal, setAssignModal] = useState(null); // detection object
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchUnknown = async () => {
    try {
      setLoading(true);
      const res = await unknownApi.getAll();
      setDetections(res.data);
    } catch (err) {
      console.error('Failed to load unknown detections:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await employeeApi.getAll();
      setEmployeesList(res.data);
      if (res.data.length > 0) {
        setSelectedEmpId(res.data[0].employeeId);
      }
    } catch (err) {
      console.error('Failed to load employees for assignment:', err);
    }
  };

  useEffect(() => {
    fetchUnknown();
    fetchEmployees();
  }, []);

  const handleDismiss = async (id) => {
    try {
      await unknownApi.dismiss(id);
      setDetections((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert('Failed to dismiss detection.');
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignModal || !selectedEmpId) return;
    try {
      setAssigning(true);
      const res = await unknownApi.assignToEmployee(assignModal.id, selectedEmpId);
      setSuccessMsg(res.data.message);
      setTimeout(() => {
        setAssignModal(null);
        setSuccessMsg('');
        fetchUnknown();
      }, 1200);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to assign face to employee.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Unknown Face Detections</h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {detections.length} Unassigned
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Faces detected by cameras with confidence below matching threshold. Review and enroll into staff profiles.
          </p>
        </div>

        <button
          onClick={fetchUnknown}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          Refresh Feed
        </button>
      </div>

      {/* Detections Gallery */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading unknown face gallery...
        </div>
      ) : detections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
          <ShieldAlert className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No Unknown Persons Detected</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            All detected faces in live camera feeds have been successfully recognized or resolved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {detections.map((det) => (
            <div
              key={det.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition"
            >
              <div className="relative aspect-square bg-slate-900 overflow-hidden">
                <img
                  src={det.capturedImage || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="%2394A3B8" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'}
                  alt="Unknown Face"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2.5 right-2.5 bg-rose-600/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Score: {det.confidence}%
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/90 to-transparent p-3 text-white text-xs">
                  <div className="font-mono text-[11px] font-bold">{new Date(det.detectedAt).toLocaleString()}</div>
                  <div className="text-[10px] text-slate-300">Camera: {det.cameraId}</div>
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 flex items-center justify-between gap-2 border-t border-slate-100">
                <button
                  onClick={() => setAssignModal(det)}
                  className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Assign to Staff</span>
                </button>

                <button
                  onClick={() => handleDismiss(det.id)}
                  title="Dismiss detection"
                  className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign to Employee Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Enroll Face Biometrics</h3>
              <button onClick={() => setAssignModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <img
                src={assignModal.capturedImage}
                alt="Face"
                className="w-16 h-16 rounded-xl object-cover border border-slate-300"
              />
              <div className="text-xs">
                <div className="font-bold text-slate-800">Unidentified Face Capture</div>
                <div className="text-slate-500 font-mono mt-0.5">{new Date(assignModal.detectedAt).toLocaleString()}</div>
                <div className="text-blue-600 font-semibold mt-0.5">Camera: {assignModal.cameraId}</div>
              </div>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Assign & Extract Embedding for Employee:
                </label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  {employeesList.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.name} ({emp.employeeId}) — {emp.department}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{assigning ? 'Generating Biometrics...' : 'Enroll Face'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
