import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { io } from "socket.io-client";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://third-eye-backend-a319.onrender.com";

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const [stats, setStats] = useState({
    totalDevices: 0,
    activeDevices: 0,
    recordingNow: 0,
    totalRecordings: 0,
    storageUsedMB: 0,
    storageUsedGB: 0,
  });
  const [devices, setDevices] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecordings, setSelectedRecordings] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Live Camera Surveillance State
  const [socket, setSocket] = useState(null);
  const [onlineSocketDevices, setOnlineSocketDevices] = useState(new Set());
  const [liveDevice, setLiveDevice] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [liveLens, setLiveLens] = useState("BACK");
  const [liveFps, setLiveFps] = useState(0);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  const frameCountRef = useRef(0);

  // Live Microphone Audio State
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const nextAudioTimeRef = useRef(0);
  const isAudioMutedRef = useRef(false);

  // Helper to convert Base64 PCM 16-bit Mono into Float32Array
  const base64ToFloat32 = (base64) => {
    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16 = new Int16Array(
        bytes.buffer,
        bytes.byteOffset,
        Math.floor(bytes.byteLength / 2),
      );
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }
      return float32;
    } catch (e) {
      return new Float32Array(0);
    }
  };

  const initAudio = () => {
    try {
      if (
        !audioContextRef.current ||
        audioContextRef.current.state === "closed"
      ) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioCtx({ sampleRate: 16000 });
        nextAudioTimeRef.current = 0;
      }
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn("AudioContext init error:", e);
    }
  };

  const playPcmChunk = (base64Data, sampleRate = 16000) => {
    if (isAudioMutedRef.current) return;
    initAudio();
    const ctx = audioContextRef.current;
    if (!ctx) return;

    try {
      const float32 = base64ToFloat32(base64Data);
      if (float32.length === 0) return;

      let sum = 0;
      for (let i = 0; i < float32.length; i++) {
        sum += float32[i] * float32[i];
      }
      const rms = Math.sqrt(sum / float32.length);
      setAudioLevel(Math.min(100, Math.round(rms * 500)));

      const audioBuffer = ctx.createBuffer(1, float32.length, sampleRate);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      let startTime = nextAudioTimeRef.current;
      if (startTime < currentTime) {
        startTime = currentTime + 0.02;
      }
      source.start(startTime);
      nextAudioTimeRef.current = startTime + audioBuffer.duration;
    } catch (e) {
      console.warn("Audio playback error:", e);
    }
  };

  const toggleAudioMute = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    isAudioMutedRef.current = nextMuted;
    if (!nextMuted) {
      initAudio();
    } else {
      setAudioLevel(0);
    }
  };

  // Fetch all dashboard data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Health check
      const healthRes = await fetch(`${API_BASE_URL}/api/health`).catch(
        () => null,
      );
      if (!healthRes || !healthRes.ok) {
        setServerOnline(false);
        setLoading(false);
        return;
      }
      setServerOnline(true);

      // 2. Fetch Stats
      const statsRes = await fetch(`${API_BASE_URL}/api/admin/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.stats);
      }

      // 3. Fetch Devices
      const devicesRes = await fetch(`${API_BASE_URL}/api/devices`);
      if (devicesRes.ok) {
        const devicesData = await devicesRes.json();
        if (devicesData.success) setDevices(devicesData.devices);
      }

      // 4. Fetch Recordings
      const recRes = await fetch(`${API_BASE_URL}/api/videos`);
      if (recRes.ok) {
        const recData = await recRes.json();
        if (recData.success) setRecordings(recData.recordings);
      }
    } catch (err) {
      console.error("Failed fetching data:", err);
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Polling for live dashboard updates (30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Connect to Socket.io for Real-Time Camera Streaming & Remote Controls
  useEffect(() => {
    const s = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
    });

    s.on("connect", () => {
      console.log("⚡ Admin connected to real-time socket");
      s.emit("register-admin");
    });

    s.on("online-devices-list", (list) => {
      setOnlineSocketDevices(new Set(list));
    });

    s.on(
      "device-status-change",
      ({ deviceId, isOnline, lastSeen, batteryLevel }) => {
        setOnlineSocketDevices((prev) => {
          const next = new Set(prev);
          if (isOnline) next.add(deviceId);
          else next.delete(deviceId);
          return next;
        });
        setDevices((prevDevices) =>
          prevDevices.map((d) =>
            d.deviceId === deviceId
              ? {
                  ...d,
                  lastSeen: lastSeen || new Date(),
                  ...(batteryLevel !== undefined ? { batteryLevel } : {}),
                }
              : d,
          ),
        );
      },
    );

    s.on("device-heartbeat", ({ deviceId, lastSeen, batteryLevel }) => {
      setOnlineSocketDevices((prev) => {
        const next = new Set(prev);
        next.add(deviceId);
        return next;
      });
      setDevices((prevDevices) =>
        prevDevices.map((d) =>
          d.deviceId === deviceId
            ? {
                ...d,
                lastSeen: lastSeen || new Date(),
                ...(batteryLevel !== undefined ? { batteryLevel } : {}),
              }
            : d,
        ),
      );
    });

    s.on("live-frame", (data) => {
      if (data && data.frame) {
        setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
        setIsLiveConnecting(false);
        frameCountRef.current += 1;
      }
    });

    s.on("live-audio", (data) => {
      if (data && data.audio) {
        playPcmChunk(data.audio, data.sampleRate || 16000);
      }
    });

    s.on("stream-error", (err) => {
      alert(`Live stream error: ${err.error || "Device unavailable"}`);
      setIsLiveConnecting(false);
      setLiveDevice(null);
    });

    s.on("stream-ended", () => {
      setIsLiveConnecting(false);
      setLiveDevice(null);
      setLiveFrame(null);
    });

    setSocket(s);

    const fpsInterval = setInterval(() => {
      setLiveFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      clearInterval(fpsInterval);
      s.disconnect();
    };
  }, []);

  // Live Stream Handlers
  const handleStartLiveStream = (device) => {
    setLiveDevice(device);
    setLiveFrame(null);
    setLiveLens("BACK");
    setIsLiveConnecting(true);
    isAudioMutedRef.current = false;
    setIsAudioMuted(false);
    initAudio();
    if (socket) {
      socket.emit("request-live-stream", {
        deviceId: device.deviceId,
        camera: "BACK",
      });
    }
  };

  const handleStopLiveStream = () => {
    if (socket && liveDevice) {
      socket.emit("stop-watching-device", { deviceId: liveDevice.deviceId });
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      nextAudioTimeRef.current = 0;
    }
    setAudioLevel(0);
    setLiveDevice(null);
    setLiveFrame(null);
    setIsLiveConnecting(false);
  };

  const handleSwitchCamera = () => {
    const nextLens = liveLens === "BACK" ? "FRONT" : "BACK";
    setLiveLens(nextLens);
    if (socket && liveDevice) {
      socket.emit("switch-camera", {
        deviceId: liveDevice.deviceId,
        camera: nextLens,
      });
    }
  };

  const handleTakeSnapshot = () => {
    if (!liveFrame) return;
    const a = document.createElement("a");
    a.href = liveFrame;
    a.download = `snapshot_${liveDevice?.deviceId || "live"}_${Date.now()}.jpg`;
    a.click();
  };

  const handleStartRemoteRecording = (deviceId) => {
    if (socket) {
      socket.emit("start-remote-recording", { deviceId });
    }
  };

  const handleStopRemoteRecording = (deviceId) => {
    if (socket) {
      socket.emit("stop-remote-recording", { deviceId });
    }
  };

  // Toggle selection for a recording
  const toggleSelectRecording = (id) => {
    setSelectedRecordings((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Toggle select all visible recordings
  const handleSelectAllToggle = (visibleIds = []) => {
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedRecordings.includes(id));
    if (allSelected) {
      setSelectedRecordings((prev) =>
        prev.filter((id) => !visibleIds.includes(id)),
      );
    } else {
      setSelectedRecordings((prev) =>
        Array.from(new Set([...prev, ...visibleIds])),
      );
    }
  };

  // Batch delete selected videos
  const handleDeleteSelected = async () => {
    if (selectedRecordings.length === 0) return;
    if (
      !window.confirm(
        `Permanently delete ${selectedRecordings.length} selected recording(s) from Google Drive and server?`,
      )
    )
      return;

    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/videos/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIds: selectedRecordings }),
      });
      const data = await res.json();
      if (data.success) {
        setRecordings((prev) =>
          prev.filter((r) => !selectedRecordings.includes(r._id)),
        );
        setSelectedRecordings([]);
        fetchData();
      } else {
        alert(data.message || "Batch delete failed");
      }
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete all recordings
  const handleDeleteAllRecordings = async () => {
    if (
      !window.confirm(
        "⚠️ WARNING: Delete ALL recordings permanently from Google Drive and Database? This cannot be undone!",
      )
    )
      return;

    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/videos/all`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setRecordings([]);
        setSelectedRecordings([]);
        fetchData();
      } else {
        alert(data.message || "Delete all failed");
      }
    } catch (err) {
      alert("Delete all failed: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete single recording
  const handleDeleteRecording = async (id) => {
    if (
      !window.confirm(
        "Permanently delete this recording from Google Drive and database?",
      )
    )
      return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/videos/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRecordings((prev) => prev.filter((r) => r._id !== id));
        setSelectedRecordings((prev) => prev.filter((item) => item !== id));
        fetchData();
      }
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // Delete device
  const handleDeleteDevice = async (deviceId) => {
    if (!window.confirm("Remove this device from the dashboard?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices/${deviceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
        fetchData();
      }
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // Format bytes to MB
  const formatSize = (bytes) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return (mb / 1024).toFixed(2) + " GB";
    return mb.toFixed(1) + " MB";
  };

  // Format duration in mm:ss
  const formatDuration = (seconds) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    if (!dateString) return "Never";
    const diff = (new Date() - new Date(dateString)) / 1000;
    if (diff < 30) return "Just now";
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateString).toLocaleDateString();
  };

  const liveOnlineCount = devices.filter(
    (d) =>
      onlineSocketDevices.has(d.deviceId) ||
      (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60),
  ).length;

  return (
    <DashboardContext.Provider
      value={{
        stats,
        devices,
        recordings,
        loading,
        serverOnline,
        autoRefresh,
        setAutoRefresh,
        selectedVideo,
        setSelectedVideo,
        searchQuery,
        setSearchQuery,
        selectedRecordings,
        setSelectedRecordings,
        isDeleting,
        onlineSocketDevices,
        liveDevice,
        liveFrame,
        liveLens,
        liveFps,
        isLiveConnecting,
        isAudioMuted,
        audioLevel,
        liveOnlineCount,
        fetchData,
        handleStartLiveStream,
        handleStopLiveStream,
        handleSwitchCamera,
        handleTakeSnapshot,
        handleStartRemoteRecording,
        handleStopRemoteRecording,
        toggleAudioMute,
        toggleSelectRecording,
        handleSelectAllToggle,
        handleDeleteSelected,
        handleDeleteAllRecordings,
        handleDeleteRecording,
        handleDeleteDevice,
        formatSize,
        formatDuration,
        formatTimeAgo,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
