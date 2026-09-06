import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Radio,
  Trash2,
  MapPin,
  BatteryCharging,
  BatteryLow,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export default function Devices() {
  const {
    devices,
    onlineSocketDevices,
    searchQuery,
    setSearchQuery,
    handleStartLiveStream,
    handleDeleteDevice,
    formatTimeAgo,
  } = useDashboard();

  const [devicePage, setDevicePage] = useState(1);
  const devicesPerPage = 8;

  // Filter devices by search query
  const filteredDevices = devices.filter((d) =>
    (d.deviceName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.model || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.deviceId || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDevicePages = Math.ceil(filteredDevices.length / devicesPerPage) || 1;
  const paginatedDevices = filteredDevices.slice(
    (devicePage - 1) * devicesPerPage,
    devicePage * devicesPerPage
  );

  useEffect(() => {
    setDevicePage(1);
  }, [searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone size={22} className="text-cyan-400" />
            <span>Connected Devices ({devices.length})</span>
          </h2>
          <p className="text-xs text-gray-400">Real-time status, battery levels, and activity tracking</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search device by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#101725] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50"
          />
        </div>
      </div>

      {filteredDevices.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#101725]/50 border border-white/10 text-center">
          <Smartphone size={32} className="text-gray-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No matching devices found</h3>
          <p className="text-xs text-gray-400 mt-1">
            Ensure devices have the Third Eye app installed and connected to internet.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#101725]/80 border border-white/10 overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#07090e]/80 border-b border-white/10 text-xs font-mono uppercase text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">Device Name / Model</th>
                  <th className="px-5 py-3.5">Device ID</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5">Battery</th>
                  <th className="px-5 py-3.5">Resolution</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Last Active</th>
                  <th className="px-5 py-3.5">Total Videos</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedDevices.map((d) => {
                  const isOnline =
                    onlineSocketDevices.has(d.deviceId) ||
                    (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60);

                  return (
                    <tr key={d.deviceId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-400/25 flex items-center justify-center text-cyan-400 shrink-0">
                            <Smartphone size={18} />
                          </div>
                          <div>
                            <div className="font-semibold text-white">{d.deviceName || 'Android Device'}</div>
                            <div className="text-xs text-gray-400">
                              {d.model} (v{d.androidVersion || 'Android'})
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-gray-300 bg-white/5 px-2 py-1 rounded border border-white/5">
                          {d.deviceId}
                        </span>
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
                          <span className="text-xs text-gray-500">
                            {d.ipAddress ? d.ipAddress.split(',')[0] : 'Locating...'}
                          </span>
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

                      <td className="px-5 py-4 font-bold text-[#00e5ff]">{d.totalRecordings || 0}</td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleStartLiveStream(d)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-semibold transition-all shadow-[0_0_10px_rgba(239,68,68,0.15)]"
                          >
                            <Radio size={12} className="animate-pulse" />
                            <span>Live View</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDevice(d.deviceId)}
                            title="Remove Device"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
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

          {/* Pagination Controls */}
          {filteredDevices.length > devicesPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-[#07090e]/60 border-t border-white/10">
              <div className="text-xs text-gray-400">
                Showing {(devicePage - 1) * devicesPerPage + 1} -{' '}
                {Math.min(devicePage * devicesPerPage, filteredDevices.length)} of {filteredDevices.length} devices
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={devicePage === 1}
                  onClick={() => setDevicePage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>
                <span className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-400/20 text-xs font-mono text-[#00e5ff]">
                  Page {devicePage} of {totalDevicePages}
                </span>
                <button
                  disabled={devicePage >= totalDevicePages}
                  onClick={() => setDevicePage((p) => Math.min(totalDevicePages, p + 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
