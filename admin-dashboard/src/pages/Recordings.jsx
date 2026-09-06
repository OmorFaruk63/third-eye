import React, { useState, useEffect } from 'react';
import {
  Video,
  Play,
  Download,
  Trash2,
  ExternalLink,
  MapPin,
  Calendar,
  Smartphone,
  CheckCircle2,
  Info,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useDashboard, API_BASE_URL } from '../context/DashboardContext';

export default function Recordings() {
  const {
    recordings,
    searchQuery,
    setSearchQuery,
    selectedRecordings,
    setSelectedRecordings,
    isDeleting,
    setSelectedVideo,
    toggleSelectRecording,
    handleSelectAllToggle,
    handleDeleteSelected,
    handleDeleteAllRecordings,
    handleDeleteRecording,
    formatSize,
  } = useDashboard();

  const [videoPage, setVideoPage] = useState(1);
  const videosPerPage = 6;

  // Filter recordings
  const filteredRecordings = recordings.filter((r) =>
    (r.deviceName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.deviceId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.fileName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalVideoPages = Math.ceil(filteredRecordings.length / videosPerPage) || 1;
  const paginatedRecordings = filteredRecordings.slice(
    (videoPage - 1) * videosPerPage,
    videoPage * videosPerPage
  );

  useEffect(() => {
    setVideoPage(1);
  }, [searchQuery]);

  const allVisibleSelected =
    filteredRecordings.length > 0 &&
    filteredRecordings.every((r) => selectedRecordings.includes(r._id));

  return (
    <div className="space-y-6">
      {/* Page Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Video size={22} className="text-cyan-400" />
            <span>Surveillance Video Recordings ({recordings.length})</span>
          </h2>
          <p className="text-xs text-gray-400">All 720p &amp; 480p videos uploaded from user phones</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by device, filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#101725] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400/50"
          />
        </div>
      </div>

      {/* Batch Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#101725]/80 border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-300">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={() => handleSelectAllToggle(filteredRecordings.map((r) => r._id))}
              disabled={filteredRecordings.length === 0}
              className="rounded accent-cyan-400"
            />
            <span>
              {selectedRecordings.length > 0
                ? `${selectedRecordings.length} of ${filteredRecordings.length} Selected`
                : `Select All (${filteredRecordings.length})`}
            </span>
          </label>

          {selectedRecordings.length > 0 && (
            <button
              onClick={() => setSelectedRecordings([])}
              className="text-xs text-gray-400 hover:text-white underline ml-2"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedRecordings.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
            >
              <Trash2 size={13} />
              <span>{isDeleting ? 'Deleting...' : `Delete Selected (${selectedRecordings.length})`}</span>
            </button>
          )}

          <button
            onClick={handleDeleteAllRecordings}
            disabled={isDeleting || recordings.length === 0}
            title="Permanently delete all videos from Google Drive and database"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={13} />
            <span>Delete All</span>
          </button>
        </div>
      </div>

      {filteredRecordings.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#101725]/50 border border-white/10 text-center">
          <Video size={32} className="text-gray-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No recordings found</h3>
          <p className="text-xs text-gray-400 mt-1">
            Recorded videos will automatically upload here right after each recording stops.
          </p>
        </div>
      ) : (
        <>
          {/* Responsive Video Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedRecordings.map((rec) => {
              const isSelected = selectedRecordings.includes(rec._id);

              return (
                <div
                  key={rec._id}
                  className={`group rounded-2xl bg-[#101725]/80 border transition-all overflow-hidden flex flex-col ${
                    isSelected
                      ? 'border-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.2)] bg-[#101725]'
                      : 'border-white/10 hover:border-cyan-400/40'
                  }`}
                >
                  {/* Thumbnail Video Preview Area */}
                  <div
                    onClick={() => setSelectedVideo(rec)}
                    className="relative aspect-video bg-black/70 flex items-center justify-center cursor-pointer group-hover:opacity-95 transition-opacity"
                  >
                    {/* Checkbox Select Badge */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectRecording(rec._id);
                      }}
                      className="absolute top-3 left-3 z-10 p-1.5 rounded-lg bg-black/60 border border-white/20 hover:border-cyan-400 transition-all cursor-pointer"
                      title={isSelected ? 'Deselect video' : 'Select video'}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded accent-cyan-400 pointer-events-none"
                      />
                    </div>

                    <div className="w-12 h-12 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-xl shadow-cyan-400/40 group-hover:scale-110 transition-transform">
                      <Play size={22} fill="#000" />
                    </div>

                    <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/80 border border-white/15 text-[11px] font-mono text-white">
                      {rec.quality || '720p'}
                    </div>

                    <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/80 border border-white/15 text-[11px] font-mono text-cyan-300">
                      {formatSize(rec.fileSizeBytes)}
                    </div>
                  </div>

                  {/* Video Meta Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white truncate mb-2.5" title={rec.fileName}>
                        {rec.fileName}
                      </h4>

                      <div className="space-y-1.5 text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                          <Smartphone size={13} className="text-cyan-400 shrink-0" />
                          <span className="truncate">
                            {rec.deviceName} ({rec.deviceId})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-emerald-400 shrink-0" />
                          <span>{new Date(rec.uploadedAt).toLocaleString()}</span>
                        </div>

                        {rec.latitude && rec.longitude && (
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#00e5ff] hover:underline flex items-center gap-1 truncate"
                            >
                              <MapPin size={13} className="shrink-0" />
                              <span className="truncate">
                                {rec.locationName || `${rec.latitude.toFixed(2)}, ${rec.longitude.toFixed(2)}`}
                              </span>
                            </a>
                          </div>
                        )}

                        <div className="pt-1">
                          {rec.driveFileId ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                              <CheckCircle2 size={13} />
                              <span>Synced with Google Drive</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-amber-400 text-xs">
                              <Info size={13} />
                              <span>Stored on Server</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedVideo(rec)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-[#00e5ff] hover:bg-cyan-500/25 text-xs font-semibold transition-all"
                      >
                        <Play size={12} />
                        <span>Play</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {rec.driveViewLink ? (
                          <a
                            href={rec.driveViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold"
                          >
                            <ExternalLink size={12} />
                            <span>Drive</span>
                          </a>
                        ) : (
                          <a
                            href={`${API_BASE_URL}/api/videos/download/${rec._id}`}
                            download
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white text-xs font-semibold"
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleDeleteRecording(rec._id)}
                          title="Delete Video"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {filteredRecordings.length > videosPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-[#101725]/80 border border-white/10">
              <div className="text-xs text-gray-400">
                Showing {(videoPage - 1) * videosPerPage + 1} -{' '}
                {Math.min(videoPage * videosPerPage, filteredRecordings.length)} of {filteredRecordings.length} recordings
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={videoPage === 1}
                  onClick={() => setVideoPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>
                <span className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-400/20 text-xs font-mono text-[#00e5ff]">
                  Page {videoPage} of {totalVideoPages}
                </span>
                <button
                  disabled={videoPage >= totalVideoPages}
                  onClick={() => setVideoPage((p) => Math.min(totalVideoPages, p + 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
