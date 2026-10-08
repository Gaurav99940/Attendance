import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Video,
  Play,
  Square,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Maximize2,
  Globe,
  Radio,
  Zap,
  MapPin,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import { cameraApi, employeeApi, settingsApi } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';

export const LiveAttendancePage = () => {
  const { lastEvent } = useWebSocket();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [mode, setMode] = useState('AUTO'); // AUTO, IN_ONLY, OUT_ONLY
  const [confidenceThreshold, setConfidenceThreshold] = useState(62);
  const [cameraId, setCameraId] = useState('CAM_GATE_01'); // Default to Reception / Main Gate IP Camera
  const [camerasList, setCamerasList] = useState([
    {
      id: 'CAM_GATE_01',
      name: 'Reception / Main Gate Camera (IP Camera)',
      type: 'IP_CAMERA',
      location: 'Main Gate',
      url: 'http://143.244.140.108:10000',
      isOnline: true,
      status: 'ONLINE',
    },
    {
      id: 'cam_main',
      name: 'Local Webcam (Browser Cam)',
      type: 'WEBCAM',
      location: 'Front Desk / Terminal',
      isOnline: true,
      status: 'ONLINE',
    },
  ]);

  const [gateCamTesting, setGateCamTesting] = useState(false);
  const [gateCamStatus, setGateCamStatus] = useState(null);
  const [gateFrameTimestamp, setGateFrameTimestamp] = useState(Date.now());
  const [feedViewMode, setFeedViewMode] = useState('auto'); // 'auto', 'latest', 'daylight'

  const [detections, setDetections] = useState([]);
  const [detectionCount, setDetectionCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveStreamLogs, setLiveStreamLogs] = useState([]);

  // Simulation test tools
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedSimEmp, setSelectedSimEmp] = useState('');
  const [simulating, setSimulating] = useState(false);

  const videoRef = useRef(null);
  const gateImgRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  
  // Using activeRef to guarantee the loop NEVER dies or freezes
  const isLoopRunningRef = useRef(false);
  const timerRef = useRef(null);

  // Sync WebSocket attendance events into live ticker
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'ATTENDANCE_EVENT') {
      const eventTime = lastEvent.time || new Date().toLocaleTimeString();
      setLiveStreamLogs((prev) => {
        if (prev.length > 0 && prev[0].employeeId === lastEvent.employeeId && prev[0].event === lastEvent.event) {
          return prev;
        }
        return [
          {
            id: Date.now() + Math.random(),
            name: lastEvent.name,
            employeeId: lastEvent.employeeId,
            department: lastEvent.department || 'General',
            event: lastEvent.event,
            confidence: lastEvent.confidence || 98.5,
            time: eventTime,
            message: lastEvent.message,
            status: lastEvent.status,
            cameraLocation: lastEvent.cameraLocation || (lastEvent.cameraId === 'CAM_GATE_01' ? 'Main Gate' : 'Webcam'),
            cameraId: lastEvent.cameraId || 'cam_main',
          },
          ...prev.slice(0, 29),
        ];
      });
    }
  }, [lastEvent]);

  useEffect(() => {
    fetchInitialConfig();
    fetchEmployees();

    // Auto-start Gate Camera on page load for seamless continuous operation
    startGateCamera();

    return () => {
      stopCurrentCamera();
    };
  }, []);

  const handleCameraChange = (newCamId) => {
    stopCurrentCamera();
    setCameraId(newCamId);
    setDetections([]);
    setDetectionCount(0);
    clearOverlay();
    setTimeout(() => {
      if (newCamId === 'CAM_GATE_01') {
        startGateCamera();
      } else {
        startWebcam();
      }
    }, 150);
  };

  const fetchInitialConfig = async () => {
    try {
      try {
        const sourcesRes = await cameraApi.getSources();
        if (sourcesRes.data && Array.isArray(sourcesRes.data) && sourcesRes.data.length > 0) {
          setCamerasList(sourcesRes.data);
        }
      } catch (err) {
        console.warn('Using default camera sources list');
      }

      const res = await settingsApi.getSettings();
      if (res.data?.faceConfidenceThreshold) {
        setConfidenceThreshold(Math.round(res.data.faceConfidenceThreshold * 100));
      }
    } catch (err) {
      console.error('Failed to load camera settings:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await employeeApi.getAll();
      setEmployeesList(res.data);
      if (res.data.length > 0) {
        setSelectedSimEmp(res.data[0].employeeId);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const startCurrentCamera = () => {
    if (cameraId === 'CAM_GATE_01') {
      startGateCamera();
    } else {
      startWebcam();
    }
  };

  const stopCurrentCamera = () => {
    isLoopRunningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsProcessing(false);
    setDetections([]);
    setDetectionCount(0);
    clearOverlay();
  };

  // 1. LOCAL WEBCAM CONTINUOUS LOOP
  const startWebcam = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
          isLoopRunningRef.current = true;
          scheduleWebcamLoop();
        };
      }
    } catch (err) {
      console.error('Webcam access failed:', err);
      setCameraError(
        'Unable to access browser webcam. Please ensure camera permissions are granted.'
      );
      setCameraActive(false);
    }
  };

  const scheduleWebcamLoop = () => {
    if (!isLoopRunningRef.current) return;

    timerRef.current = setTimeout(async () => {
      if (!isLoopRunningRef.current) return;

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && video.videoWidth && canvas && !video.paused && !video.ended) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const base64Image = canvas.toDataURL('image/jpeg', 0.82);

          setIsProcessing(true);
          const res = await cameraApi.processFrame({
            image: base64Image,
            cameraId: 'cam_main',
            mode: mode,
          });

          const detectedFaces = res.data.detections || [];
          setDetections(detectedFaces);
          setDetectionCount(detectedFaces.length);
          drawBoundingBoxes(detectedFaces, canvas.width, canvas.height);

          // Append to live logs if punch event triggered
          detectedFaces.forEach((det) => {
            if (det.eventTriggered && ['IN', 'OUT'].includes(det.eventTriggered)) {
              setLiveStreamLogs((prev) => [
                {
                  id: Date.now() + Math.random(),
                  name: det.name,
                  employeeId: det.employeeId,
                  department: det.department,
                  event: det.eventTriggered,
                  confidence: det.confidence,
                  time: new Date().toLocaleTimeString(),
                  message: det.message,
                  status: det.attendanceStatus,
                  cameraLocation: 'Front Desk / Webcam',
                  cameraId: 'cam_main',
                },
                ...prev.slice(0, 29),
              ]);
            }
          });
        }
      } catch (err) {
        console.warn('Webcam loop iteration notice:', err);
      } finally {
        setIsProcessing(false);
        // CONTINUOUS RE-SCHEDULING: Always runs next iteration smoothly
        if (isLoopRunningRef.current) {
          scheduleWebcamLoop();
        }
      }
    }, 450);
  };

  // 2. COMPANY GATE IP CAMERA CONTINUOUS LOOP (http://143.244.140.108:10000)
  const startGateCamera = () => {
    setCameraError('');
    setCameraActive(true);
    isLoopRunningRef.current = true;
    setGateFrameTimestamp(Date.now());
    scheduleGateCameraLoop();
  };

  const scheduleGateCameraLoop = () => {
    if (!isLoopRunningRef.current) return;

    timerRef.current = setTimeout(async () => {
      if (!isLoopRunningRef.current) return;

      try {
        setIsProcessing(true);
        // Always refresh live snapshot timestamp
        setGateFrameTimestamp(Date.now());

        const res = await cameraApi.processGateFrame({
          mode: mode,
          cameraId: 'CAM_GATE_01',
          view: feedViewMode,
        });

        if (res.data?.success) {
          const detectedFaces = res.data.detections || [];
          setDetections(detectedFaces);
          setDetectionCount(detectedFaces.length);

          const img = gateImgRef.current;
          const origW = img?.naturalWidth || 320;
          const origH = img?.naturalHeight || 240;
          drawBoundingBoxes(detectedFaces, origW, origH);

          // Append to live logs if event triggered
          detectedFaces.forEach((det) => {
            if (det.eventTriggered && ['IN', 'OUT'].includes(det.eventTriggered)) {
              setLiveStreamLogs((prev) => [
                {
                  id: Date.now() + Math.random(),
                  name: det.name,
                  employeeId: det.employeeId,
                  department: det.department,
                  event: det.eventTriggered,
                  confidence: det.confidence,
                  time: new Date().toLocaleTimeString(),
                  message: det.message,
                  status: det.attendanceStatus,
                  cameraLocation: 'Main Gate',
                  cameraId: 'CAM_GATE_01',
                },
                ...prev.slice(0, 29),
              ]);
            }
          });
        }
      } catch (err) {
        console.warn('Gate loop iteration notice:', err);
      } finally {
        setIsProcessing(false);
        // CONTINUOUS RE-SCHEDULING: Always stays alive and never stops
        if (isLoopRunningRef.current) {
          scheduleGateCameraLoop();
        }
      }
    }, 400);
  };

  const handleTestGateConnection = async () => {
    try {
      setGateCamTesting(true);
      const res = await cameraApi.testConnection();
      setGateCamStatus(res.data);
      if (res.data.success) {
        setGateFrameTimestamp(Date.now());
      }
    } catch (err) {
      setGateCamStatus({
        success: false,
        status: 'OFFLINE',
        message: 'Connection failed: ' + (err.response?.data?.detail || err.message),
      });
    } finally {
      setGateCamTesting(false);
    }
  };

  const clearOverlay = () => {
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  };

  const drawBoundingBoxes = (faces, origWidth, origHeight) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    overlay.width = origWidth;
    overlay.height = origHeight;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    faces.forEach((face) => {
      const [x, y, w, h] = face.box;
      const isRecognized = face.isRecognized;

      const color = isRecognized ? '#10b981' : '#f43f5e';
      const bgColor = isRecognized ? 'rgba(16, 185, 129, 0.92)' : 'rgba(244, 63, 94, 0.92)';

      // Draw bounding box
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.strokeRect(x, y, w, h);

      // Corner brackets
      const cornerLen = Math.min(w, h) * 0.22;
      ctx.lineWidth = 4;
      ctx.strokeStyle = isRecognized ? '#34d399' : '#fb7185';

      // Top Left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      // Top Right
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLen);
      ctx.stroke();

      // Bottom Left
      ctx.beginPath();
      ctx.moveTo(x, y + h - cornerLen);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + cornerLen, y + h);
      ctx.stroke();

      // Bottom Right
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - cornerLen);
      ctx.stroke();

      // Badge Label
      const labelText = isRecognized
        ? `${face.name} • ${face.confidence}%`
        : `Unknown Person (${face.confidence}%)`;

      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      const textWidth = ctx.measureText(labelText).width;
      const bannerHeight = 26;

      ctx.fillStyle = bgColor;
      ctx.fillRect(x, Math.max(0, y - bannerHeight), textWidth + 18, bannerHeight);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x + 8, Math.max(17, y - 8));

      // Event subtitle tag
      if (face.eventTriggered) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(x, y + h, textWidth + 18, 22);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`Event: ${face.eventTriggered} (${face.attendanceStatus || ''})`, x + 8, y + h + 15);
      }
    });
  };

  const handleSimulatePunch = async () => {
    if (!selectedSimEmp) return;
    try {
      setSimulating(true);
      const res = await cameraApi.simulatePunch({
        employeeId: selectedSimEmp,
        mode: mode,
        cameraId: cameraId,
      });

      const emp = employeesList.find((e) => e.employeeId === selectedSimEmp);
      const eventRes = res.data.result;

      if (eventRes.eventTriggered && ['IN', 'OUT'].includes(eventRes.eventTriggered)) {
        setLiveStreamLogs((prev) => [
          {
            id: Date.now(),
            name: emp?.name || selectedSimEmp,
            employeeId: selectedSimEmp,
            department: emp?.department || 'General',
            event: eventRes.eventTriggered,
            confidence: 96.5,
            time: new Date().toLocaleTimeString(),
            message: eventRes.message,
            status: eventRes.attendanceStatus,
            cameraLocation: cameraId === 'CAM_GATE_01' ? 'Main Gate' : 'Simulated Terminal',
            cameraId: cameraId,
          },
          ...prev.slice(0, 29),
        ]);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  const activeCameraObj = camerasList.find((c) => c.id === cameraId) || {
    id: cameraId,
    name: cameraId === 'CAM_GATE_01' ? 'Reception / Main Gate Camera' : 'Local Webcam',
    location: cameraId === 'CAM_GATE_01' ? 'Main Gate' : 'Front Desk',
    type: cameraId === 'CAM_GATE_01' ? 'IP_CAMERA' : 'WEBCAM',
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Real-Time Camera Recognition</h1>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                cameraActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {cameraActive ? 'Camera Live & Auto-Detecting' : 'Camera Idle'}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Always-on FaceNet biometric detection, continuous recognition, and automatic multi-session attendance
          </p>
        </div>

        {/* Camera Start/Stop Controls */}
        <div className="flex items-center gap-3">
          {cameraId === 'CAM_GATE_01' && (
            <button
              onClick={handleTestGateConnection}
              disabled={gateCamTesting}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              <Activity className={`w-4 h-4 text-blue-600 ${gateCamTesting ? 'animate-spin' : ''}`} />
              <span>{gateCamTesting ? 'Testing Link...' : 'Test IP Camera Link'}</span>
            </button>
          )}

          {cameraActive ? (
            <button
              onClick={stopCurrentCamera}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-sm transition cursor-pointer"
            >
              <Square className="w-4 h-4" />
              <span>Pause Camera</span>
            </button>
          ) : (
            <button
              onClick={startCurrentCamera}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm shadow-blue-500/20 transition cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>Resume Live Stream</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-slate-700">
        <div>
          <label className="block text-slate-500 mb-1">Punch Detection Mode</label>
          <div className="grid grid-cols-3 gap-1.5">
            {['AUTO', 'IN_ONLY', 'OUT_ONLY'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                  mode === m ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-slate-500 mb-1">Active Camera Source</label>
          <select
            value={cameraId}
            onChange={(e) => handleCameraChange(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="CAM_GATE_01">🌐 Reception / Main Gate IP Camera (143.244.140.108:10000)</option>
            <option value="cam_main">📷 Local Webcam (Browser Cam)</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-500">Face Match Threshold</span>
            <span className="font-mono text-blue-600 font-bold">{confidenceThreshold}%</span>
          </div>
          <input
            type="range"
            min="45"
            max="95"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>
      </div>

      {/* Gate Camera Status Alert Banner (if tested) */}
      {gateCamStatus && (
        <div
          className={`p-4 rounded-2xl border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
            gateCamStatus.status === 'ONLINE'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : gateCamStatus.status?.startsWith('STALE') || gateCamStatus.status === 'DARK'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {gateCamStatus.status === 'ONLINE' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : gateCamStatus.status?.startsWith('STALE') || gateCamStatus.status === 'DARK' ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-semibold">{gateCamStatus.message}</div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-200">
                  Cloud Server: {gateCamStatus.serverReachable ? '🟢 Connected' : '🔴 Unreachable'} ({gateCamStatus.latencyMs}ms)
                </span>
                <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-200">
                  Hardware Stream: {gateCamStatus.isHardwareStreaming ? '🟢 Active' : `🟡 Idle (${gateCamStatus.frameAge || 'Stale'})`}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-200">
                  Brightness: {gateCamStatus.isDark ? '🌙 Dark / Low Light' : `☀️ ${gateCamStatus.frameBrightness}%`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleCameraChange('cam_main')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition cursor-pointer"
            >
              Switch to Webcam
            </button>
            <button
              onClick={() => setGateCamStatus(null)}
              className="text-xs font-bold hover:underline opacity-80 cursor-pointer px-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Live Feed & Detection Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Stream Viewport (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-16/10 bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-lg flex items-center justify-center">
            {/* Raw Hidden Canvas for webcam frame snapshot */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Source 1: Local Webcam Video Feed */}
            {cameraId === 'cam_main' && (
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ display: cameraActive ? 'block' : 'none' }}
              />
            )}

            {/* Source 2: Company Gate IP Camera Stream Feed */}
            {cameraId === 'CAM_GATE_01' && cameraActive && (
              <img
                ref={gateImgRef}
                src={`${cameraApi.getFrameUrl('CAM_GATE_01', feedViewMode)}&_t=${gateFrameTimestamp}`}
                alt="Company Gate Live Stream"
                className="w-full h-full object-contain bg-black"
                onError={(e) => {
                  console.warn('Frame reload retry');
                }}
              />
            )}

            {/* Real-time Bounding Box Overlay Canvas (shared by both sources) */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ display: cameraActive ? 'block' : 'none' }}
            />

            {/* Idle State Display */}
            {!cameraActive && (
              <div className="flex flex-col items-center justify-center text-center p-8 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                  {cameraId === 'CAM_GATE_01' ? (
                    <Globe className="w-8 h-8 text-blue-500" />
                  ) : (
                    <Camera className="w-8 h-8 text-blue-500" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {cameraId === 'CAM_GATE_01' ? 'Gate IP Camera Paused' : 'Webcam Stream Inactive'}
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  {cameraError || 'Click below to resume real-time continuous biometric attendance detection.'}
                </p>
                <button
                  onClick={startCurrentCamera}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start Live Stream</span>
                </button>
              </div>
            )}

            {/* Live Camera Info & Detection Stats Overlay */}
            {cameraActive && (
              <>
                <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-white text-xs flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold">LIVE FEED</span>
                  </div>
                  <span className="text-slate-400 font-mono">
                    {detectionCount} {detectionCount === 1 ? 'Face' : 'Faces'} Detected
                  </span>
                </div>

                <div className="absolute top-3 right-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-white text-xs flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-semibold text-slate-300">
                    {activeCameraObj.location} ({activeCameraObj.name})
                  </span>
                </div>

                {/* View Mode Toggle when Gate Cam is selected */}
                {cameraId === 'CAM_GATE_01' && (
                  <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-700/80 text-white text-xs flex items-center gap-1.5">
                    <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Mode:</span>
                    <button
                      onClick={() => setFeedViewMode('auto')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                        feedViewMode === 'auto' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Auto
                    </button>
                    <button
                      onClick={() => setFeedViewMode('latest')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                        feedViewMode === 'latest' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Raw Sensor
                    </button>
                    <button
                      onClick={() => setFeedViewMode('daylight')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                        feedViewMode === 'daylight' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Daylight Reference
                    </button>
                  </div>
                )}

                {/* Quick Camera Switch Button */}
                <button
                  onClick={() => handleCameraChange(cameraId === 'CAM_GATE_01' ? 'cam_main' : 'CAM_GATE_01')}
                  className="absolute bottom-3 right-3 bg-slate-900/85 hover:bg-slate-800 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-white text-xs flex items-center gap-1.5 cursor-pointer transition font-medium"
                >
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  <span>{cameraId === 'CAM_GATE_01' ? 'Use Local Webcam' : 'Use Gate IP Camera'}</span>
                </button>
              </>
            )}
          </div>

          {/* Quick Simulation Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Simulate Employee Walk-in:</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedSimEmp}
                onChange={(e) => setSelectedSimEmp(e.target.value)}
                className="flex-1 sm:w-64 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
              >
                {employeesList.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.name} ({emp.employeeId})
                  </option>
                ))}
              </select>

              <button
                onClick={handleSimulatePunch}
                disabled={simulating || !selectedSimEmp}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer shrink-0"
              >
                {simulating ? 'Processing...' : 'Test Punch'}
              </button>
            </div>
          </div>
        </div>

        {/* Live Recognition Logs Stream (1 Col) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[520px]">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">Live Recognition Ticker</h3>
            </div>
            <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              Real-Time
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {liveStreamLogs.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                No real-time events triggered yet. Bring an enrolled employee in front of the gate camera / webcam, or click "Test Punch".
              </div>
            ) : (
              liveStreamLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-100 hover:border-slate-200 transition flex flex-col gap-1.5 animate-slide-in"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] text-white ${
                          log.event === 'IN' ? 'bg-emerald-600' : 'bg-blue-600'
                        }`}
                      >
                        {log.event}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{log.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{log.time}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {log.employeeId} • {log.department}
                    </span>
                    <span className="font-semibold text-emerald-700 font-mono">{log.confidence}% match</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1 font-medium">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {log.cameraLocation || 'Office Camera'}
                    </span>
                    {log.status && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                        {log.status}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 leading-tight bg-white p-1.5 rounded-md border border-slate-100">
                    {log.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
