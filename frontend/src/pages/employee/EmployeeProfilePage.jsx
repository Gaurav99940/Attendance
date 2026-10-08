import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Camera,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Upload,
  Lock,
} from 'lucide-react';
import { portalApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const EmployeeProfilePage = () => {
  const { user, updateUserProfile } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Password Change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // Camera & Face Enrollment
  const [cameraActive, setCameraActive] = useState(false);
  const [faceAngle, setFaceAngle] = useState('front');
  const [capturedImages, setCapturedImages] = useState([]);
  const [faceUploading, setFaceUploading] = useState(false);
  const [faceSuccessMsg, setFaceSuccessMsg] = useState('');
  const [faceErrorMsg, setFaceErrorMsg] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await portalApi.getMe();
      setProfileData(res.data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    return () => {
      stopWebcam();
    };
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdError('');
    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }
    try {
      setPwdLoading(true);
      const res = await portalApi.changePassword({ oldPassword, newPassword });
      setPwdMsg(res.data.message);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwdMsg(''), 4000);
    } catch (err) {
      setPwdError(err.response?.data?.detail || 'Failed to update password.');
    } finally {
      setPwdLoading(false);
    }
  };

  // Face enrollment webcam logic
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
      setFaceErrorMsg('Cannot access camera: ' + err.message);
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

  const captureSnapshot = () => {
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

  const submitBiometrics = async () => {
    if (capturedImages.length === 0) return;
    try {
      setFaceUploading(true);
      setFaceSuccessMsg('');
      setFaceErrorMsg('');

      const formData = new FormData();
      formData.append('base64Images', JSON.stringify(capturedImages.map((c) => c.dataUrl)));
      formData.append('angleLabels', JSON.stringify(capturedImages.map((c) => c.angle)));

      const res = await portalApi.registerFace(formData);
      setFaceSuccessMsg(res.data.message);
      setCapturedImages([]);
      stopWebcam();
      fetchProfile();
      setTimeout(() => setFaceSuccessMsg(''), 4000);
    } catch (err) {
      setFaceErrorMsg(err.response?.data?.detail || 'Failed to register face biometrics.');
    } finally {
      setFaceUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={profileData?.employee?.profilePhoto || user?.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Staff')}&background=2563EB&color=fff`}
            alt="Profile"
            className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 shadow-sm"
          />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {profileData?.employee?.name || user?.name}
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {profileData?.employee?.department} • {profileData?.employee?.designation} • ID:{' '}
              <span className="font-mono font-bold text-blue-600">{user?.employeeId}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <span>Employee Information</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-400">Employee ID</span>
              <span className="font-mono font-bold text-slate-900">{profileData?.employee?.employeeId}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-400">Official Email</span>
              <span className="font-bold text-slate-900">{profileData?.employee?.email}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-400">Contact Number</span>
              <span className="font-mono font-bold text-slate-900">{profileData?.employee?.mobile}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-400">Department</span>
              <span className="font-bold text-slate-900">{profileData?.employee?.department}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-400">Designation / Role</span>
              <span className="font-bold text-slate-900">{profileData?.employee?.designation}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-slate-400">Date of Joining</span>
              <span className="font-bold text-slate-900">{profileData?.employee?.joiningDate || '—'}</span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-600" />
            <span>Update Account Password</span>
          </h3>

          {pwdMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{pwdMsg}</span>
            </div>
          )}

          {pwdError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pwdError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Current Password (optional if default)</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">New Password *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 4 characters"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={pwdLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {pwdLoading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </div>

      {/* BIOMETRIC FACE SELF-REGISTRATION */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              <span>Biometric Face Self-Enrollment</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enrolled faces: <b className="text-slate-800">{profileData?.faceCount || 0} Registered</b>. You can register extra angles to improve gate recognition speed.
            </p>
          </div>

          {!cameraActive ? (
            <button
              onClick={startWebcam}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Start Camera for Enrollment</span>
            </button>
          ) : (
            <button
              onClick={stopWebcam}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Stop Camera
            </button>
          )}
        </div>

        {faceSuccessMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{faceSuccessMsg}</span>
          </div>
        )}

        {faceErrorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{faceErrorMsg}</span>
          </div>
        )}

        {cameraActive && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-3">
              <div className="relative aspect-4/3 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* Face Guide Oval */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-36 h-48 border-2 border-dashed border-blue-400/80 rounded-full" />
                </div>
              </div>

              {/* Angle selector */}
              <div>
                <span className="text-[11px] font-bold text-slate-600 block mb-1">Select Pose Angle:</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {['front', 'left_angle', 'right_angle', 'smile'].map((ang) => (
                    <button
                      key={ang}
                      type="button"
                      onClick={() => setFaceAngle(ang)}
                      className={`py-1 px-1 rounded-lg text-[10px] font-bold uppercase transition ${
                        faceAngle === ang ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {ang.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={captureSnapshot}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Capture Snapshot ({faceAngle})</span>
              </button>
            </div>

            {/* Captured Queue */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">
                  Captured Snapshots ({capturedImages.length})
                </h4>
                {capturedImages.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No snapshots captured yet. Position your face inside the guide and click 'Capture Snapshot'.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {capturedImages.map((cap, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-300">
                        <img src={cap.dataUrl} alt={`cap-${idx}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[9px] text-center font-mono py-0.5 uppercase">
                          {cap.angle}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={submitBiometrics}
                disabled={faceUploading || capturedImages.length === 0}
                className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{faceUploading ? 'Generating FaceNet Embeddings...' : `Save ${capturedImages.length} Face(s)`}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
