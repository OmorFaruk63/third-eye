import React, { useState } from 'react';
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
  Battery,
  Trash2,
  Check,
  Copy,
  ArrowUpRight,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import LinearProgress from '@mui/material/LinearProgress';

export default function Overview() {
  const {
    stats,
    devices,
    recordings,
    onlineSocketDevices,
    liveOnlineCount,
    setSelectedVideo,
    handleStartLiveStream,
    handleDeleteDevice,
    formatSize,
    formatTimeAgo,
  } = useDashboard();

  const [copiedId, setCopiedId] = useState(null);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to format friendly video label from timestamp or filename
  const formatVideoTitle = (rec) => {
    if (rec.uploadedAt) {
      const d = new Date(rec.uploadedAt);
      return `REC_${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}_${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return rec.fileName.replace(/\.mp4$/i, '');
  };

  // Calculate Google Drive 15GB percentage
  const totalFreeQuotaMB = 15 * 1024;
  const usedMB = stats.storageUsedMB || (stats.storageUsedGB ? stats.storageUsedGB * 1024 : 0);
  const quotaPercent = Math.min(100, Math.max(1, parseFloat(((usedMB / totalFreeQuotaMB) * 100).toFixed(1))));

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* 4-Card Cyber Statistics Grid */}
      <Grid container spacing={{ xs: 1.5, md: 2.5 }}>
        {/* Card 1: Total Devices */}
        <Grid size={{ xs: 6, lg: 3 }}>
          <Card sx={{
            p: 2.5, position: 'relative', overflow: 'hidden',
            '&:hover': { borderColor: 'rgba(0,229,255,0.4)', transform: 'translateY(-2px)' },
            transition: 'all 0.25s ease',
          }}>
            <Box sx={{
              position: 'absolute', top: 0, left: 24, right: 24, height: '2px',
              background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.6), transparent)',
            }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
                Total Devices
              </Typography>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px',
                background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00e5ff',
                boxShadow: '0 0 15px rgba(0,229,255,0.2)',
              }}>
                <Smartphone size={20} />
              </Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.1 }}>
              {stats.totalDevices}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
              <Chip
                size="small"
                label={`${liveOnlineCount} Active`}
                sx={{
                  height: 22, px: 0.5,
                  background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)',
                  color: '#00e676', fontWeight: 700,
                  '& .MuiChip-label': { px: 1 },
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                connected relay
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* Card 2: Recording Live */}
        <Grid size={{ xs: 6, lg: 3 }}>
          <Card sx={{
            p: 2.5, position: 'relative', overflow: 'hidden',
            '&:hover': { borderColor: stats.recordingNow > 0 ? 'rgba(255,23,68,0.5)' : 'rgba(255,255,255,0.2)', transform: 'translateY(-2px)' },
            transition: 'all 0.25s ease',
          }}>
            <Box sx={{
              position: 'absolute', top: 0, left: 24, right: 24, height: '2px',
              background: stats.recordingNow > 0 ? 'linear-gradient(90deg, transparent, rgba(255,23,68,0.7), transparent)' : 'transparent',
            }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
                Recording Live
              </Typography>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px',
                background: stats.recordingNow > 0 ? 'rgba(255,23,68,0.18)' : 'rgba(255,255,255,0.04)',
                border: stats.recordingNow > 0 ? '1px solid rgba(255,23,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: stats.recordingNow > 0 ? '#ff1744' : 'text.secondary',
                boxShadow: stats.recordingNow > 0 ? '0 0 16px rgba(255,23,68,0.3)' : 'none',
              }}>
                <Radio size={20} />
              </Box>
            </Box>
            <Typography variant="h4" sx={{
              fontWeight: 700,
              color: stats.recordingNow > 0 ? '#ff1744' : '#fff',
              fontFamily: '"JetBrains Mono", monospace',
              lineHeight: 1.1,
            }}>
              {stats.recordingNow}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
              {stats.recordingNow > 0 ? (
                <Chip
                  size="small"
                  label="Surveillance Active"
                  sx={{
                    height: 22, px: 0.5,
                    background: 'rgba(255,23,68,0.15)', border: '1px solid rgba(255,23,68,0.4)',
                    color: '#ff5252', fontWeight: 700,
                  }}
                />
              ) : (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  Standby mode
                </Typography>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Card 3: Total Archive Videos */}
        <Grid size={{ xs: 6, lg: 3 }}>
          <Card sx={{
            p: 2.5, position: 'relative', overflow: 'hidden',
            '&:hover': { borderColor: 'rgba(0,230,118,0.4)', transform: 'translateY(-2px)' },
            transition: 'all 0.25s ease',
          }}>
            <Box sx={{
              position: 'absolute', top: 0, left: 24, right: 24, height: '2px',
              background: 'linear-gradient(90deg, transparent, rgba(0,230,118,0.6), transparent)',
            }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
                Archive Vault
              </Typography>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px',
                background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00e676',
                boxShadow: '0 0 15px rgba(0,230,118,0.2)',
              }}>
                <Video size={20} />
              </Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.1 }}>
              {stats.totalRecordings}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
              <Chip
                size="small"
                label="100% Synced"
                sx={{
                  height: 22, px: 0.5,
                  background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)',
                  color: '#00e676', fontWeight: 700,
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                to Google Drive
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* Card 4: Google Drive Storage */}
        <Grid size={{ xs: 6, lg: 3 }}>
          <Card sx={{
            p: 2.5, position: 'relative', overflow: 'hidden',
            '&:hover': { borderColor: 'rgba(245,158,11,0.4)', transform: 'translateY(-2px)' },
            transition: 'all 0.25s ease',
          }}>
            <Box sx={{
              position: 'absolute', top: 0, left: 24, right: 24, height: '2px',
              background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.6), transparent)',
            }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', textTransform: 'uppercase', fontFamily: '"JetBrains Mono", monospace' }}>
                Drive Quota
              </Typography>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px',
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b',
                boxShadow: '0 0 15px rgba(245,158,11,0.2)',
              }}>
                <HardDrive size={20} />
              </Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.1 }}>
              {stats.storageUsedGB >= 1 ? `${stats.storageUsedGB} GB` : `${stats.storageUsedMB || 0} MB`}
            </Typography>
            <Box sx={{ mt: 1.5 }}>
              <LinearProgress
                variant="determinate"
                value={quotaPercent}
                sx={{
                  height: 6, borderRadius: 3,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#f59e0b',
                    borderRadius: 3,
                  },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.8, fontSize: '0.7rem', color: 'text.secondary', fontFamily: '"JetBrains Mono", monospace' }}>
                <span>{quotaPercent}% of 15GB free</span>
                <span style={{ color: '#00e676', fontWeight: 600 }}>0 MB Server</span>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Surveillance Feed Preview Section */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Video size={20} color="#00e5ff" />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>
                Surveillance Video Vault
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.2 }}>
              Captured stealth recordings automatically uploaded from connected devices
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/recordings"
            variant="outlined"
            size="small"
            endIcon={<ArrowUpRight size={14} />}
            sx={{
              borderColor: 'rgba(255,255,255,0.1)',
              color: '#00e5ff',
              '&:hover': { borderColor: 'rgba(0,229,255,0.4)', background: 'rgba(0,229,255,0.06)' },
            }}
          >
            View All ({recordings.length})
          </Button>
        </Box>

        {recordings.length === 0 ? (
          <Card sx={{ p: 6, textAlign: 'center', background: 'rgba(16,23,38,0.6)' }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: '16px',
              background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00e5ff',
              mx: 'auto', mb: 2,
            }}>
              <Video size={28} />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
              No video recordings captured yet
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 380, mx: 'auto' }}>
              When recordings conclude on client phones, video files will stream directly to this vault.
            </Typography>
          </Card>
        ) : (
          <Grid container spacing={2.5}>
            {recordings.slice(0, 3).map((rec) => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={rec._id}>
                <Card sx={{
                  display: 'flex', flexDirection: 'column', height: '100%',
                  overflow: 'hidden', position: 'relative',
                  '&:hover': { borderColor: 'rgba(0,229,255,0.4)', transform: 'translateY(-2px)' },
                  transition: 'all 0.25s ease',
                }}>
                  {/* CCTV Style Viewport Preview */}
                  <Box
                    onClick={() => setSelectedVideo(rec)}
                    className="cctv-viewport"
                    sx={{
                      aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative', userSelect: 'none',
                    }}
                  >
                    {/* CCTV Corner Brackets */}
                    <div className="cctv-bracket-tl" />
                    <div className="cctv-bracket-tr" />
                    <div className="cctv-bracket-bl" />
                    <div className="cctv-bracket-br" />
                    <div className="cctv-crosshair" />

                    {/* Play Button Icon */}
                    <Box sx={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: '#00e5ff', color: '#000',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 20px rgba(0,229,255,0.5)',
                      zIndex: 4,
                      transition: 'transform 0.2s ease',
                      '&:hover': { transform: 'scale(1.1)' },
                    }}>
                      <Play size={22} fill="#000" style={{ marginLeft: 2 }} />
                    </Box>

                    {/* CCTV Telemetry Badges */}
                    <Box sx={{
                      position: 'absolute', top: 10, left: 10, zIndex: 5,
                      px: 1, py: 0.3, borderRadius: 1,
                      background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: '0.625rem', fontFamily: '"JetBrains Mono", monospace', color: '#cbd5e1',
                      display: 'flex', alignItems: 'center', gap: 0.8,
                    }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#00e5ff' }} />
                      <span>{rec.quality || '720p HD'}</span>
                    </Box>

                    <Box sx={{
                      position: 'absolute', top: 10, right: 10, zIndex: 5,
                      px: 1, py: 0.3, borderRadius: 1,
                      background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: '0.625rem', fontFamily: '"JetBrains Mono", monospace',
                      color: '#00e5ff', fontWeight: 600,
                    }}>
                      {formatSize(rec.fileSizeBytes)}
                    </Box>

                    <Box sx={{
                      position: 'absolute', bottom: 10, left: 10, zIndex: 5,
                      px: 1, py: 0.3, borderRadius: 1,
                      background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: '0.625rem', fontFamily: '"JetBrains Mono", monospace', color: '#94a3b8',
                    }}>
                      {rec.deviceName || 'Client Device'}
                    </Box>
                  </Box>

                  {/* Card Meta Content */}
                  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                        <Typography variant="body2" sx={{
                          fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          '&:hover': { color: '#00e5ff' }, cursor: 'pointer',
                        }} onClick={() => setSelectedVideo(rec)} title={rec.fileName}>
                          {formatVideoTitle(rec)}
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace', color: 'text.secondary', flexShrink: 0 }}>
                          {formatTimeAgo(rec.uploadedAt)}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, fontSize: '0.75rem', color: 'text.secondary' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Smartphone size={14} color="#00e5ff" style={{ flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rec.deviceName || 'Android'} &bull; <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{rec.deviceId}</span>
                          </Typography>
                        </Box>

                        {rec.latitude && rec.longitude && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <a
                              href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#00e5ff', textDecoration: 'none' }}
                            >
                              <MapPin size={13} style={{ flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ color: '#00e5ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {rec.locationName || `${rec.latitude.toFixed(2)}, ${rec.longitude.toFixed(2)}`}
                              </Typography>
                            </a>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {/* Actions Bar */}
                    <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Play size={12} fill="currentColor" />}
                        onClick={() => setSelectedVideo(rec)}
                        sx={{
                          fontSize: '0.75rem', py: 0.4, px: 1.5,
                          borderColor: 'rgba(0,229,255,0.3)', color: '#00e5ff',
                          background: 'rgba(0,229,255,0.08)',
                          '&:hover': { background: 'rgba(0,229,255,0.18)', borderColor: '#00e5ff' },
                        }}
                      >
                        Stream
                      </Button>

                      {rec.driveViewLink ? (
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={rec.driveViewLink}
                          target="_blank"
                          rel="noreferrer"
                          startIcon={<ExternalLink size={12} />}
                          sx={{
                            fontSize: '0.75rem', py: 0.4, px: 1.5,
                            borderColor: 'rgba(0,230,118,0.3)', color: '#00e676',
                            background: 'rgba(0,230,118,0.08)',
                            '&:hover': { background: 'rgba(0,230,118,0.18)', borderColor: '#00e676' },
                          }}
                        >
                          Google Drive
                        </Button>
                      ) : (
                        <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace', color: '#64748b' }}>
                          Local Cache
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Connected Devices Telemetry Table */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Smartphone size={20} color="#00e676" />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>
                Active Telemetry Fleet
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.2 }}>
              Real-time status, battery telemetry, and silent live camera trigger
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/devices"
            variant="outlined"
            size="small"
            endIcon={<ArrowUpRight size={14} />}
            sx={{
              borderColor: 'rgba(255,255,255,0.1)',
              color: '#00e5ff',
              '&:hover': { borderColor: 'rgba(0,229,255,0.4)', background: 'rgba(0,229,255,0.06)' },
            }}
          >
            Manage Fleet ({devices.length})
          </Button>
        </Box>

        {devices.length === 0 ? (
          <Card sx={{ p: 6, textAlign: 'center', background: 'rgba(16,23,38,0.6)' }}>
            <Smartphone size={32} color="#64748b" style={{ margin: '0 auto 12px' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
              No active devices registered
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 380, mx: 'auto' }}>
              Devices will appear here immediately upon launching the Third Eye client.
            </Typography>
          </Card>
        ) : (
          <Card sx={{ overflow: 'hidden' }}>
            <TableContainer>
              <Table sx={{ minWidth: 700 }} size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Device Unit</TableCell>
                    <TableCell>ID / Fingerprint</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Battery</TableCell>
                    <TableCell>Resolution</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Seen</TableCell>
                    <TableCell align="right">Surveillance Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {devices.slice(0, 5).map((d) => {
                    const isOnline =
                      onlineSocketDevices.has(d.deviceId) ||
                      (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60);

                    return (
                      <TableRow key={d.deviceId} hover sx={{ opacity: isOnline ? 1 : 0.75 }}>
                        {/* Device Info */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                              width: 36, height: 36, borderRadius: '10px',
                              background: isOnline ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.05)',
                              border: isOnline ? '1px solid rgba(0,229,255,0.25)' : '1px solid rgba(255,255,255,0.1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: isOnline ? '#00e5ff' : '#64748b',
                              flexShrink: 0,
                            }}>
                              <Smartphone size={17} />
                            </Box>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: isOnline ? '#fff' : '#cbd5e1', '&:hover': { color: '#00e5ff' } }}>
                                {d.deviceName || d.model}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', display: 'block' }}>
                                {d.model || 'Android Device'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* ID with Copy */}
                        <TableCell>
                          <Button
                            size="small"
                            onClick={() => copyToClipboard(d.deviceId)}
                            endIcon={copiedId === d.deviceId ? <Check size={12} color="#00e676" /> : <Copy size={12} />}
                            sx={{
                              fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem',
                              color: '#cbd5e1', background: 'rgba(0,0,0,0.4)',
                              border: '1px solid rgba(255,255,255,0.1)', px: 1, py: 0.2, minWidth: 0,
                              '&:hover': { borderColor: 'rgba(0,229,255,0.4)', color: '#fff' },
                            }}
                          >
                            {d.deviceId.length > 14 ? `${d.deviceId.substring(0, 14)}...` : d.deviceId}
                          </Button>
                        </TableCell>

                        {/* Location */}
                        <TableCell>
                          {d.latitude && d.longitude ? (
                            <Button
                              size="small"
                              component="a"
                              href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              startIcon={<MapPin size={12} />}
                              sx={{
                                fontSize: '0.75rem', py: 0.2, px: 1,
                                background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)',
                                color: '#00e5ff', minWidth: 0,
                                '&:hover': { background: 'rgba(0,229,255,0.18)' },
                              }}
                            >
                              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {d.locationName || `${d.latitude.toFixed(2)}, ${d.longitude.toFixed(2)}`}
                              </span>
                            </Button>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                              {d.ipAddress ? d.ipAddress.split(',')[0] : 'GPS Standby'}
                            </Typography>
                          )}
                        </TableCell>

                        {/* Battery Level */}
                        <TableCell>
                          <Chip
                            size="small"
                            icon={
                              !isOnline ? (
                                <Battery size={13} />
                              ) : d.batteryLevel > 50 ? (
                                <BatteryCharging size={13} />
                              ) : (
                                <BatteryLow size={13} />
                              )
                            }
                            label={!isOnline ? `${d.batteryLevel || 0}% (Last)` : `${d.batteryLevel || 0}%`}
                            title={!isOnline ? `Device is offline. Last reported battery: ${d.batteryLevel || 0}%` : `Live battery: ${d.batteryLevel || 0}%`}
                            sx={{
                              height: 24,
                              background: !isOnline
                                ? 'rgba(255,255,255,0.04)'
                                : d.batteryLevel > 50
                                ? 'rgba(0,230,118,0.12)'
                                : d.batteryLevel > 20
                                ? 'rgba(245,158,11,0.12)'
                                : 'rgba(255,23,68,0.12)',
                              border: !isOnline
                                ? '1px solid rgba(255,255,255,0.1)'
                                : d.batteryLevel > 50
                                ? '1px solid rgba(0,230,118,0.3)'
                                : d.batteryLevel > 20
                                ? '1px solid rgba(245,158,11,0.3)'
                                : '1px solid rgba(255,23,68,0.3)',
                              color: !isOnline
                                ? '#94a3b8'
                                : d.batteryLevel > 50
                                ? '#00e676'
                                : d.batteryLevel > 20
                                ? '#f59e0b'
                                : '#ff1744',
                              fontFamily: '"JetBrains Mono", monospace',
                              fontWeight: isOnline ? 700 : 500,
                              '& .MuiChip-icon': { color: 'inherit' },
                            }}
                          />
                        </TableCell>

                        {/* Resolution */}
                        <TableCell>
                          <Typography variant="caption" sx={{
                            px: 1, py: 0.4, borderRadius: 1,
                            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
                            fontFamily: '"JetBrains Mono", monospace', color: '#cbd5e1',
                          }}>
                            {d.videoQuality || '720p'}
                          </Typography>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Chip
                            size="small"
                            label={d.isRecording ? 'Recording' : isOnline ? 'Online' : 'Offline'}
                            sx={{
                              height: 24,
                              background: d.isRecording ? 'rgba(255,23,68,0.15)' : isOnline ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.04)',
                              border: d.isRecording ? '1px solid rgba(255,23,68,0.4)' : isOnline ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,255,255,0.1)',
                              color: d.isRecording ? '#ff5252' : isOnline ? '#00e676' : '#64748b',
                              fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
                            }}
                          />
                        </TableCell>

                        {/* Last Seen */}
                        <TableCell>
                          <Typography variant="caption" sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            color: isOnline ? '#00e676' : '#64748b',
                            fontWeight: isOnline ? 600 : 400,
                          }}>
                            {isOnline ? 'Active now' : formatTimeAgo(d.lastSeen)}
                          </Typography>
                        </TableCell>

                        {/* Action */}
                        <TableCell align="right">
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={!isOnline}
                              onClick={() => handleStartLiveStream(d)}
                              startIcon={<Radio size={13} />}
                              sx={{
                                fontSize: '0.75rem', py: 0.5, px: 1.5,
                                background: isOnline
                                  ? 'linear-gradient(135deg, rgba(255,23,68,0.3) 0%, rgba(255,23,68,0.15) 100%)'
                                  : 'rgba(255,255,255,0.04)',
                                border: isOnline
                                  ? '1px solid rgba(255,23,68,0.4)'
                                  : '1px solid rgba(255,255,255,0.08)',
                                color: isOnline ? '#ff5252' : '#64748b',
                                boxShadow: isOnline ? '0 0 10px rgba(255,23,68,0.2)' : 'none',
                                '&:hover': isOnline ? {
                                  background: 'linear-gradient(135deg, #ff1744 0%, #c4001d 100%)',
                                  color: '#fff',
                                  boxShadow: '0 0 16px rgba(255,23,68,0.4)',
                                } : {},
                                '&.Mui-disabled': {
                                  color: '#64748b',
                                  borderColor: 'rgba(255,255,255,0.06)',
                                },
                              }}
                            >
                              {isOnline ? 'Watch Live' : 'Offline'}
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteDevice(d.deviceId)}
                              title="Delete / Remove device from dashboard"
                              sx={{
                                color: '#64748b',
                                border: '1px solid rgba(255,255,255,0.08)',
                                '&:hover': { color: '#ff1744', background: 'rgba(255,23,68,0.1)', borderColor: 'rgba(255,23,68,0.3)' },
                              }}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )}
      </Box>
    </Box>
  );
}
