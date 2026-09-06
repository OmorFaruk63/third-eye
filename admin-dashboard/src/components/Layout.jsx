import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Eye,
  Smartphone,
  Video,
  Settings,
  LayoutDashboard,
  RefreshCw,
  Menu,
  X,
  Radio,
  Download,
  Volume2,
  VolumeX,
  Info,
  ExternalLink,
} from 'lucide-react';
import { useDashboard, API_BASE_URL } from '../context/DashboardContext';

export default function Layout() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();

  const {
    stats,
    devices,
    recordings,
    loading,
    serverOnline,
    autoRefresh,
    setAutoRefresh,
    selectedVideo,
    setSelectedVideo,
    liveDevice,
    liveFrame,
    liveLens,
    liveFps,
    isAudioMuted,
    audioLevel,
    fetchData,
    handleStopLiveStream,
    handleSwitchCamera,
    handleTakeSnapshot,
    toggleAudioMute,
    formatSize,
  } = useDashboard();

  // Determine current page title & description
  const getPageMeta = () => {
    switch (location.pathname) {
      case '/devices':
        return {
          title: 'Connected Devices',
          desc: 'Real-time telemetry, battery, and recording status of devices.',
        };
      case '/recordings':
        return {
          title: 'Video Surveillance Gallery',
          desc: 'Browse, stream, and download 720p recordings stored in Admin Drive.',
        };
      case '/settings':
        return {
          title: 'System Configuration',
          desc: 'Google Drive Service Account setup and API preferences.',
        };
      case '/overview':
      case '/':
      default:
        return {
          title: 'System Overview',
          desc: 'Live status of all distributed devices and background uploads.',
        };
    }
  };

  const pageMeta = getPageMeta();

  return (
    <div className="flex min-h-screen bg-[#07090e] text-[#f0f4fc]">
      {/* Mobile Drawer Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Sidebar Navigation (Desktop Sticky + Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-[#0d121d] border-r border-white/10 p-6 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isDrawerOpen ? 'translate-x-0 shadow-2xl shadow-cyan-500/20' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-400/40 flex items-center justify-center text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.25)]">
              <Eye size={22} />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white">THIRD EYE</div>
              <div className="text-[11px] font-mono text-[#00e5ff] uppercase tracking-widest">Command Center</div>
            </div>
          </div>

          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-2">
          <NavLink
            to="/"
            end
            onClick={() => setIsDrawerOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-[#00e5ff] border border-cyan-400/30 shadow-[0_0_15px_rgba(0,229,255,0.15)] font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard size={18} />
              <span>Overview</span>
            </div>
          </NavLink>

          <NavLink
            to="/devices"
            onClick={() => setIsDrawerOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-[#00e5ff] border border-cyan-400/30 shadow-[0_0_15px_rgba(0,229,255,0.15)] font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Smartphone size={18} />
              <span>Devices</span>
            </div>
            <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-white/10 text-gray-300">
              {devices.length}
            </span>
          </NavLink>

          <NavLink
            to="/recordings"
            onClick={() => setIsDrawerOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-[#00e5ff] border border-cyan-400/30 shadow-[0_0_15px_rgba(0,229,255,0.15)] font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Video size={18} />
              <span>Recordings</span>
            </div>
            <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-white/10 text-gray-300">
              {recordings.length}
            </span>
          </NavLink>

          <NavLink
            to="/settings"
            onClick={() => setIsDrawerOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-[#00e5ff] border border-cyan-400/30 shadow-[0_0_15px_rgba(0,229,255,0.15)] font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Settings size={18} />
              <span>Settings &amp; Drive</span>
            </div>
          </NavLink>
        </nav>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                !serverOnline
                  ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                  : stats.recordingNow > 0
                  ? 'bg-red-500 animate-ping'
                  : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
              }`}
            />
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">
                {serverOnline ? 'Server Online' : 'Server Disconnected'}
              </div>
              <div className="text-[10px] text-gray-500 font-mono truncate">
                {API_BASE_URL.replace(/^https?:\/\//, '')}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-[#0d121d]/90 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 rounded-xl bg-white/5 text-[#00e5ff] border border-white/10 hover:bg-cyan-500/10 lg:hidden shrink-0"
              aria-label="Open menu drawer"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white tracking-tight truncate">{pageMeta.title}</h1>
              <p className="text-xs text-gray-400 truncate hidden sm:block">{pageMeta.desc}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label className="hidden md:flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded accent-cyan-400"
              />
              <span>Live Polling (30s)</span>
            </label>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-gray-200 border border-white/10 hover:border-cyan-400/40 hover:text-[#00e5ff] hover:bg-cyan-500/10 text-xs font-medium transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-400' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Video Player Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="w-full max-w-3xl bg-[#0d1422] border border-white/15 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#07090e]">
              <div>
                <h3 className="text-sm font-semibold text-white">{selectedVideo.fileName}</h3>
                <div className="text-xs text-gray-400">
                  {selectedVideo.deviceName} &bull; {formatSize(selectedVideo.fileSizeBytes)} &bull;{' '}
                  {selectedVideo.quality || '720p'}
                </div>
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-black flex items-center justify-center">
              <video
                className="w-full max-h-[60vh] object-contain"
                controls
                autoPlay
                src={`${API_BASE_URL}/api/videos/stream/${selectedVideo._id}`}
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-3 bg-[#0d1422] border-t border-white/10">
              {selectedVideo.driveViewLink && (
                <a
                  href={selectedVideo.driveViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-[#00e5ff] hover:bg-cyan-500/25 text-xs font-semibold"
                >
                  <ExternalLink size={13} />
                  <span>Google Drive</span>
                </a>
              )}
              <a
                href={`${API_BASE_URL}/api/videos/download/${selectedVideo._id}`}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-[#00e676] hover:bg-emerald-500/25 text-xs font-semibold"
              >
                <Download size={13} />
                <span>Download</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Global Real-Time Live Surveillance Modal (Video + Audio) */}
      {liveDevice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md"
          onClick={handleStopLiveStream}
        >
          <div
            className="w-full max-w-4xl bg-[#0d1422] border border-cyan-400/30 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,229,255,0.2)] flex flex-col max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Live Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#07090e] border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-mono font-bold tracking-wider animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>LIVE SURVEILLANCE</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{liveDevice.deviceName || liveDevice.model}</h3>
                  <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
                    <span>ID: {liveDevice.deviceId}</span>
                    <span>&bull;</span>
                    <span>Lens: {liveLens}</span>
                    <span>&bull;</span>
                    <span className={liveFps > 0 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {liveFps > 0 ? `${liveFps} FPS` : 'Connecting...'}
                    </span>
                    <span>&bull;</span>
                    <span className={!isAudioMuted ? 'text-emerald-400 font-bold' : 'text-gray-500'}>
                      Mic: {!isAudioMuted ? 'Streaming' : 'Muted'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAudioMute}
                  title={isAudioMuted ? 'Unmute microphone audio' : 'Mute microphone audio'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    !isAudioMuted
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/40 shadow-[0_0_10px_rgba(0,230,118,0.2)]'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <span>{isAudioMuted ? 'Unmute' : 'Audio Live'}</span>
                </button>

                <button
                  onClick={handleSwitchCamera}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-cyan-400 border border-white/10 hover:bg-cyan-500/10 hover:border-cyan-400/30 transition-all"
                  title="Switch between Front and Back camera"
                >
                  <RefreshCw size={13} />
                  <span>Lens: {liveLens === 'BACK' ? 'Front' : 'Back'}</span>
                </button>

                <button
                  onClick={handleTakeSnapshot}
                  disabled={!liveFrame}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-gray-300 border border-white/10 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={13} />
                  <span>Snapshot</span>
                </button>

                <button
                  onClick={handleStopLiveStream}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Close Live Stream"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Live Video Viewport */}
            <div className="relative flex-1 bg-black min-h-[380px] max-h-[65vh] flex items-center justify-center overflow-hidden">
              {liveFrame ? (
                <img
                  src={liveFrame}
                  alt="Live Camera Feed"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin mb-4" />
                  <p className="text-sm font-semibold text-white mb-1">
                    Connecting to {liveDevice.deviceName}&apos;s camera...
                  </p>
                  <span className="text-xs text-gray-500">
                    Waking up camera sensor and microphone silently in background...
                  </span>
                </div>
              )}

              {/* HUD Overlay */}
              {liveFrame && (
                <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between bg-gradient-to-b from-black/40 via-transparent to-black/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-black/60 border border-white/20 text-white font-mono text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span>REC &bull; {liveLens}</span>
                    </div>

                    {!isAudioMuted ? (
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-black/60 border border-emerald-500/40 text-emerald-400 text-xs font-mono">
                        <Volume2 size={13} />
                        <div className="flex items-end gap-0.5 h-3.5">
                          <span
                            className="w-1 bg-emerald-400 rounded-sm transition-all duration-75"
                            style={{ height: `${Math.max(4, Math.min(14, audioLevel * 0.3))}px` }}
                          />
                          <span
                            className="w-1 bg-emerald-400 rounded-sm transition-all duration-75"
                            style={{ height: `${Math.max(6, Math.min(18, audioLevel * 0.7))}px` }}
                          />
                          <span
                            className="w-1 bg-emerald-400 rounded-sm transition-all duration-75"
                            style={{ height: `${Math.max(4, Math.min(14, audioLevel * 0.4))}px` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/60 border border-white/20 text-gray-500 text-xs font-mono">
                        <VolumeX size={13} />
                        <span>Muted</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <span className="px-2.5 py-1 rounded bg-black/60 border border-cyan-400/30 text-[#00e5ff] font-mono text-xs">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Live Modal Footer */}
            <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-3 bg-[#0d1422] border-t border-white/10">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Info size={14} className="text-cyan-400 shrink-0" />
                <span>Streamed live via direct WebSocket packets. Zero server video storage used.</span>
              </div>
              <button
                onClick={handleStopLiveStream}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors shadow-lg shadow-red-600/30"
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
