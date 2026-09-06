import React, { useState } from 'react';
import {
  CloudUpload,
  Settings as SettingsIcon,
  Server,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  HardDrive,
  Zap,
} from 'lucide-react';
import { API_BASE_URL, useDashboard } from '../context/DashboardContext';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';

export default function Settings() {
  const { stats, serverOnline } = useDashboard();
  const [copiedKey, setCopiedKey] = useState(null);
  const [pingLatency, setPingLatency] = useState(null);
  const [isPinging, setIsPinging] = useState(false);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestPing = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`);
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        setPingLatency(`${elapsed} ms`);
      } else {
        setPingLatency(`HTTP ${res.status}`);
      }
    } catch {
      setPingLatency('Offline / Error');
    } finally {
      setIsPinging(false);
    }
  };

  // Google Drive free quota math (15GB)
  const totalFreeQuotaMB = 15 * 1024;
  const usedMB = stats.storageUsedMB || (stats.storageUsedGB ? stats.storageUsedGB * 1024 : 0);
  const quotaPercent = Math.min(100, Math.max(0.5, parseFloat(((usedMB / totalFreeQuotaMB) * 100).toFixed(1))));

  return (
    <Box sx={{ maxWidth: 1024, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      {/* Page Header */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <SettingsIcon size={22} color="#00e5ff" />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
            System Configuration &amp; Cloud Integration
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.3 }}>
          Manage central Google Drive vault, telemetry relays, and background surveillance gateways
        </Typography>
      </Box>

      {/* Cloud Storage Quota Card */}
      <Card sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: '12px',
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b',
              boxShadow: '0 0 15px rgba(245,158,11,0.2)', flexShrink: 0,
            }}>
              <HardDrive size={22} />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
                Google Drive Lifetime Storage Quota
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                15 GB Free permanent cloud archive allocated per Google Service Account
              </Typography>
            </Box>
          </Box>

          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
            <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: '#fff' }}>
              {stats.storageUsedGB >= 1 ? `${stats.storageUsedGB} GB` : `${stats.storageUsedMB || 0} MB`}
              <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontFamily: 'inherit', ml: 1 }}>
                / 15 GB
              </Typography>
            </Typography>
            <Typography variant="caption" sx={{ color: '#f59e0b', fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
              {quotaPercent}% Used
            </Typography>
          </Box>
        </Box>

        {/* Visual Progress Bar */}
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={quotaPercent}
            sx={{
              height: 10, borderRadius: 5,
              backgroundColor: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': {
                background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                borderRadius: 5,
                boxShadow: '0 0 10px rgba(245,158,11,0.4)',
              },
            }}
          />
        </Box>

        <Paper sx={{
          p: 2, borderRadius: 2,
          background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)',
          display: 'flex', alignItems: 'flex-start', gap: 1.5,
        }}>
          <ShieldCheck size={20} color="#00e5ff" style={{ flexShrink: 0, marginTop: 2 }} />
          <Typography variant="caption" sx={{ color: '#67e8f9', lineHeight: 1.6 }}>
            <strong style={{ color: '#fff' }}>Zero Server Disk Consumption:</strong> When client phones finish recording, videos upload straight to Google Drive. The backend automatically purges local temp files instantly, keeping Render server disk storage at 0 MB forever!
          </Typography>
        </Paper>
      </Card>

      {/* Google Drive Setup Guide Card */}
      <Card sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CloudUpload size={22} color="#00e5ff" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
              Google Drive Automated Linking (3-Step Setup)
            </Typography>
          </Box>
          <Chip
            size="small"
            label="One-Time Setup"
            sx={{
              background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)',
              color: '#00e676', fontWeight: 700,
            }}
          />
        </Box>

        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 3 }}>
          Allows all client phones to upload surveillance recordings directly into your Google Drive without prompting users to sign in.
        </Typography>

        <Grid container spacing={2}>
          {/* Step 1 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{
              p: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { borderColor: 'rgba(0,229,255,0.3)' }, transition: 'all 0.2s',
            }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{
                    width: 26, height: 26, borderRadius: '8px',
                    background: 'rgba(0,229,255,0.15)', color: '#00e5ff',
                    fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    1
                  </Box>
                  <Button
                    size="small"
                    component="a"
                    href="https://console.cloud.google.com"
                    target="_blank"
                    rel="noreferrer"
                    endIcon={<ExternalLink size={11} />}
                    sx={{ fontSize: '0.7rem', color: '#00e5ff', py: 0.2, minWidth: 0 }}
                  >
                    GCP Console
                  </Button>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                  Create Service Account
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5, display: 'block' }}>
                  In Google Cloud Console, enable <em>Google Drive API</em>, create a <em>Service Account</em>, and generate a JSON key.
                </Typography>
              </Box>
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#00e5ff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  service_account.json
                </Typography>
                <IconButton size="small" onClick={() => copyToClipboard('service_account.json', 's1')} sx={{ color: '#94a3b8' }}>
                  {copiedKey === 's1' ? <Check size={14} color="#00e676" /> : <Copy size={14} />}
                </IconButton>
              </Box>
            </Paper>
          </Grid>

          {/* Step 2 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{
              p: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { borderColor: 'rgba(0,229,255,0.3)' }, transition: 'all 0.2s',
            }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{
                    width: 26, height: 26, borderRadius: '8px',
                    background: 'rgba(0,229,255,0.15)', color: '#00e5ff',
                    fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    2
                  </Box>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#64748b' }}>
                    Directory
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                  Place Key in Backend
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5, display: 'block' }}>
                  Save the downloaded key into the backend folder so the server can authenticate with Google Drive API.
                </Typography>
              </Box>
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#00e5ff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  /backend/service_account.json
                </Typography>
                <IconButton size="small" onClick={() => copyToClipboard('backend/service_account.json', 's2')} sx={{ color: '#94a3b8' }}>
                  {copiedKey === 's2' ? <Check size={14} color="#00e676" /> : <Copy size={14} />}
                </IconButton>
              </Box>
            </Paper>
          </Grid>

          {/* Step 3 */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{
              p: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { borderColor: 'rgba(0,229,255,0.3)' }, transition: 'all 0.2s',
            }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box sx={{
                    width: 26, height: 26, borderRadius: '8px',
                    background: 'rgba(0,229,255,0.15)', color: '#00e5ff',
                    fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    3
                  </Box>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#64748b' }}>
                    Permissions
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                  Share Drive Folder
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5, display: 'block' }}>
                  Create a folder in Drive, share it with the Service Account email as <strong style={{ color: '#fff' }}>Editor</strong>, and add the ID into backend .env.
                </Typography>
              </Box>
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#00e5ff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  GOOGLE_DRIVE_FOLDER_ID
                </Typography>
                <IconButton size="small" onClick={() => copyToClipboard('GOOGLE_DRIVE_FOLDER_ID', 's3')} sx={{ color: '#94a3b8' }}>
                  {copiedKey === 's3' ? <Check size={14} color="#00e676" /> : <Copy size={14} />}
                </IconButton>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Card>

      {/* Active API Endpoints Panel */}
      <Card sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Server size={20} color="#00e676" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
                Active Gateway Endpoints &amp; Telemetry Relay
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.3 }}>
              Central REST &amp; WebSocket URLs consumed by Android background clients
            </Typography>
          </Box>

          <Button
            size="small"
            variant="outlined"
            onClick={handleTestPing}
            disabled={isPinging}
            startIcon={<Zap size={13} className={isPinging ? 'spinning' : ''} />}
            sx={{
              borderColor: 'rgba(0,229,255,0.3)',
              color: '#00e5ff',
              background: 'rgba(0,229,255,0.06)',
              alignSelf: { xs: 'flex-start', sm: 'center' },
              '&:hover': { background: 'rgba(0,229,255,0.15)', borderColor: '#00e5ff' },
            }}
          >
            <span>{isPinging ? 'Testing...' : 'Test Connection / Ping'}</span>
            {pingLatency && (
              <Box component="span" sx={{ ml: 1, px: 1, py: 0.2, borderRadius: 1, background: 'rgba(0,0,0,0.6)', color: '#00e676', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                {pingLatency}
              </Box>
            )}
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Endpoint 1: Video Upload */}
          <Paper sx={{
            p: 1.5, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 1,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip size="small" label="POST" sx={{ height: 20, background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676', fontWeight: 700, fontSize: '0.65rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                Video Upload Stream:
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: { xs: 0, sm: 'auto' } }}>
              <Typography variant="caption" sx={{ color: '#00e5ff', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {API_BASE_URL}/api/videos/upload
              </Typography>
              <IconButton size="small" onClick={() => copyToClipboard(`${API_BASE_URL}/api/videos/upload`, 'ep1')} sx={{ color: '#94a3b8' }}>
                {copiedKey === 'ep1' ? <Check size={14} color="#00e676" /> : <Copy size={14} />}
              </IconButton>
            </Box>
          </Paper>

          {/* Endpoint 2: Device Ping */}
          <Paper sx={{
            p: 1.5, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 1,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip size="small" label="POST" sx={{ height: 20, background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.3)', color: '#00e5ff', fontWeight: 700, fontSize: '0.65rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                Heartbeat &amp; Telemetry:
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: { xs: 0, sm: 'auto' } }}>
              <Typography variant="caption" sx={{ color: '#00e5ff', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {API_BASE_URL}/api/device/ping
              </Typography>
              <IconButton size="small" onClick={() => copyToClipboard(`${API_BASE_URL}/api/device/ping`, 'ep2')} sx={{ color: '#94a3b8' }}>
                {copiedKey === 'ep2' ? <Check size={14} color="#00e676" /> : <Copy size={14} />}
              </IconButton>
            </Box>
          </Paper>

          {/* Endpoint 3: Health Check */}
          <Paper sx={{
            p: 1.5, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 1,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chip size="small" label="GET" sx={{ height: 20, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', fontWeight: 700, fontSize: '0.65rem' }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                Health &amp; MongoDB Status:
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: { xs: 0, sm: 'auto' } }}>
              <Typography variant="caption" sx={{ color: '#00e5ff', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {API_BASE_URL}/api/health
              </Typography>
              <IconButton size="small" onClick={() => copyToClipboard(`${API_BASE_URL}/api/health`, 'ep3')} sx={{ color: '#94a3b8' }}>
                {copiedKey === 'ep3' ? <Check size={14} color="#00e676" /> : <Copy size={14} />}
              </IconButton>
            </Box>
          </Paper>
        </Box>

        <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#00e676', fontSize: '0.8rem' }}>
            <CheckCircle2 size={14} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#00e676' }}>
              Backend online and database synced
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
            Relay Protocol: Socket.io v4 WebSockets
          </Typography>
        </Box>
      </Card>
    </Box>
  );
}
