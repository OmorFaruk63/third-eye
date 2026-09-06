import React from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone,
  Video,
  HardDrive,
  Radio,
  Play,
  ExternalLink,
  MapPin,
  BatteryCharging,
  BatteryLow,
  Clock,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export default function Overview() {
  const {
    stats,
    devices,
    recordings,
    onlineSocketDevices,
    liveOnlineCount,
    setSelectedVideo,
    handleStartLiveStream,
    formatSize,
    formatTimeAgo,
  } = useDashboard();

  return (
    <div className="space-y-8">
      {/* 4-Card Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Total Devices */}
        <div className="p-5 rounded-2xl bg-[#101725]/80 border border-white/10 backdrop-blur-md hover:border-cyan-400/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Devices</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-[#00e5ff]">
              <Smartphone size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white tracking-tight">{stats.totalDevices}</div>
          <div className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
            <span className="text-emerald-400 font-bold">{liveOnlineCount} active</span>
            <span>connected now</span>
          </div>
        </div>

        {/* Recording Live */}
        <div className="p-5 rounded-2xl bg-[#101725]/80 border border-white/10 backdrop-blur-md hover:border-red-500/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recording Live</span>
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <Radio size={18} />
            </div>
          </div>
          <div className={`text-2xl md:text-3xl font-bold tracking-tight ${stats.recordingNow > 0 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {stats.recordingNow}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {stats.recordingNow > 0 ? 'Active stealth recording in progress' : 'Standby mode'}
          </div>
        </div>

        {/* Total Videos */}
        <div className="p-5 rounded-2xl bg-[#101725]/80 border border-white/10 backdrop-blur-md hover:border-emerald-400/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Videos</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-[#00e676]">
              <Video size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white tracking-tight">{stats.totalRecordings}</div>
          <div className="text-xs text-gray-400 mt-2">Captured &amp; preserved</div>
        </div>

        {/* Total Cloud Storage */}
        <div className="p-5 rounded-2xl bg-[#101725]/80 border border-white/10 backdrop-blur-md hover:border-amber-400/40 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Google Drive Storage</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <HardDrive size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {stats.storageUsedGB >= 1
              ? `${stats.storageUsedGB} GB`
              : `${stats.storageUsedMB || 0} MB`}
          </div>
          <div className="text-xs text-gray-400 mt-2">Direct cloud preserved</div>
        </div>
      </div>

      {/* Recent Surveillance Videos Preview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Video size={20} className="text-cyan-400" />
              <span>Recent Surveillance Recordings</span>
            </h2>
            <p className="text-xs text-gray-400">Latest recordings uploaded from user phones</p>
          </div>
          <Link
            to="/recordings"
            className="text-xs font-semibold text-[#00e5ff] hover:text-cyan-300 hover:underline flex items-center gap-1"
          >
            <span>View All ({recordings.length})</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {recordings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#101725]/50 border border-white/10 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 mx-auto mb-3">
              <Video size={22} />
            </div>
            <h3 className="text-sm font-semibold text-white">No recordings captured yet</h3>
            <p className="text-xs text-gray-400 mt-1">
              Videos will appear here automatically when recording sessions finish on phones.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recordings.slice(0, 3).map((rec) => (
              <div
                key={rec._id}
                className="group rounded-2xl bg-[#101725]/80 border border-white/10 overflow-hidden hover:border-cyan-400/40 transition-all flex flex-col"
              >
                <div
                  onClick={() => setSelectedVideo(rec)}
                  className="relative aspect-video bg-black/60 flex items-center justify-center cursor-pointer group-hover:opacity-95 transition-opacity"
                >
                  <div className="w-11 h-11 rounded-full bg-cyan-400/90 text-black flex items-center justify-center shadow-lg shadow-cyan-400/40 group-hover:scale-110 transition-transform">
                    <Play size={20} fill="#000" />
                  </div>
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/70 border border-white/15 text-[10px] font-mono text-white">
                    {rec.quality || '720p'}
                  </div>
                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 border border-white/15 text-[10px] font-mono text-cyan-300">
                    {formatSize(rec.fileSizeBytes)}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white truncate mb-2">{rec.fileName}</h4>
                    <div className="space-y-1 text-xs text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Smartphone size={12} className="text-cyan-400" />
                        <span className="truncate">{rec.deviceName || 'Android'} ({rec.deviceId})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-emerald-400" />
                        <span>{formatTimeAgo(rec.uploadedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedVideo(rec)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#00e5ff] hover:underline"
                    >
                      <Play size={12} /> Play
                    </button>
                    {rec.driveViewLink && (
                      <a
                        href={rec.driveViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:underline"
                      >
                        <ExternalLink size={12} /> Drive
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connected Devices Quick Overview Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Smartphone size={20} className="text-emerald-400" />
              <span>Active Connected Devices</span>
            </h2>
            <p className="text-xs text-gray-400">Real-time status and live camera surveillance triggers</p>
          </div>
          <Link
            to="/devices"
            className="text-xs font-semibold text-[#00e5ff] hover:text-cyan-300 hover:underline flex items-center gap-1"
          >
            <span>Manage All ({devices.length})</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {devices.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#101725]/50 border border-white/10 text-center">
            <Smartphone size={28} className="text-gray-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white">No devices connected</h3>
            <p className="text-xs text-gray-400 mt-1">
              Devices running Third Eye will automatically register on first start.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#101725]/80 border border-white/10 overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#07090e]/80 border-b border-white/10 text-xs font-mono uppercase text-gray-400">
                  <tr>
                    <th className="px-5 py-3.5">Device</th>
                    <th className="px-5 py-3.5">Location</th>
                    <th className="px-5 py-3.5">Battery</th>
                    <th className="px-5 py-3.5">Resolution</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Last Active</th>
                    <th className="px-5 py-3.5">Videos</th>
                    <th className="px-5 py-3.5 text-right">Live View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {devices.slice(0, 5).map((d) => {
                    const isOnline =
                      onlineSocketDevices.has(d.deviceId) ||
                      (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60);

                    return (
                      <tr key={d.deviceId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-400/25 flex items-center justify-center text-cyan-400 shrink-0">
                              <Smartphone size={16} />
                            </div>
                            <div>
                              <div className="font-semibold text-white">{d.deviceName || d.model}</div>
                              <div className="text-xs font-mono text-gray-500">{d.deviceId}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {d.latitude && d.longitude ? (
                            <a
                              href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-400/25 text-[#00e5ff] text-xs font-medium hover:bg-cyan-500/20"
                            >
                              <MapPin size={12} />
                              <span>{d.locationName || `${d.latitude.toFixed(2)}, ${d.longitude.toFixed(2)}`}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-gray-500">{d.ipAddress ? d.ipAddress.split(',')[0] : 'Locating...'}</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                              d.batteryLevel > 50
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : d.batteryLevel > 20
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {d.batteryLevel > 50 ? <BatteryCharging size={13} /> : <BatteryLow size={13} />}
                            <span>{d.batteryLevel}%</span>
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-mono text-gray-300">
                            {d.videoQuality || '720p'}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              d.isRecording
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse'
                                : isOnline
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/5 text-gray-400 border border-white/10'
                            }`}
                          >
                            {d.isRecording ? 'Recording' : isOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-400/25 text-emerald-400 text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                              <span>Active now</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">{formatTimeAgo(d.lastSeen)}</span>
                          )}
                        </td>

                        <td className="px-5 py-4 font-bold text-white">{d.totalRecordings || 0}</td>

                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleStartLiveStream(d)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-semibold transition-all shadow-[0_0_10px_rgba(239,68,68,0.15)]"
                          >
                            <Radio size={12} className="animate-pulse" />
                            <span>Live Camera</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
