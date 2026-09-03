import React, { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

  // Delete recording
  const handleDeleteRecording = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recording?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/videos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRecordings((prev) => prev.filter((r) => r._id !== id));
        fetchData();
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
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

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-header">
          <div className="brand-icon">
            <Eye size={22} />
          </div>
          <div>
            <div className="brand-title">THIRD EYE</div>
            <div className="brand-subtitle">Command Center</div>
          </div>
        </div>

        <ul className="nav-list">
          <li
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </li>
          <li
            className={`nav-item ${activeTab === 'devices' ? 'active' : ''}`}
            onClick={() => setActiveTab('devices')}
          >
            <Smartphone size={18} />
            <span>Devices</span>
            <span className="badge">{devices.length}</span>
          </li>
          <li
            className={`nav-item ${activeTab === 'recordings' ? 'active' : ''}`}
            onClick={() => setActiveTab('recordings')}
          >
            <Video size={18} />
            <span>Recordings</span>
            <span className="badge">{recordings.length}</span>
          </li>
          <li
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
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

        {/* Content Body */}
        <main className="content-body">
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
                    <span style={{ color: 'var(--emerald)' }}>{stats.activeDevices} active</span> in last 10m
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
                          <th>Battery</th>
                          <th>Quality</th>
                          <th>Status</th>
                          <th>Last Active</th>
                          <th>Recordings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devices.slice(0, 5).map((d) => {
                          const isOnline = (new Date() - new Date(d.lastSeen)) / 1000 < 60;
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
                              <td>{formatTimeAgo(d.lastSeen)}</td>
                              <td style={{ fontWeight: 600, color: '#fff' }}>{d.totalRecordings || 0}</td>
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
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Device Name / Model</th>
                        <th>Device ID</th>
                        <th>Battery</th>
                        <th>Resolution</th>
                        <th>Status</th>
                        <th>IP Address</th>
                        <th>Last Active</th>
                        <th>Total Videos</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDevices.map((d) => {
                        const isOnline = (new Date() - new Date(d.lastSeen)) / 1000 < 60;
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
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                              {d.ipAddress || 'Local'}
                            </td>
                            <td>{formatTimeAgo(d.lastSeen)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--cyan)' }}>{d.totalRecordings || 0}</td>
                            <td>
                              <button
                                className="btn-action delete"
                                onClick={() => handleDeleteDevice(d.deviceId)}
                                title="Remove Device"
                              >
                                <Trash2 size={14} />
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

              {filteredRecordings.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Video size={28} />
                  </div>
                  <h3>No recordings found</h3>
                  <p>Recorded videos will automatically upload here right after each recording stops.</p>
                </div>
              ) : (
                <div className="videos-grid">
                  {filteredRecordings.map((rec) => (
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
                  ))}
                </div>
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
    </div>
  );
}
