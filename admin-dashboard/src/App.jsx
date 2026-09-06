import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Eye,
  Smartphone,
  Video,
  HardDrive,
  RefreshCw,
  Play,
  Download,
  Trash2,
  ExternalLink,
  BatteryCharging,
  BatteryMedium,
  BatteryLow,
  Radio,
  Settings,
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Calendar,
  CloudUpload,
  Info,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Menu,
  Volume2,
  VolumeX
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://third-eye-backend-a319.onrender.com';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordings, setSelectedRecordings] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Responsive Drawer & Pagination State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [videoPage, setVideoPage] = useState(1);
  const videosPerPage = 6;
  const [devicePage, setDevicePage] = useState(1);
  const devicesPerPage = 8;

  // Live Camera Surveillance State
  const [socket, setSocket] = useState(null);
  const [onlineSocketDevices, setOnlineSocketDevices] = useState(new Set());
  const [liveDevice, setLiveDevice] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [liveLens, setLiveLens] = useState('BACK');
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
      const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
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
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioCtx({ sampleRate: 16000 });
        nextAudioTimeRef.current = 0;
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn('AudioContext init error:', e);
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

      // Calculate simple RMS for visual sound wave meter
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
        startTime = currentTime + 0.02; // Small 20ms buffer to eliminate crackle
      }
      source.start(startTime);
      nextAudioTimeRef.current = startTime + audioBuffer.duration;
    } catch (e) {
      console.warn('Audio playback error:', e);
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

  // Reset pagination on search query change
  useEffect(() => {
    setVideoPage(1);
    setDevicePage(1);
  }, [searchQuery]);

  // Fetch all dashboard data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Health check
      const healthRes = await fetch(`${API_BASE_URL}/api/health`).catch(() => null);
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
      console.error('Failed fetching data:', err);
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
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
    });

    s.on('connect', () => {
      console.log('⚡ Admin connected to real-time socket');
      s.emit('register-admin');
    });

    s.on('online-devices-list', (list) => {
      setOnlineSocketDevices(new Set(list));
    });

    s.on('device-status-change', ({ deviceId, isOnline, lastSeen, batteryLevel }) => {
      setOnlineSocketDevices((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(deviceId);
        else next.delete(deviceId);
        return next;
      });
      setDevices((prevDevices) =>
        prevDevices.map((d) =>
          d.deviceId === deviceId
            ? { ...d, lastSeen: lastSeen || new Date(), ...(batteryLevel !== undefined ? { batteryLevel } : {}) }
            : d
        )
      );
    });

    s.on('device-heartbeat', ({ deviceId, lastSeen, batteryLevel }) => {
      setOnlineSocketDevices((prev) => {
        const next = new Set(prev);
        next.add(deviceId);
        return next;
      });
      setDevices((prevDevices) =>
        prevDevices.map((d) =>
          d.deviceId === deviceId
            ? { ...d, lastSeen: lastSeen || new Date(), ...(batteryLevel !== undefined ? { batteryLevel } : {}) }
            : d
        )
      );
    });

    s.on('live-frame', (data) => {
      if (data && data.frame) {
        setLiveFrame(`data:image/jpeg;base64,${data.frame}`);
        setIsLiveConnecting(false);
        frameCountRef.current += 1;
      }
    });

    s.on('live-audio', (data) => {
      if (data && data.audio) {
        playPcmChunk(data.audio, data.sampleRate || 16000);
      }
    });

    s.on('stream-error', (err) => {
      alert(`Live stream error: ${err.error || 'Device unavailable'}`);
      setIsLiveConnecting(false);
      setLiveDevice(null);
    });

    s.on('stream-ended', () => {
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
    setLiveLens('BACK');
    setIsLiveConnecting(true);
    isAudioMutedRef.current = false;
    setIsAudioMuted(false);
    initAudio();
    if (socket) {
      socket.emit('request-live-stream', {
        deviceId: device.deviceId,
        camera: 'BACK',
      });
    }
  };

  const handleStopLiveStream = () => {
    if (socket && liveDevice) {
      socket.emit('stop-watching-device', { deviceId: liveDevice.deviceId });
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
    const nextLens = liveLens === 'BACK' ? 'FRONT' : 'BACK';
    setLiveLens(nextLens);
    if (socket && liveDevice) {
      socket.emit('switch-camera', {
        deviceId: liveDevice.deviceId,
        camera: nextLens,
      });
    }
  };

  const handleTakeSnapshot = () => {
    if (!liveFrame) return;
    const a = document.createElement('a');
    a.href = liveFrame;
    a.download = `snapshot_${liveDevice?.deviceId || 'live'}_${Date.now()}.jpg`;
    a.click();
  };

  // Toggle selection for a recording
  const toggleSelectRecording = (id) => {
    setSelectedRecordings((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle select all visible recordings
  const handleSelectAllToggle = () => {
    const visibleIds = filteredRecordings.map((r) => r._id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRecordings.includes(id));
    if (allSelected) {
      setSelectedRecordings((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedRecordings((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Delete single recording
  const handleDeleteRecording = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recording?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/videos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRecordings((prev) => prev.filter((r) => r._id !== id));
        setSelectedRecordings((prev) => prev.filter((item) => item !== id));
        fetchData();
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Delete selected recordings in batch
  const handleDeleteSelected = async () => {
    if (selectedRecordings.length === 0) return;
    const confirmMsg = `Are you sure you want to permanently delete ${selectedRecordings.length} selected video(s)? This will also remove them from Google Drive.`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/videos/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRecordings }),
      });

      if (res.ok) {
        setRecordings((prev) => prev.filter((r) => !selectedRecordings.includes(r._id)));
        setSelectedRecordings([]);
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Delete failed: ${data.error || 'Server error'}`);
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete ALL recordings
  const handleDeleteAllRecordings = async () => {
    if (recordings.length === 0) return;
    const confirmMsg = `⚠️ WARNING: Are you sure you want to permanently delete ALL ${recordings.length} recordings?\n\nThis will remove every video from both Google Drive and database. This action cannot be undone!`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/videos/all`, { method: 'DELETE' });
      if (res.ok) {
        setRecordings([]);
        setSelectedRecordings([]);
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Delete all failed: ${data.error || 'Server error'}`);
      }
    } catch (err) {
      alert('Delete all failed: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete device
  const handleDeleteDevice = async (deviceId) => {
    if (!window.confirm('Remove this device from the dashboard?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices/${deviceId}`, { method: 'DELETE' });
      if (res.ok) {
        setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
        fetchData();
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Format bytes to MB
  const formatSize = (bytes) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
    return mb.toFixed(1) + ' MB';
  };

  // Format duration in mm:ss
  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Never';
    const diff = (new Date() - new Date(dateString)) / 1000;
    if (diff < 30) return 'Just now';
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateString).toLocaleDateString();
  };

  const filteredDevices = devices.filter((d) =>
    (d.deviceName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.model || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.deviceId || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRecordings = recordings.filter((r) =>
    (r.deviceName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.deviceId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.fileName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const liveOnlineCount = devices.filter(
    (d) => onlineSocketDevices.has(d.deviceId) || (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60)
  ).length;

  const totalVideoPages = Math.ceil(filteredRecordings.length / videosPerPage) || 1;
  const paginatedRecordings = filteredRecordings.slice(
    (videoPage - 1) * videosPerPage,
    videoPage * videosPerPage
  );

  const totalDevicePages = Math.ceil(filteredDevices.length / devicesPerPage) || 1;
  const paginatedDevices = filteredDevices.slice(
    (devicePage - 1) * devicesPerPage,
    devicePage * devicesPerPage
  );

  return (
    <div className="app-container">
      {/* Drawer backdrop overlay for mobile/tablet */}
      {isDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isDrawerOpen ? 'drawer-open' : ''}`}>
        <div className="brand-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-icon">
              <Eye size={22} />
            </div>
            <div>
              <div className="brand-title">THIRD EYE</div>
              <div className="brand-subtitle">Command Center</div>
            </div>
          </div>
          <button
            className="drawer-close-btn"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <ul className="nav-list">
          <li
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('overview');
              setIsDrawerOpen(false);
            }}
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </li>
          <li
            className={`nav-item ${activeTab === 'devices' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('devices');
              setIsDrawerOpen(false);
            }}
          >
            <Smartphone size={18} />
            <span>Devices</span>
            <span className="badge">{devices.length}</span>
          </li>
          <li
            className={`nav-item ${activeTab === 'recordings' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('recordings');
              setIsDrawerOpen(false);
            }}
          >
            <Video size={18} />
            <span>Recordings</span>
            <span className="badge">{recordings.length}</span>
          </li>
          <li
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('settings');
              setIsDrawerOpen(false);
            }}
          >
            <Settings size={18} />
            <span>Settings &amp; Drive</span>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="server-status-pill">
            <div
              className={`status-indicator ${
                !serverOnline
                  ? 'offline'
                  : stats.recordingNow > 0
                  ? 'recording'
                  : ''
              }`}
            />
            <div>
              <div style={{ fontWeight: 600, color: '#fff' }}>
                {serverOnline ? 'Server Online' : 'Server Disconnected'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {API_BASE_URL.replace('http://', '')}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="main-wrapper">
        {/* Top Header */}
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open menu drawer"
            >
              <Menu size={20} />
            </button>
            <div className="header-title-area">
              <h1>
                {activeTab === 'overview' && 'System Overview'}
                {activeTab === 'devices' && 'Connected Devices'}
                {activeTab === 'recordings' && 'Video Surveillance Gallery'}
                {activeTab === 'settings' && 'System Configuration'}
              </h1>
              <p>
                {activeTab === 'overview' && 'Live status of all distributed devices and background uploads.'}
                {activeTab === 'devices' && 'Real-time telemetry, battery, and recording status of devices.'}
                {activeTab === 'recordings' && 'Browse, stream, and download 720p recordings stored in Admin Drive.'}
                {activeTab === 'settings' && 'Google Drive Service Account setup and API preferences.'}
              </p>
            </div>
          </div>

          <div className="header-actions">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ accentColor: 'var(--cyan)' }}
              />
              Live Polling (30s)
            </label>
            <button
              className="refresh-button"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? 'spinning' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Dashboard Body Content */}
        <main className="dashboard-content">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              {/* Stats Grid */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">Total Devices</span>
                    <div className="stat-icon cyan">
                      <Smartphone size={18} />
                    </div>
                  </div>
                  <div className="stat-value">{stats.totalDevices}</div>
                  <div className="stat-subtext">
                    <span style={{ color: 'var(--emerald)', fontWeight: 600 }}>{liveOnlineCount} active</span> now
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">Recording Live</span>
                    <div className="stat-icon crimson">
                      <Radio size={18} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: stats.recordingNow > 0 ? 'var(--crimson)' : '#fff' }}>
                    {stats.recordingNow}
                  </div>
                  <div className="stat-subtext">
                    {stats.recordingNow > 0 ? 'Active recording in progress' : 'Standby mode'}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">Total Videos</span>
                    <div className="stat-icon emerald">
                      <Video size={18} />
                    </div>
                  </div>
                  <div className="stat-value">{stats.totalRecordings}</div>
                  <div className="stat-subtext">Uploaded &amp; preserved</div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-label">Total Cloud Storage</span>
                    <div className="stat-icon amber">
                      <HardDrive size={18} />
                    </div>
                  </div>
                  <div className="stat-value">
                    {stats.storageUsedGB >= 1
                      ? `${stats.storageUsedGB} GB`
                      : `${stats.storageUsedMB} MB`}
                  </div>
                  <div className="stat-subtext">Optimized 720p/480p files</div>
                </div>
              </div>

              {/* Quick Recent Videos */}
              <div style={{ marginBottom: '32px' }}>
                <div className="section-header">
                  <div>
                    <h2>
                      <Video size={18} color="var(--cyan)" />
                      Recent Recordings
                    </h2>
                    <div className="section-subtitle">Latest background videos uploaded from phones</div>
                  </div>
                  <button
                    className="btn-action"
                    onClick={() => setActiveTab('recordings')}
                    style={{ maxWidth: '140px' }}
                  >
                    View All ({recordings.length})
                  </button>
                </div>

                {recordings.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Video size={28} />
                    </div>
                    <h3>No recordings uploaded yet</h3>
                    <p>When any user stops recording, the video will automatically show up here.</p>
                  </div>
                ) : (
                  <div className="videos-grid">
                    {recordings.slice(0, 3).map((rec) => (
                      <div key={rec._id} className="video-card">
                        <div
                          className="video-preview"
                          onClick={() => setSelectedVideo(rec)}
                        >
                          <div className="play-overlay">
                            <div className="play-button-icon">
                              <Play size={24} fill="#000" />
                            </div>
                          </div>
                        </div>
                        <div className="video-card-body">
                          <div className="video-meta-top">
                            <span className="video-quality-chip">{rec.quality || '720p'}</span>
                            <span className="video-size-chip">{formatSize(rec.fileSizeBytes)}</span>
                          </div>
                          <div className="video-card-title">{rec.deviceName || 'Android Phone'}</div>
                          <div className="video-card-details">
                            <div><Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />{formatTimeAgo(rec.uploadedAt)}</div>
                            <div><Smartphone size={12} style={{ display: 'inline', marginRight: '4px' }} />{rec.deviceId}</div>
                          </div>
                          <div className="video-card-actions">
                            <button
                              className="btn-action"
                              onClick={() => setSelectedVideo(rec)}
                            >
                              <Play size={13} /> Play
                            </button>
                            {rec.driveViewLink && (
                              <a
                                href={rec.driveViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-action drive"
                              >
                                <ExternalLink size={13} /> Drive
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Connected Devices Table */}
              <div>
                <div className="section-header">
                  <div>
                    <h2>
                      <Smartphone size={18} color="var(--emerald)" />
                      Connected Devices
                    </h2>
                    <div className="section-subtitle">Active phones reporting telemetry to this server</div>
                  </div>
                  <button
                    className="btn-action"
                    onClick={() => setActiveTab('devices')}
                    style={{ maxWidth: '140px' }}
                  >
                    Manage ({devices.length})
                  </button>
                </div>

                {devices.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Smartphone size={28} />
                    </div>
                    <h3>No devices connected</h3>
                    <p>Install the app on any phone to start tracking telemetry and uploads.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Device</th>
                          <th>Location</th>
                          <th>Battery</th>
                          <th>Quality</th>
                          <th>Status</th>
                          <th>Last Active</th>
                          <th>Recordings</th>
                          <th>Live View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devices.slice(0, 5).map((d) => {
                          const isOnline = onlineSocketDevices.has(d.deviceId) || (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60);
                          return (
                            <tr key={d.deviceId}>
                              <td>
                                <div className="device-info-cell">
                                  <div className="device-avatar">
                                    <Smartphone size={18} />
                                  </div>
                                  <div>
                                    <div className="device-name">{d.deviceName || d.model}</div>
                                    <div className="device-id">{d.deviceId}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {d.latitude && d.longitude ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      color: 'var(--cyan)',
                                      textDecoration: 'none',
                                      fontSize: '12px',
                                      background: 'rgba(0, 229, 255, 0.1)',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid rgba(0, 229, 255, 0.25)',
                                      fontWeight: 500,
                                    }}
                                    title={`${d.latitude}, ${d.longitude}`}
                                  >
                                    <MapPin size={13} />
                                    <span>{d.locationName || `${d.latitude.toFixed(2)}, ${d.longitude.toFixed(2)}`}</span>
                                  </a>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                    {d.ipAddress ? d.ipAddress.split(',')[0] : 'Locating...'}
                                  </span>
                                )}
                              </td>
                              <td>
                                <span
                                  className={`battery-badge ${
                                    d.batteryLevel > 50
                                      ? 'high'
                                      : d.batteryLevel > 20
                                      ? 'mid'
                                      : 'low'
                                  }`}
                                >
                                  {d.batteryLevel > 50 ? (
                                    <BatteryCharging size={14} />
                                  ) : (
                                    <BatteryLow size={14} />
                                  )}
                                  {d.batteryLevel}%
                                </span>
                              </td>
                              <td>
                                <span className="video-quality-chip">{d.videoQuality || '720p'}</span>
                              </td>
                              <td>
                                <span
                                  className={`status-tag ${
                                    d.isRecording
                                      ? 'recording'
                                      : isOnline
                                      ? 'online'
                                      : 'offline'
                                  }`}
                                >
                                  {d.isRecording
                                    ? 'Recording'
                                    : isOnline
                                    ? 'Online'
                                    : 'Offline'}
                                </span>
                              </td>
                              <td>
                                {isOnline ? (
                                  <span className="active-now-badge">
                                    <span className="pulse-dot" /> Active now
                                  </span>
                                ) : (
                                  formatTimeAgo(d.lastSeen)
                                )}
                              </td>
                              <td style={{ fontWeight: 600, color: '#fff' }}>{d.totalRecordings || 0}</td>
                              <td>
                                <button
                                  className="btn-live-cam"
                                  onClick={() => handleStartLiveStream(d)}
                                  title="Watch live camera feed"
                                >
                                  <Radio size={13} className="live-icon-pulsing" />
                                  <span>Live Camera</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DEVICES */}
          {activeTab === 'devices' && (
            <div>
              <div className="section-header">
                <div>
                  <h2>All Connected Devices ({devices.length})</h2>
                  <div className="section-subtitle">Real-time status, battery levels, and activity tracking</div>
                </div>
                <input
                  type="text"
                  placeholder="Search device by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '13px',
                    width: '260px',
                  }}
                />
              </div>

              {filteredDevices.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Smartphone size={28} />
                  </div>
                  <h3>No matching devices</h3>
                  <p>Devices running Third Eye will automatically register on their first launch.</p>
                </div>
              ) : (
                <>
                  <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Device Name / Model</th>
                        <th>Device ID</th>
                        <th>Location</th>
                        <th>Battery</th>
                        <th>Resolution</th>
                        <th>Status</th>
                        <th>Last Active</th>
                        <th>Total Videos</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDevices.map((d) => {
                        const isOnline = onlineSocketDevices.has(d.deviceId) || (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60);
                        return (
                          <tr key={d.deviceId}>
                            <td>
                              <div className="device-info-cell">
                                <div className="device-avatar">
                                  <Smartphone size={18} />
                                </div>
                                <div>
                                  <div className="device-name">{d.deviceName || 'Android Device'}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.model} (v{d.androidVersion || 'Android'})</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{d.deviceId}</span>
                            </td>
                            <td>
                              {d.latitude && d.longitude ? (
                                <a
                                  href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    color: 'var(--cyan)',
                                    textDecoration: 'none',
                                    fontSize: '12px',
                                    background: 'rgba(0, 229, 255, 0.1)',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(0, 229, 255, 0.25)',
                                    fontWeight: 500,
                                  }}
                                  title={`${d.latitude}, ${d.longitude}`}
                                >
                                  <MapPin size={13} />
                                  <span>{d.locationName || `${d.latitude.toFixed(2)}, ${d.longitude.toFixed(2)}`}</span>
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                  {d.ipAddress ? d.ipAddress.split(',')[0] : 'Unknown'}
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`battery-badge ${
                                  d.batteryLevel > 50
                                    ? 'high'
                                    : d.batteryLevel > 20
                                    ? 'mid'
                                    : 'low'
                                }`}
                              >
                                {d.batteryLevel}%
                              </span>
                            </td>
                            <td>
                              <span className="video-quality-chip">{d.videoQuality || '720p'}</span>
                            </td>
                            <td>
                              <span
                                className={`status-tag ${
                                  d.isRecording
                                    ? 'recording'
                                    : isOnline
                                    ? 'online'
                                    : 'offline'
                                }`}
                              >
                                {d.isRecording ? 'Recording' : isOnline ? 'Online' : 'Offline'}
                              </span>
                            </td>
                            <td>
                              {isOnline ? (
                                <span className="active-now-badge">
                                  <span className="pulse-dot" /> Active now
                                </span>
                              ) : (
                                formatTimeAgo(d.lastSeen)
                              )}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--cyan)' }}>{d.totalRecordings || 0}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  className="btn-live-cam"
                                  onClick={() => handleStartLiveStream(d)}
                                  title="Watch live camera feed"
                                >
                                  <Radio size={13} className="live-icon-pulsing" />
                                  <span>Live View</span>
                                </button>
                                <button
                                  className="btn-action delete"
                                  onClick={() => handleDeleteDevice(d.deviceId)}
                                  title="Remove Device"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredDevices.length > devicesPerPage && (
                  <div className="pagination-container">
                    <div className="pagination-info">
                      Showing {((devicePage - 1) * devicesPerPage) + 1} - {Math.min(devicePage * devicesPerPage, filteredDevices.length)} of {filteredDevices.length} devices
                    </div>
                    <div className="pagination-actions">
                      <button
                        className="btn-page"
                        disabled={devicePage === 1}
                        onClick={() => setDevicePage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={16} />
                        <span>Prev</span>
                      </button>
                      <span className="page-indicator">
                        Page {devicePage} of {totalDevicePages}
                      </span>
                      <button
                        className="btn-page"
                        disabled={devicePage >= totalDevicePages}
                        onClick={() => setDevicePage((p) => Math.min(totalDevicePages, p + 1))}
                      >
                        <span>Next</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

          {/* TAB 3: RECORDINGS */}
          {activeTab === 'recordings' && (
            <div>
              <div className="section-header">
                <div>
                  <h2>Surveillance Video Recordings ({recordings.length})</h2>
                  <div className="section-subtitle">All 720p &amp; 480p videos uploaded from user phones</div>
                </div>
                <input
                  type="text"
                  placeholder="Filter by device, filename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '13px',
                    width: '260px',
                  }}
                />
              </div>

              {/* Batch Action Toolbar */}
              <div className="gallery-toolbar">
                <div className="gallery-toolbar-left">
                  <label className="select-all-toggle">
                    <input
                      type="checkbox"
                      checked={
                        filteredRecordings.length > 0 &&
                        filteredRecordings.every((r) => selectedRecordings.includes(r._id))
                      }
                      onChange={handleSelectAllToggle}
                      disabled={filteredRecordings.length === 0}
                    />
                    <span>
                      {selectedRecordings.length > 0
                        ? `${selectedRecordings.length} of ${filteredRecordings.length} Selected`
                        : `Select All (${filteredRecordings.length})`}
                    </span>
                  </label>
                  {selectedRecordings.length > 0 && (
                    <button
                      className="btn-toolbar-ghost"
                      onClick={() => setSelectedRecordings([])}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                <div className="gallery-toolbar-right">
                  {selectedRecordings.length > 0 && (
                    <button
                      className="btn-toolbar-danger"
                      onClick={handleDeleteSelected}
                      disabled={isDeleting}
                    >
                      <Trash2 size={14} />
                      <span>{isDeleting ? 'Deleting...' : `Delete Selected (${selectedRecordings.length})`}</span>
                    </button>
                  )}

                  <button
                    className="btn-toolbar-danger-outline"
                    onClick={handleDeleteAllRecordings}
                    disabled={isDeleting || recordings.length === 0}
                    title="Permanently delete all videos from Google Drive and database"
                  >
                    <Trash2 size={14} />
                    <span>Delete All</span>
                  </button>
                </div>
              </div>

              {filteredRecordings.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Video size={28} />
                  </div>
                  <h3>No recordings found</h3>
                  <p>Recorded videos will automatically upload here right after each recording stops.</p>
                </div>
              ) : (
                <>
                  <div className="videos-grid">
                  {paginatedRecordings.map((rec) => {
                    const isSelected = selectedRecordings.includes(rec._id);
                    return (
                      <div key={rec._id} className={`video-card ${isSelected ? 'selected' : ''}`}>
                        <div
                          className="video-preview"
                          onClick={() => setSelectedVideo(rec)}
                        >
                          {/* Selection Checkbox Badge */}
                          <div
                            className={`card-select-badge ${isSelected ? 'checked' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectRecording(rec._id);
                            }}
                            title={isSelected ? 'Deselect video' : 'Select video'}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ cursor: 'pointer', pointerEvents: 'none' }}
                            />
                          </div>

                          <div className="play-overlay">
                            <div className="play-button-icon">
                              <Play size={24} fill="#000" />
                            </div>
                          </div>
                        </div>

                      <div className="video-card-body">
                        <div className="video-meta-top">
                          <span className="video-quality-chip">{rec.quality || '720p'}</span>
                          <span className="video-size-chip">{formatSize(rec.fileSizeBytes)}</span>
                        </div>

                        <div className="video-card-title">{rec.fileName}</div>

                        <div className="video-card-details">
                          <div>
                            <Smartphone size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            {rec.deviceName} ({rec.deviceId})
                          </div>
                          <div>
                            <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            {new Date(rec.uploadedAt).toLocaleString()}
                          </div>
                          {rec.latitude && rec.longitude && (
                            <div>
                              <a
                                href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: 'var(--cyan)',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px',
                                }}
                              >
                                <MapPin size={12} />
                                <span>{rec.locationName || `${rec.latitude.toFixed(2)}, ${rec.longitude.toFixed(2)}`}</span>
                              </a>
                            </div>
                          )}
                          {rec.driveFileId ? (
                            <div style={{ color: 'var(--emerald)' }}>
                              <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                              Synced with Google Drive
                            </div>
                          ) : (
                            <div style={{ color: 'var(--amber)' }}>
                              <Info size={12} style={{ display: 'inline', marginRight: '4px' }} />
                              Stored Locally on Server
                            </div>
                          )}
                        </div>

                        <div className="video-card-actions">
                          <button
                            className="btn-action"
                            onClick={() => setSelectedVideo(rec)}
                          >
                            <Play size={13} /> Play
                          </button>

                          {rec.driveViewLink ? (
                            <a
                              href={rec.driveViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-action drive"
                            >
                              <ExternalLink size={13} /> Drive
                            </a>
                          ) : (
                            <a
                              href={`${API_BASE_URL}/api/videos/download/${rec._id}`}
                              className="btn-action"
                              download
                            >
                              <Download size={13} /> Download
                            </a>
                          )}

                          <button
                            className="btn-action delete"
                            onClick={() => handleDeleteRecording(rec._id)}
                            title="Delete Video"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {filteredRecordings.length > videosPerPage && (
                  <div className="pagination-container">
                    <div className="pagination-info">
                      Showing {((videoPage - 1) * videosPerPage) + 1} - {Math.min(videoPage * videosPerPage, filteredRecordings.length)} of {filteredRecordings.length} recordings
                    </div>
                    <div className="pagination-actions">
                      <button
                        className="btn-page"
                        disabled={videoPage === 1}
                        onClick={() => setVideoPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={16} />
                        <span>Prev</span>
                      </button>
                      <span className="page-indicator">
                        Page {videoPage} of {totalVideoPages}
                      </span>
                      <button
                        className="btn-page"
                        disabled={videoPage >= totalVideoPages}
                        onClick={() => setVideoPage((p) => Math.min(totalVideoPages, p + 1))}
                      >
                        <span>Next</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

          {/* TAB 4: SETTINGS & DRIVE SETUP */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '800px' }}>
              <div className="section-header">
                <div>
                  <h2>Google Drive &amp; Cloud Setup</h2>
                  <div className="section-subtitle">Configure your central Google Drive account for all users</div>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px',
                  marginBottom: '24px',
                }}
              >
                <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CloudUpload size={18} color="var(--cyan)" />
                  How to link your Google Drive (in 3 Simple Steps)
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
                  To allow all distributed devices to upload videos directly into your personal or workspace Google Drive without asking users to log into your account:
                </p>

                <ol style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <li>
                    <strong>Create a Google Service Account:</strong> Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>Google Cloud Console</a>, enable the <em>Google Drive API</em>, create a <em>Service Account</em>, and download the key as <code>service_account.json</code>.
                  </li>
                  <li>
                    <strong>Put the key in backend:</strong> Place the downloaded <code>service_account.json</code> file inside the <code>/backend</code> directory.
                  </li>
                  <li>
                    <strong>Share your Drive Folder:</strong> Create a folder in your Google Drive (e.g. "Third Eye Surveillance"), click <em>Share</em>, and add the Service Account's email address as an <strong>Editor</strong>. Then copy the Folder ID into <code>backend/.env</code> (<code>GOOGLE_DRIVE_FOLDER_ID</code>).
                  </li>
                </ol>

                <div
                  style={{
                    marginTop: '20px',
                    padding: '14px',
                    background: 'rgba(0, 229, 255, 0.05)',
                    border: '1px solid rgba(0, 229, 255, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                  }}
                >
                  💡 <strong>Fallback mode active:</strong> Until you add <code>service_account.json</code>, all recorded videos are safely stored and streamed directly from the local server (<code>backend/uploads</code>). You can still watch and download everything right here!
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '24px',
                }}
              >
                <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '12px' }}>
                  Backend Server Information
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Backend URL: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>{API_BASE_URL}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Upload Endpoint: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--emerald)' }}>{API_BASE_URL}/api/videos/upload</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Device Telemetry Endpoint: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--emerald)' }}>{API_BASE_URL}/api/device/ping</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Video Modal Player */}
      {selectedVideo && (
        <div className="modal-overlay" onClick={() => setSelectedVideo(null)}>
          <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="video-modal-header">
              <div>
                <h3>{selectedVideo.fileName}</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {selectedVideo.deviceName} &bull; {formatSize(selectedVideo.fileSizeBytes)} &bull; {selectedVideo.quality || '720p'}
                </div>
              </div>
              <button
                className="close-modal-btn"
                onClick={() => setSelectedVideo(null)}
              >
                <X size={20} />
              </button>
            </div>

            <video
              className="modal-video-player"
              controls
              autoPlay
              src={`${API_BASE_URL}/api/videos/stream/${selectedVideo._id}`}
            >
              Your browser does not support the video tag.
            </video>

            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              {selectedVideo.driveViewLink && (
                <a
                  href={selectedVideo.driveViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-action drive"
                  style={{ maxWidth: '180px' }}
                >
                  <ExternalLink size={14} /> Open in Google Drive
                </a>
              )}
              <a
                href={`${API_BASE_URL}/api/videos/download/${selectedVideo._id}`}
                className="btn-action"
                style={{ maxWidth: '140px' }}
                download
              >
                <Download size={14} /> Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Live Surveillance Modal */}
      {liveDevice && (
        <div className="modal-overlay" onClick={handleStopLiveStream}>
          <div className="live-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="live-modal-header">
              <div className="live-header-info">
                <div className="live-pulsing-badge">
                  <span className="live-indicator-dot" />
                  <span>LIVE SURVEILLANCE</span>
                </div>
                <h3>{liveDevice.deviceName || liveDevice.model}</h3>
                <div className="live-submeta">
                  <span>ID: {liveDevice.deviceId}</span>
                  <span>&bull;</span>
                  <span>Lens: {liveLens} CAMERA</span>
                  <span>&bull;</span>
                  <span style={{ color: liveFps > 0 ? 'var(--emerald)' : 'var(--amber)', fontWeight: 600 }}>
                    {liveFps > 0 ? `${liveFps} FPS` : 'Connecting...'}
                  </span>
                  <span>&bull;</span>
                  <span style={{ color: !isAudioMuted ? 'var(--emerald)' : 'var(--text-muted)', fontWeight: 600 }}>
                    Mic: {!isAudioMuted ? 'Streaming' : 'Muted'}
                  </span>
                </div>
              </div>

              <div className="live-header-actions">
                <button
                  className={`btn-live-control ${!isAudioMuted ? 'active-audio' : ''}`}
                  onClick={toggleAudioMute}
                  title={isAudioMuted ? 'Unmute microphone audio' : 'Mute microphone audio'}
                >
                  {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <span>{isAudioMuted ? 'Unmute' : 'Audio Live'}</span>
                </button>

                <button
                  className="btn-live-control"
                  onClick={handleSwitchCamera}
                  title="Switch between Front and Back camera"
                >
                  <RefreshCw size={13} />
                  <span>Switch Lens ({liveLens === 'BACK' ? 'Front' : 'Back'})</span>
                </button>

                <button
                  className="btn-live-control"
                  onClick={handleTakeSnapshot}
                  disabled={!liveFrame}
                  title="Capture & download current frame"
                >
                  <Download size={13} />
                  <span>Snapshot</span>
                </button>

                <button
                  className="close-modal-btn"
                  onClick={handleStopLiveStream}
                  title="Stop Live Stream"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Live Video Viewport */}
            <div className="live-feed-viewport">
              {liveFrame ? (
                <img
                  src={liveFrame}
                  alt="Live Camera Feed"
                  className="live-video-stream"
                />
              ) : (
                <div className="live-feed-loader">
                  <div className="live-radar-spinner" />
                  <p>Connecting to {liveDevice.deviceName}&apos;s camera...</p>
                  <span>Waking up camera sensor silently in background...</span>
                </div>
              )}

              {/* Live HUD Overlay */}
              {liveFrame && (
                <div className="live-hud-overlay">
                  <div className="hud-top-left">
                    <span className="hud-rec-dot" />
                    <span>REC &bull; {liveLens}</span>
                  </div>
                  <div className="hud-top-right">
                    {!isAudioMuted ? (
                      <div className="audio-meter-badge" title="Microphone Active">
                        <Volume2 size={12} color="var(--emerald)" />
                        <div className="audio-bars">
                          <span className="audio-bar b1" style={{ height: `${Math.max(4, Math.min(16, audioLevel * 0.3))}px` }} />
                          <span className="audio-bar b2" style={{ height: `${Math.max(6, Math.min(20, audioLevel * 0.7))}px` }} />
                          <span className="audio-bar b3" style={{ height: `${Math.max(4, Math.min(16, audioLevel * 0.4))}px` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="audio-meter-badge muted" title="Microphone Muted">
                        <VolumeX size={12} color="var(--text-muted)" />
                        <span>Muted</span>
                      </div>
                    )}
                  </div>
                  <div className="hud-bottom-right">
                    <span>{new Date().toLocaleTimeString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="live-modal-footer">
              <div className="live-footer-note">
                <Info size={14} color="var(--cyan)" />
                <span>Streamed live via direct WebSocket packets. Zero server video storage used.</span>
              </div>
              <button
                className="btn-end-live"
                onClick={handleStopLiveStream}
              >
                End Live View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
