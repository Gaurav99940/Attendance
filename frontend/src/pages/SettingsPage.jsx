import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Clock,
  Camera,
  Sliders,
  Save,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Database,
  Server,
  Link,
  Globe,
  Activity,
  Eye,
  EyeOff,
} from 'lucide-react';
import { settingsApi, cameraApi } from '../services/api';

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('database');
  const [settings, setSettings] = useState({
    faceConfidenceThreshold: 0.62,
    detectionCooldownSeconds: 20,
    sessionTimeoutMinutes: 480,
    organizationName: 'SmartCorp Technologies Pvt Ltd',
    timeZone: 'Asia/Kolkata',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '12 Hours (AM/PM)',
    cameraSources: [],
  });

  const [shifts, setShifts] = useState([]);
  const [dbStatus, setDbStatus] = useState(null);
  const [mongoUriInput, setMongoUriInput] = useState('');
  const [mongoDbNameInput, setMongoDbNameInput] = useState('smart_attendance');
  const [connectingMongo, setConnectingMongo] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Camera Testing
  const [testingCamera, setTestingCamera] = useState(false);
  const [cameraTestResult, setCameraTestResult] = useState(null);
  const [previewSnapshot, setPreviewSnapshot] = useState(false);
  const [snapshotTimestamp, setSnapshotTimestamp] = useState(Date.now());

  // Shift Modal
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    id: '',
    name: '',
    startTime: '10:30 AM',
    endTime: '06:00 PM',
    requiredWorkingMinutes: 450,
    fullDayMinimumMinutes: 420,
    halfDayMinimumMinutes: 225,
    earlyExitGraceMinutes: 15,
    lateGraceMinutes: 15,
    overtimeThreshold: 480,
    department: 'All',
    active: true,
  });

  useEffect(() => {
    fetchSettingsAndShifts();
    fetchDbStatus();
  }, []);

  const fetchSettingsAndShifts = async () => {
    try {
      setLoading(true);
      const [setRes, shiftRes] = await Promise.all([
        settingsApi.getSettings(),
        settingsApi.getShifts(),
      ]);
      setSettings(setRes.data);
      setShifts(shiftRes.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDbStatus = async () => {
    try {
      const res = await settingsApi.getDatabaseStatus();
      setDbStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch DB status:', err);
    }
  };

  const handleConnectMongo = async (e) => {
    e.preventDefault();
    if (!mongoUriInput) return;
    try {
      setConnectingMongo(true);
      setErrorMsg('');
      setSuccessMsg('');
      const res = await settingsApi.connectMongoDB({
        uri: mongoUriInput,
        dbName: mongoDbNameInput || 'smart_attendance',
      });
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        fetchDbStatus();
      } else {
        setErrorMsg(res.data.message + ' ' + (res.data.details || ''));
      }
    } catch (err) {
      setErrorMsg('Failed to connect to MongoDB: ' + (err.response?.data?.detail || err.message));
    } finally {
      setConnectingMongo(false);
    }
  };

  const handleClearDemoData = async () => {
    if (
      window.confirm(
        'Are you sure you want to remove all demo employees and records? You will be able to manually add your real staff.'
      )
    ) {
      try {
        setSaving(true);
        const res = await settingsApi.clearDemo();
        setSuccessMsg(res.data.message || 'All demo records successfully wiped.');
        fetchDbStatus();
      } catch (err) {
        alert('Failed to clear demo data.');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await settingsApi.updateSettings(settings);
      setSuccessMsg('Settings updated and applied successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddShift = () => {
    setEditingShift(null);
    setShiftForm({
      id: `shift_${Date.now().toString(36)}`,
      name: '',
      startTime: '10:30 AM',
      endTime: '06:00 PM',
      requiredWorkingMinutes: 450,
      fullDayMinimumMinutes: 420,
      halfDayMinimumMinutes: 225,
      earlyExitGraceMinutes: 15,
      lateGraceMinutes: 15,
      overtimeThreshold: 480,
      department: 'All',
      active: true,
    });
    setShowShiftModal(true);
  };

  const handleOpenEditShift = (shift) => {
    setEditingShift(shift);
    setShiftForm({ ...shift });
    setShowShiftModal(true);
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    try {
      if (editingShift) {
        await settingsApi.updateShift(editingShift.id, shiftForm);
      } else {
        await settingsApi.createShift(shiftForm);
      }
      setShowShiftModal(false);
      const shiftRes = await settingsApi.getShifts();
      setShifts(shiftRes.data);
    } catch (err) {
      alert('Failed to save shift.');
    }
  };

  const handleDeleteShift = async (id) => {
    if (window.confirm('Are you sure you want to delete this shift schedule?')) {
      try {
        await settingsApi.deleteShift(id);
        const shiftRes = await settingsApi.getShifts();
        setShifts(shiftRes.data);
      } catch (err) {
        alert('Failed to delete shift.');
      }
    }
  };

  const handleTestGateCamera = async () => {
    try {
      setTestingCamera(true);
      setCameraTestResult(null);
      const res = await cameraApi.testConnection();
      setCameraTestResult(res.data);
      if (res.data.success) {
        setSnapshotTimestamp(Date.now());
      }
    } catch (err) {
      setCameraTestResult({
        success: false,
        status: 'OFFLINE',
        message: 'Connection failed: ' + (err.response?.data?.detail || err.message),
        error: err.message,
      });
    } finally {
      setTestingCamera(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Platform Configuration</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage MongoDB storage, shift rules, grace periods, biometric thresholds, and camera feeds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearDemoData}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer border border-rose-200"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Wipe Demo Data (Clean Database)</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1 overflow-x-auto">
        {[
          { id: 'database', label: 'MongoDB Connection & Storage', icon: Database },
          { id: 'rules', label: 'Shifts & Attendance Rules', icon: Clock },
          { id: 'vision', label: 'Face Recognition Parameters', icon: Sliders },
          { id: 'camera', label: 'Camera Devices', icon: Camera },
          { id: 'system', label: 'Organization & System', icon: SettingsIcon },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === t.id ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 0: MONGODB DATABASE CONFIGURATION */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Current Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Database Engine & Storage Status</h3>
                <p className="text-xs text-slate-400">
                  Real-time status of your MongoDB database or embedded persistence store.
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  dbStatus?.isLiveMongo
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    dbStatus?.isLiveMongo ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'
                  }`}
                />
                {dbStatus?.mode || 'Local Storage'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 block">Registered Employees</span>
                <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
                  {dbStatus?.employeesCount ?? 0}
                </span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 block">Attendance Records</span>
                <span className="text-2xl font-extrabold text-blue-600 mt-1 block">
                  {dbStatus?.attendanceRecordsCount ?? 0}
                </span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 block">Biometric Face Embeddings</span>
                <span className="text-2xl font-extrabold text-indigo-600 mt-1 block">
                  {dbStatus?.faceEmbeddingsCount ?? 0}
                </span>
              </div>
            </div>

            {/* MongoDB Atlas Connection Form */}
            <form onSubmit={handleConnectMongo} className="border-t border-slate-100 pt-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-900">Connect to MongoDB Atlas / Remote Cluster</h4>
              <p className="text-xs text-slate-500">
                Enter your MongoDB Atlas Connection String (`mongodb+srv://...`) or local MongoDB URI.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">MongoDB Connection URI *</label>
                  <input
                    type="text"
                    required
                    placeholder="mongodb+srv://username:password@cluster0.mongodb.net/?retryWrites=true&w=majority"
                    value={mongoUriInput}
                    onChange={(e) => setMongoUriInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Database Name</label>
                  <input
                    type="text"
                    value={mongoDbNameInput}
                    onChange={(e) => setMongoDbNameInput(e.target.value)}
                    placeholder="smart_attendance"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={connectingMongo || !mongoUriInput}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <Link className="w-4 h-4" />
                  <span>{connectingMongo ? 'Testing & Connecting...' : 'Connect MongoDB Atlas'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 1: SHIFTS & ATTENDANCE RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Configured Work Shifts</h3>
                <p className="text-xs text-slate-400">
                  Defines shift start/end, late grace periods, early exit tolerances, and minimum full/half day durations.
                </p>
              </div>
              <button
                onClick={handleOpenAddShift}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Shift</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shifts.map((s) => (
                <div key={s.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-900">{s.name}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        Dept: {s.department || 'All'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-600 mt-3">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Timings</span>
                        <b className="text-slate-900">{s.startTime} → {s.endTime}</b>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Required Duration</span>
                        <b className="text-slate-900">{s.requiredWorkingMinutes / 60} Hours</b>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Full Day Min</span>
                        <b className="text-emerald-700">{s.fullDayMinimumMinutes} Mins ({(s.fullDayMinimumMinutes / 60).toFixed(1)}h)</b>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Half Day Min</span>
                        <b className="text-orange-700">{s.halfDayMinimumMinutes} Mins ({(s.halfDayMinimumMinutes / 60).toFixed(1)}h)</b>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Late Grace Period</span>
                        <b className="text-amber-700">{s.lateGraceMinutes} Minutes</b>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Early Exit Grace</span>
                        <b className="text-indigo-700">{s.earlyExitGraceMinutes} Minutes</b>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-200">
                    <button
                      onClick={() => handleOpenEditShift(s)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteShift(s.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FACE RECOGNITION PARAMETERS */}
      {activeTab === 'vision' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">AI Computer Vision Thresholds</h3>
            <p className="text-xs text-slate-400">
              Tune cosine similarity verification thresholds, duplicate prevention cooldowns, and session lifetimes.
            </p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Recognition Confidence Threshold</span>
                <span className="font-mono text-blue-600 font-extrabold">
                  {Math.round(settings.faceConfidenceThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.45"
                max="0.85"
                step="0.01"
                value={settings.faceConfidenceThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, faceConfidenceThreshold: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Cosine similarity threshold for PyTorch FaceNet. Recommended value: 62% - 68%.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Detection Cooldown Window (Seconds)
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={settings.detectionCooldownSeconds}
                onChange={(e) =>
                  setSettings({ ...settings, detectionCooldownSeconds: parseInt(e.target.value) || 20 })
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Vision Parameters'}</span>
          </button>
        </form>
      )}

      {/* TAB 3: CAMERA DEVICES */}
      {activeTab === 'camera' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Registered Attendance Camera Sources</h3>
              <p className="text-xs text-slate-400">
                Configure and test biometric capture endpoints: Browser Webcam and Company Gate IP Camera.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Camera 1: Local Webcam */}
              <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Local Webcam / Terminal</h4>
                        <span className="text-[11px] text-slate-500 font-mono">ID: cam_main • Type: WEBCAM</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      READY
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Location:</span>
                      <span className="font-semibold">Front Desk / Computer</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Capture Method:</span>
                      <span className="font-semibold font-mono">Browser MediaDevices API</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Inference Rate:</span>
                      <span className="font-semibold font-mono">~650 ms</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                  <span>Used on Live Attendance page</span>
                  <span className="font-bold text-blue-600">Built-in</span>
                </div>
              </div>

              {/* Camera 2: Company Gate IP Camera */}
              <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Company Gate IP Camera</h4>
                        <span className="text-[11px] text-slate-500 font-mono">ID: CAM_GATE_01 • Type: IP_CAMERA</span>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                        cameraTestResult?.status === 'OFFLINE'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {cameraTestResult ? cameraTestResult.status : 'ONLINE'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 bg-white p-3 rounded-xl border border-blue-100">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Location:</span>
                      <span className="font-semibold">Main Gate Reception</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Camera Server URL:</span>
                      <span className="font-semibold font-mono text-blue-600">http://143.244.140.108:10000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">MJPEG Stream Gateway:</span>
                      <span className="font-semibold font-mono">/api/camera/stream/CAM_GATE_01</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestGateCamera}
                    disabled={testingCamera}
                    className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Activity className={`w-3.5 h-3.5 ${testingCamera ? 'animate-spin' : ''}`} />
                    <span>{testingCamera ? 'Testing Link...' : 'Test Connection'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSnapshot(!previewSnapshot);
                      if (!previewSnapshot) setSnapshotTimestamp(Date.now());
                    }}
                    className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {previewSnapshot ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{previewSnapshot ? 'Hide Preview' : 'Live Snapshot'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Test Connection Result Box */}
            {cameraTestResult && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 animate-scale-up ${
                  cameraTestResult.success
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    {cameraTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{cameraTestResult.message}</span>
                  </div>
                  {cameraTestResult.latencyMs && (
                    <span className="font-mono bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-700">
                      Ping: {cameraTestResult.latencyMs} ms
                    </span>
                  )}
                </div>

                {cameraTestResult.success && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-2 border-t border-emerald-200/60 font-mono">
                    <div>
                      <span className="text-emerald-700 font-sans">Frame Dimensions: </span>
                      <strong>{cameraTestResult.frameSize || '320x240'}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-700 font-sans">Latest File: </span>
                      <strong>{cameraTestResult.latestFile || '/uploads/E_*.jpg'}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-700 font-sans">Tested At: </span>
                      <strong>{new Date().toLocaleTimeString()}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Live Gate Snapshot Preview Modal / Card */}
            {previewSnapshot && (
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold">Live Snapshot from Main Gate (143.244.140.108:10000)</span>
                  </div>
                  <button
                    onClick={() => setSnapshotTimestamp(Date.now())}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh Snapshot</span>
                  </button>
                </div>

                <div className="aspect-16/9 max-h-72 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                  <img
                    src={`${cameraApi.getFrameUrl('CAM_GATE_01')}?_t=${snapshotTimestamp}`}
                    alt="Main Gate Snapshot"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.alt = 'Snapshot unavailable';
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM & ORGANIZATION */}
      {activeTab === 'system' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Enterprise Settings</h3>
            <p className="text-xs text-slate-400">Company branding, timezones, and display preferences.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Organization Name</label>
              <input
                type="text"
                value={settings.organizationName}
                onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Default Timezone</label>
              <input
                type="text"
                value={settings.timeZone}
                onChange={(e) => setSettings({ ...settings, timeZone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Organization Settings'}</span>
          </button>
        </form>
      )}

      {/* Shift Edit / Create Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingShift ? 'Edit Shift Timing & Rules' : 'Create New Shift'}
              </h3>
              <button onClick={() => setShowShiftModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Shift Name *</label>
                <input
                  type="text"
                  required
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  placeholder="e.g. General Day Shift"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Start Time (Expected IN)</label>
                  <input
                    type="text"
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    placeholder="10:30 AM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">End Time (Expected OUT)</label>
                  <input
                    type="text"
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    placeholder="06:00 PM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Late Grace Period (Mins)</label>
                  <input
                    type="number"
                    value={shiftForm.lateGraceMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, lateGraceMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Early Exit Grace (Mins)</label>
                  <input
                    type="number"
                    value={shiftForm.earlyExitGraceMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, earlyExitGraceMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Full Day Min (Mins)</label>
                  <input
                    type="number"
                    value={shiftForm.fullDayMinimumMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, fullDayMinimumMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Half Day Min (Mins)</label>
                  <input
                    type="number"
                    value={shiftForm.halfDayMinimumMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, halfDayMinimumMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
