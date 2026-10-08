import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [toasts, setToasts] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const addToast = (toast) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    const newToast = { ...toast, id };
    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const playNotificationSound = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (type === 'IN') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      } else {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime + 0.1); // D5
      }
      
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio not supported or blocked
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('Connected to SmartFace Real-Time WebSocket server');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ATTENDANCE_EVENT') {
            setLastEvent(data);
            setRecentEvents((prev) => [data, ...prev.slice(0, 19)]);
            playNotificationSound(data.event);
            addToast({
              title: `${data.name} (${data.employeeId})`,
              message: data.message || `Punch ${data.event} recorded at ${data.time}`,
              type: data.event === 'IN' ? 'success' : 'info',
              time: data.time,
              status: data.status,
            });
          } else if (data.type === 'UNKNOWN_PERSON') {
            addToast({
              title: 'Unknown Person Detected',
              message: 'Face not matched in database. Attendance not recorded.',
              type: 'warning',
            });
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        setConnected(false);
        ws.close();
      };
    } catch (err) {
      console.warn('WS connection attempt error:', err);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
    }
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  const triggerLocalEvent = (eventData) => {
    setLastEvent(eventData);
    setRecentEvents((prev) => [eventData, ...prev.slice(0, 19)]);
    playNotificationSound(eventData.event);
    addToast({
      title: `${eventData.name} (${eventData.employeeId})`,
      message: eventData.message || `Punch ${eventData.event} recorded at ${eventData.time}`,
      type: eventData.event === 'IN' ? 'success' : 'info',
      time: eventData.time,
      status: eventData.status,
    });
  };

  return (
    <WebSocketContext.Provider
      value={{
        connected,
        lastEvent,
        recentEvents,
        toasts,
        triggerLocalEvent,
      }}
    >
      {children}

      {/* Floating Real-Time Notifications Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 animate-slide-in ${
              toast.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                : toast.type === 'warning'
                ? 'bg-amber-50/95 border-amber-200 text-amber-900'
                : 'bg-blue-50/95 border-blue-200 text-blue-900'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shrink-0 text-sm shadow-sm ${
                toast.type === 'success'
                  ? 'bg-emerald-600'
                  : toast.type === 'warning'
                  ? 'bg-amber-600'
                  : 'bg-blue-600'
              }`}
            >
              {toast.type === 'success' ? 'IN' : toast.type === 'warning' ? '?' : 'OUT'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold truncate">{toast.title}</h4>
                {toast.time && <span className="text-[10px] text-slate-500 font-mono ml-2">{toast.time}</span>}
              </div>
              <p className="text-xs mt-0.5 leading-snug opacity-90">{toast.message}</p>
              {toast.status && (
                <span
                  className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    toast.status === 'FULL DAY'
                      ? 'bg-emerald-200/80 text-emerald-800'
                      : toast.status === 'LATE'
                      ? 'bg-amber-200/80 text-amber-800'
                      : 'bg-blue-200/80 text-blue-800'
                  }`}
                >
                  {toast.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
