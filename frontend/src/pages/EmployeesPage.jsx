import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Camera,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Eye,
  X,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Calendar as CalendarIcon,
  Phone,
  Mail,
  Briefcase,
  ChevronRight,
} from 'lucide-react';
import { employeeApi, settingsApi } from '../services/api';

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

export const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeProfileData, setEmployeeProfileData] = useState(null);
  const [shifts, setShifts] = useState([]);

  // Form states
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    department: 'Engineering',
    designation: '',
    email: '',
    mobile: '',
    shiftId: 'shift_general',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'Active',
  });
  const [formError, setFormError] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Face registration modal states
  const [faceAngle, setFaceAngle] = useState('front');
  const [capturedImages, setCapturedImages] = useState([]);
  const [faceUploading, setFaceUploading] = useState(false);
  const [faceSuccessMsg, setFaceSuccessMsg] = useState('');
  const [faceErrorMsg, setFaceErrorMsg] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await employeeApi.getAll({
        search,
        department: selectedDept,
        status: selectedStatus,
      });
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchShifts = async () => {
    try {
      const res = await settingsApi.getShifts();
      setShifts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load shifts:', err);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchShifts();
  }, [search, selectedDept, selectedStatus]);

  const handleOpenAdd = () => {
    const nextId = `EMP${String(employees.length + 1).padStart(3, '0')}`;
    setFormData({
      employeeId: nextId,
      name: '',
      department: 'Engineering',
      designation: '',
      email: '',
      mobile: '',
      shiftId: shifts[0]?.id || 'shift_general',
      joiningDate: new Date().toISOString().split('T')[0],
      status: 'Active',
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      setFormSubmitting(true);
      setFormError('');
      await employeeApi.create(formData);
      setShowAddModal(false);
      fetchEmployees();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create employee.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenEdit = (emp) => {
    setSelectedEmployee(emp);
    setFormData({
      employeeId: emp.employeeId,
      name: emp.name,
      department: emp.department,
      designation: emp.designation,
      email: emp.email,
      mobile: emp.mobile,
      shiftId: emp.shiftId || 'shift_general',
      joiningDate: emp.joiningDate || '',
      status: emp.status || 'Active',
    });
    setShowEditModal(true);
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    try {
      setFormSubmitting(true);
      await employeeApi.update(selectedEmployee.employeeId, formData);
      setShowEditModal(false);
      fetchEmployees();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to update employee.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (emp) => {
    if (window.confirm(`Are you sure you want to delete ${emp.name} (${emp.employeeId}) and their face biometric data?`)) {
      try {
        await employeeApi.delete(emp.employeeId);
        fetchEmployees();
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to delete employee.');
      }
    }
  };

  const handleOpenProfile = async (emp) => {
    setSelectedEmployee(emp);
    setShowProfileModal(true);
    try {
      const res = await employeeApi.getById(emp.employeeId);
      setEmployeeProfileData(res.data);
    } catch (err) {
      console.error('Error fetching employee profile:', err);
    }
  };

  // ================= FACE REGISTRATION CAMERA =================
  const handleOpenFaceModal = (emp) => {
    setSelectedEmployee(emp);
    setCapturedImages([]);
    setFaceSuccessMsg('');
    setFaceErrorMsg('');
    setShowFaceModal(true);
    startWebcam();
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('Webcam access error:', err);
      setCameraActive(false);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImages((prev) => [...prev, { dataUrl, angle: faceAngle }]);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImages((prev) => [...prev, { dataUrl: event.target.result, angle: faceAngle }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeCaptured = (idx) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitFaceEmbeddings = async () => {
    if (capturedImages.length === 0) return;
    try {
      setFaceUploading(true);
      setFaceSuccessMsg('');
      setFaceErrorMsg('');

      const formData = new FormData();
      formData.append('base64Images', JSON.stringify(capturedImages.map((c) => c.dataUrl)));
      formData.append('angleLabels', JSON.stringify(capturedImages.map((c) => c.angle)));

      const res = await employeeApi.uploadFaces(selectedEmployee.employeeId, formData);
      setFaceSuccessMsg(res.data.message);
      setCapturedImages([]);
      fetchEmployees();
      setTimeout(() => {
        stopWebcam();
        setShowFaceModal(false);
      }, 1500);
    } catch (err) {
      setFaceErrorMsg(err.response?.data?.detail || 'Failed to register face embeddings.');
    } finally {
      setFaceUploading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Employee Directory</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage employee profiles, shift assignments, and multi-angle face biometric registrations
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm shadow-blue-500/20 transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, employee ID, role, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                Dept: {dept}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="All">Status: All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-6">Employee</th>
                <th className="py-3.5 px-4">Department & Role</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Biometric Faces</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 text-sm">
                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading employees directory...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 text-sm">
                    No employees matching the search filters found.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-50/70 transition">
                    {/* Employee Profile Cell */}
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={emp.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name || 'Staff')}&background=2563EB&color=fff`}
                          alt={emp.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                        />
                        <div>
                          <div className="font-bold text-slate-900 leading-tight">{emp.name}</div>
                          <span className="text-xs font-mono font-semibold text-blue-600">{emp.employeeId}</span>
                        </div>
                      </div>
                    </td>

                    {/* Department & Role */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 text-xs">{emp.department}</div>
                      <div className="text-[11px] text-slate-500">{emp.designation}</div>
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs text-slate-700">{emp.email}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{emp.mobile}</div>
                    </td>

                    {/* Biometric Faces Count */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleOpenFaceModal(emp)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                          emp.faceCount > 0
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{emp.faceCount || 0} Registered</span>
                      </button>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          emp.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenProfile(emp)}
                          title="View Attendance & Profile"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenFaceModal(emp)}
                          title="Capture / Register Face Angles"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          title="Edit Details"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp)}
                          title="Delete Employee"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: ADD / EDIT EMPLOYEE ================= */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {showAddModal ? 'Register New Employee' : 'Edit Employee Profile'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={showAddModal ? handleCreateEmployee : handleUpdateEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    disabled={showEditModal}
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    {DEPARTMENTS.filter((d) => d !== 'All').map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Shift Schedule</label>
                  <select
                    value={formData.shiftId}
                    onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.startTime} - {s.endTime})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : showAddModal ? 'Register Employee' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: FACE BIOMETRIC REGISTRATION ================= */}
      {showFaceModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Biometric Face Enrollment — {selectedEmployee.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Employee ID: {selectedEmployee.employeeId} | Department: {selectedEmployee.department}
                </p>
              </div>
              <button
                onClick={() => {
                  stopWebcam();
                  setShowFaceModal(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {faceSuccessMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{faceSuccessMsg}</span>
              </div>
            )}

            {faceErrorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{faceErrorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Webcam Preview & Angle Controls */}
              <div className="space-y-3">
                <div className="relative aspect-4/3 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
                  <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />

                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-4 text-center">
                      <Camera className="w-8 h-8 text-slate-400 mb-2" />
                      <p className="text-xs text-slate-300">Camera preview not active or permission pending.</p>
                      <button
                        type="button"
                        onClick={startWebcam}
                        className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                      >
                        Start Camera
                      </button>
                    </div>
                  )}

                  {/* Face Guide Oval */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-40 h-52 border-2 border-dashed border-blue-400/70 rounded-full" />
                  </div>
                </div>

                {/* Angle selector */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Current Pose Angle:</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['front', 'left_angle', 'right_angle', 'smile'].map((ang) => (
                      <button
                        key={ang}
                        type="button"
                        onClick={() => setFaceAngle(ang)}
                        className={`py-1 px-1.5 rounded-lg text-[10px] font-bold uppercase transition ${
                          faceAngle === ang
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {ang.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={!cameraActive}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capture Snapshot</span>
                  </button>

                  <label className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-200">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Captured frames queue */}
              <div className="flex flex-col justify-between border border-slate-200 rounded-xl p-3 bg-slate-50/60">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">
                    Enrolled Captures ({capturedImages.length})
                  </h4>
                  {capturedImages.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No snapshots captured yet. Take multiple angle photos (front, left, right) for high biometric accuracy.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                      {capturedImages.map((cap, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-300">
                          <img src={cap.dataUrl} alt={`cap-${idx}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[9px] text-center font-mono py-0.5 uppercase">
                            {cap.angle}
                          </span>
                          <button
                            onClick={() => removeCaptured(idx)}
                            className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px]"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={submitFaceEmbeddings}
                  disabled={faceUploading || capturedImages.length === 0}
                  className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {faceUploading
                      ? 'Generating FaceNet 512-D Embeddings...'
                      : `Save ${capturedImages.length} Biometric Face(s)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EMPLOYEE FULL PROFILE ================= */}
      {showProfileModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-4">
                <img
                  src={selectedEmployee.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmployee.name || 'Staff')}&background=2563EB&color=fff`}
                  alt={selectedEmployee.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 shadow-sm"
                />
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 leading-tight">{selectedEmployee.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      {selectedEmployee.employeeId}
                    </span>
                    <span>•</span>
                    <span>{selectedEmployee.department}</span>
                    <span>•</span>
                    <span>{selectedEmployee.designation}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile KPI Cards */}
            {employeeProfileData?.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-blue-700">Attendance Rate</div>
                  <div className="text-lg font-extrabold text-blue-900 mt-0.5">
                    {employeeProfileData.summary.attendancePercentage}%
                  </div>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-emerald-700">Full Days</div>
                  <div className="text-lg font-extrabold text-emerald-900 mt-0.5">
                    {employeeProfileData.summary.fullDays} Days
                  </div>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-amber-700">Late Days</div>
                  <div className="text-lg font-extrabold text-amber-900 mt-0.5">
                    {employeeProfileData.summary.lateDays} Days
                  </div>
                </div>
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                  <div className="text-[11px] font-semibold text-indigo-700">Avg Working Hours</div>
                  <div className="text-lg font-extrabold text-indigo-900 mt-0.5">
                    {employeeProfileData.summary.averageWorkingHours}
                  </div>
                </div>
              </div>
            )}

            {/* Attendance History */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-3">Recent 30-Day Attendance Records</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">First IN</th>
                      <th className="py-2.5 px-4">Last OUT</th>
                      <th className="py-2.5 px-4">Sessions</th>
                      <th className="py-2.5 px-4">Working Time</th>
                      <th className="py-2.5 px-4">Outside Time</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeProfileData?.recentAttendance?.map((rec, i) => {
                      const sessionCount = rec.totalSessions || rec.sessions?.length || (rec.inTime ? 1 : 0);
                      return (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="py-2 px-4 font-mono font-medium">{rec.date}</td>
                          <td className="py-2 px-4 font-mono font-bold text-emerald-700">{rec.firstIn || rec.inTime || '--'}</td>
                          <td className="py-2 px-4 font-mono font-bold text-indigo-700">{rec.lastOut || rec.outTime || '--'}</td>
                          <td className="py-2 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px]">
                              {sessionCount} {sessionCount === 1 ? 'Session' : 'Sessions'}
                            </span>
                          </td>
                          <td className="py-2 px-4 font-mono font-extrabold text-blue-900">{rec.workingDuration || rec.totalWorkingHours || '0h 0m'}</td>
                          <td className="py-2 px-4 font-mono text-slate-500 font-semibold">{rec.totalOutsideHours || '0h 0m'}</td>
                          <td className="py-2 px-4">
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
                                  : rec.status === 'ABSENT'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
