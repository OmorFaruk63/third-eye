import React from 'react';
import { CloudUpload, Settings as SettingsIcon, Server, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../context/DashboardContext';

export default function Settings() {
  return (
    <div className="max-w-4xl space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <SettingsIcon size={22} className="text-cyan-400" />
          <span>Google Drive &amp; Cloud Setup</span>
        </h2>
        <p className="text-xs text-gray-400">Configure central Google Drive and verify system endpoints</p>
      </div>

      {/* Google Drive Setup Guide Card */}
      <div className="p-6 rounded-2xl bg-[#101725]/80 border border-white/10 backdrop-blur-md">
        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <CloudUpload size={20} className="text-[#00e5ff]" />
          <span>How to Link Your Google Drive (in 3 Simple Steps)</span>
        </h3>
        <p className="text-xs text-gray-300 leading-relaxed mb-4">
          To allow all distributed phones to upload surveillance recordings directly into your personal or workspace Google Drive without asking users to log into your personal account:
        </p>

        <ol className="space-y-3.5 text-xs text-gray-300 pl-5 list-decimal">
          <li className="leading-relaxed">
            <strong className="text-white">Create a Google Service Account:</strong> Go to the{' '}
            <a
              href="https://console.cloud.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-[#00e5ff] underline font-semibold"
            >
              Google Cloud Console
            </a>
            , enable the <em>Google Drive API</em>, create a <em>Service Account</em>, generate a new JSON key, and download it as{' '}
            <code className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">service_account.json</code>.
          </li>
          <li className="leading-relaxed">
            <strong className="text-white">Put the Key in Backend:</strong> Place the downloaded{' '}
            <code className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">service_account.json</code> file inside the{' '}
            <code className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">/backend</code> directory.
          </li>
          <li className="leading-relaxed">
            <strong className="text-white">Share your Drive Folder:</strong> Create a folder in your Google Drive (e.g. &quot;Third Eye Surveillance&quot;), click{' '}
            <em>Share</em>, and add the Service Account&apos;s email address as an <strong className="text-white">Editor</strong>. Then copy the Folder ID into{' '}
            <code className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">backend/.env</code> under{' '}
            <code className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">GOOGLE_DRIVE_FOLDER_ID</code>.
          </li>
        </ol>

        <div className="mt-5 p-4 rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-xs text-cyan-300 flex items-start gap-2.5">
          <ShieldCheck size={18} className="shrink-0 text-cyan-400" />
          <div className="leading-relaxed">
            <strong>Lifetime Free Storage:</strong> Google Drive gives 15 GB free per account. When videos are uploaded, the backend automatically deletes the temporary local file to keep server storage at virtually 0 MB!
          </div>
        </div>
      </div>

      {/* System Telemetry Endpoints Card */}
      <div className="p-6 rounded-2xl bg-[#101725]/80 border border-white/10 backdrop-blur-md">
        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Server size={18} className="text-emerald-400" />
          <span>Active API Endpoints Reference</span>
        </h3>
        <p className="text-xs text-gray-400 mb-4">Central endpoints used by Android background services and WebSocket relays</p>

        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 rounded-xl bg-[#07090e] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-gray-400">Video Upload:</span>
            <span className="text-emerald-400 break-all">{API_BASE_URL}/api/videos/upload</span>
          </div>

          <div className="p-3 rounded-xl bg-[#07090e] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-gray-400">Device Ping / Telemetry:</span>
            <span className="text-emerald-400 break-all">{API_BASE_URL}/api/device/ping</span>
          </div>

          <div className="p-3 rounded-xl bg-[#07090e] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-gray-400">Health Check &amp; Socket Status:</span>
            <span className="text-emerald-400 break-all">{API_BASE_URL}/api/health</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle2 size={14} />
          <span>Backend online and connected with MongoDB</span>
        </div>
      </div>
    </div>
  );
}
