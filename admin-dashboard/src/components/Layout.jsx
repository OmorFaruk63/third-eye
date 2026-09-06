import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Eye, Smartphone, Video, Settings, LayoutDashboard,
  RefreshCw, Download, Volume2, VolumeX, Info,
  ExternalLink, Clock, Radio, Shield, HardDrive,
  Activity, Wifi,
} from 'lucide-react';
import { useDashboard, API_BASE_URL } from '../context/DashboardContext';

import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';

const DRAWER_WIDTH = 260;

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const location = useLocation();

  const {
    stats, devices, recordings, loading, serverOnline,
    autoRefresh, setAutoRefresh, selectedVideo, setSelectedVideo,
    liveDevice, liveFrame, liveLens, liveFps,
    isAudioMuted, liveOnlineCount,
    fetchData, handleStopLiveStream, handleSwitchCamera,
    handleTakeSnapshot, toggleAudioMute, formatSize,
  } = useDashboard();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (liveDevice) handleStopLiveStream();
        if (selectedVideo) setSelectedVideo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [liveDevice, selectedVideo, handleStopLiveStream, setSelectedVideo]);

  const getPageMeta = () => {
    switch (location.pathname) {
      case '/devices':
        return {
          title: 'Connected Devices',
          desc: 'Real-time telemetry, battery, and recording status.',
          badge: liveOnlineCount > 0 ? `${liveOnlineCount} Online` : `${devices.length} Registered`,
        };
      case '/recordings':
        return { title: 'Surveillance Gallery', desc: 'Browse and stream 720p recordings stored in Drive.', badge: `${recordings.length} Videos` };
      case '/settings':
        return { title: 'System Configuration', desc: 'Drive Service Account setup and API preferences.', badge: 'Security & APIs' };
      default:
        return { title: 'System Overview', desc: 'Live status of all distributed devices and uploads.', badge: 'Live Operations' };
    }
  };

  const pageMeta = getPageMeta();

  const navItems = [
    { to: '/', end: true, icon: <LayoutDashboard size={18} />, label: 'Overview', badge: null },
    { to: '/devices', end: false, icon: <Smartphone size={18} />, label: 'Devices', badge: devices.length, liveBadge: liveOnlineCount },
    { to: '/recordings', end: false, icon: <Video size={18} />, label: 'Recordings', badge: recordings.length, recBadge: stats.recordingNow > 0 },
    { to: '/settings', end: false, icon: <Settings size={18} />, label: 'Settings & Drive', badge: null, subtleBadge: '15GB' },
  ];

  const renderSidebarContent = (onClose) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', py: 2, px: 1 }}>
      {/* Brand Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(0,229,255,0.15) 0%, rgba(0,229,255,0.05) 100%)',
            border: '1px solid rgba(0,229,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,229,255,0.15)',
          }}>
            <Eye size={20} color="#00e5ff" />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.12em' }}>
                THIRD EYE
              </Typography>
              <Chip label="v2.4" size="small" sx={{
                height: 16, fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                bgcolor: 'rgba(0,229,255,0.12)', color: '#00e5ff',
                border: '1px solid rgba(0,229,255,0.25)', borderRadius: 1,
              }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
              <Box sx={{
                width: 5, height: 5, borderRadius: '50%',
                bgcolor: serverOnline ? '#00e676' : '#ff1744',
                boxShadow: `0 0 5px ${serverOnline ? '#00e676' : '#ff1744'}`,
                animation: 'pulse-glow 2s ease-in-out infinite',
              }} />
              <Typography sx={{ fontSize: 8.5, fontFamily: 'monospace', color: '#64748b', letterSpacing: '0.1em' }}>
                COMMAND CENTER
              </Typography>
            </Box>
          </Box>
        </Box>
        {onClose && (
          <IconButton size="small" onClick={onClose} sx={{ color: '#64748b', display: { md: 'none' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Typography sx={{ fontSize: 9, fontWeight: 700, color: '#475569', letterSpacing: '0.12em', px: 2.5, mb: 1 }}>
        OPERATIONS
      </Typography>

      <List dense disablePadding sx={{ flex: '0 0 auto' }}>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <ListItemButton
                onClick={onClose}
                selected={isActive}
                sx={{ mb: 0.3 }}
              >
                <ListItemIcon sx={{ minWidth: 34, color: isActive ? '#00e5ff' : '#64748b' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? '#e2e8f0' : '#94a3b8' }}
                />
                {item.liveBadge > 0 && (
                  <Chip label={item.liveBadge} size="small" sx={{
                    height: 17, fontSize: 9, mr: 0.5, fontFamily: 'monospace', fontWeight: 700,
                    bgcolor: 'rgba(0,230,118,0.12)', color: '#00e676',
                    border: '1px solid rgba(0,230,118,0.3)', borderRadius: 1,
                    '& .MuiChip-label': { px: 0.8 },
                  }} />
                )}
                {item.recBadge && (
                  <Chip label="REC" size="small" sx={{
                    height: 17, fontSize: 9, mr: 0.5, fontFamily: 'monospace', fontWeight: 700,
                    bgcolor: 'rgba(255,23,68,0.15)', color: '#ff616f',
                    border: '1px solid rgba(255,23,68,0.3)', borderRadius: 1,
                    '& .MuiChip-label': { px: 0.8 },
                  }} />
                )}
                {item.badge !== null && item.badge !== undefined && (
                  <Chip label={item.badge} size="small" sx={{
                    height: 17, fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                    bgcolor: 'rgba(255,255,255,0.05)', color: '#64748b',
                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1,
                    '& .MuiChip-label': { px: 0.8 },
                  }} />
                )}
                {item.subtleBadge && (
                  <Typography sx={{ fontSize: 9, fontFamily: 'monospace', color: '#475569', ml: 0.5 }}>
                    {item.subtleBadge}
                  </Typography>
                )}
              </ListItemButton>
            )}
          </NavLink>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      {/* Fleet Telemetry HUD */}
      <Box sx={{
        mx: 1, p: 1.5, borderRadius: 2,
        background: 'linear-gradient(180deg, rgba(13,22,38,0.7) 0%, rgba(8,14,25,0.85) 100%)',
        border: '1px solid rgba(0,229,255,0.15)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: '#67e8f9' }}>
            <Radio size={11} style={{ animation: 'pulse-glow 2s ease-in-out infinite' }} />
            <Typography sx={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', color: '#67e8f9' }}>
              FLEET TELEMETRY
            </Typography>
          </Box>
          <Chip label="LIVE" size="small" sx={{
            height: 15, fontSize: 8.5, fontFamily: 'monospace', fontWeight: 700,
            bgcolor: 'rgba(0,229,255,0.1)', color: '#00e5ff',
            border: '1px solid rgba(0,229,255,0.2)', borderRadius: 0.8,
            '& .MuiChip-label': { px: 0.7 },
          }} />
        </Box>

        {[
          { icon: <Wifi size={11} />, label: 'Active Nodes', value: `${liveOnlineCount} / ${devices.length}` },
          { icon: <Activity size={11} />, label: 'Surveillance', value: stats.recordingNow > 0 ? `${stats.recordingNow} STREAMING` : 'STANDBY READY', color: stats.recordingNow > 0 ? '#ff616f' : '#00e676' },
          { icon: <HardDrive size={11} />, label: 'Drive Vault', value: `${stats.storageUsedMB || 0} MB`, color: '#67e8f9' },
        ].map((row) => (
          <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: '#64748b' }}>
              {row.icon}
              <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>{row.label}</Typography>
            </Box>
            <Typography sx={{ fontSize: 10.5, fontFamily: 'monospace', fontWeight: 600, color: row.color || '#fff' }}>
              {row.value}
            </Typography>
          </Box>
        ))}

        <LinearProgress
          variant="determinate"
          value={devices.length > 0 ? Math.max(12, Math.round((liveOnlineCount / devices.length) * 100)) : 0}
          sx={{
            mt: 1, height: 3, borderRadius: 9999,
            bgcolor: 'rgba(255,255,255,0.06)',
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(90deg, #00e5ff 0%, #00e676 100%)',
              boxShadow: '0 0 8px rgba(0,229,255,0.5)',
            },
          }}
        />
      </Box>

      {/* Sidebar Footer */}
      <Box sx={{ mt: 'auto', pt: 2, mx: 1 }}>
        <Divider sx={{ mb: 1.5 }} />
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2, p: 1.2, borderRadius: 1.5,
          bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', mb: 1.2,
        }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: '8px',
            bgcolor: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={13} color="#00e5ff" />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>ROOT OPERATOR</Typography>
            <Typography sx={{ fontSize: 8.5, fontFamily: 'monospace', color: '#00e5ff', letterSpacing: '0.08em' }}>ENCRYPTED SESSION</Typography>
          </Box>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00e676', boxShadow: '0 0 6px #00e676', flexShrink: 0 }} />
        </Box>

        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2, p: 1.2, borderRadius: 1.5,
          bgcolor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            bgcolor: serverOnline ? '#00e676' : '#ff1744',
            boxShadow: `0 0 8px ${serverOnline ? '#00e676' : '#ff1744'}`,
          }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>
              {serverOnline ? 'Relay Server Online' : 'Relay Disconnected'}
            </Typography>
            <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {API_BASE_URL.replace(/^https?:\/\//, '')}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
      {/* Desktop Persistent Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH, flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        {renderSidebarContent(null)}
      </Drawer>

      {/* Mobile Temporary Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {renderSidebarContent(() => setMobileOpen(false))}
      </Drawer>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* Top AppBar */}
        <AppBar position="sticky" elevation={0} sx={{ zIndex: (theme) => theme.zIndex.drawer - 1 }}>
          <Toolbar sx={{ minHeight: { xs: 58, sm: 64 }, px: { xs: 1.5, sm: 3 }, gap: 1.5 }}>
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: 'none' }, color: '#94a3b8', mr: 0.5 }}
            >
              <MenuIcon />
            </IconButton>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ fontSize: { xs: 15, sm: 18 }, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                  {pageMeta.title}
                </Typography>
                <Chip
                  label={pageMeta.badge}
                  size="small"
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    height: 18, fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                    bgcolor: 'rgba(0,229,255,0.1)', color: '#00e5ff',
                    border: '1px solid rgba(0,229,255,0.25)', borderRadius: 1,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              </Box>
              <Typography sx={{ fontSize: { xs: 11, sm: 12 }, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {pageMeta.desc}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
              {/* Clock */}
              <Box sx={{
                display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.8,
                px: 1.5, py: 0.8, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <Clock size={13} color="#00e5ff" />
                <Typography sx={{ fontSize: 11.5, fontFamily: 'monospace', color: '#94a3b8' }}>{currentTime}</Typography>
              </Box>

              {/* Server Status */}
              <Box sx={{
                display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 1,
                px: 1.5, py: 0.8, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <Box sx={{
                  width: 7, height: 7, borderRadius: '50%',
                  bgcolor: serverOnline ? '#00e676' : '#ff1744',
                  boxShadow: `0 0 6px ${serverOnline ? '#00e676' : '#ff1744'}`,
                }} />
                <Typography sx={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>
                  {serverOnline ? 'Relay Active' : 'Offline'}
                </Typography>
              </Box>

              {/* Live Polling Toggle */}
              <Box
                component="label"
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.8, cursor: 'pointer',
                  px: { xs: 1, sm: 1.5 }, py: 0.8, borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: 'rgba(0,229,255,0.3)' },
                }}
              >
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  style={{ width: 13, height: 13, accentColor: '#00e5ff', cursor: 'pointer' }}
                />
                <Typography sx={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500, display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}>
                  Live Polling
                </Typography>
                <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: '#475569', whiteSpace: 'nowrap' }}>(30s)</Typography>
              </Box>

              {/* Sync Button */}
              <Button
                variant="outlined"
                size="small"
                onClick={fetchData}
                disabled={loading}
                startIcon={<RefreshCw size={13} className={loading ? 'spinning' : ''} />}
                sx={{
                  px: { xs: 1, sm: 1.5 }, py: 0.8, fontSize: 12, minWidth: { xs: 36, sm: 'auto' },
                  borderColor: 'rgba(255,255,255,0.12)',
                  color: '#94a3b8',
                  '&:hover': { borderColor: 'rgba(0,229,255,0.4)', color: '#00e5ff', bgcolor: 'rgba(0,229,255,0.05)' },
                  '& .MuiButton-startIcon': { display: { xs: 'block', sm: 'block' }, margin: { xs: 0, sm: undefined } },
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Sync</Box>
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box component="main" sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, sm: 2.5, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>

      {/* Video Player Modal */}
      {selectedVideo && (
        <Dialog
          open={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { maxHeight: '90vh', bgcolor: '#0d1422', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Video size={16} color="#00e5ff" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{selectedVideo.fileName}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                  <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: '#00e5ff' }}>{selectedVideo.deviceName}</Typography>
                  <Typography sx={{ fontSize: 11, color: '#475569' }}>•</Typography>
                  <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>{formatSize(selectedVideo.fileSizeBytes)}</Typography>
                </Box>
              </Box>
            </Box>
            <IconButton onClick={() => setSelectedVideo(null)} sx={{ color: '#64748b', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box
              component="video"
              controls
              autoPlay
              src={`${API_BASE_URL}/api/videos/stream/${selectedVideo._id}`}
              sx={{ width: '100%', maxHeight: '60vh', outline: 'none' }}
            />
          </Box>

          <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>Direct Stream from Cloud Storage</Typography>
            <Stack direction="row" spacing={1}>
              {selectedVideo.driveViewLink && (
                <Button
                  component="a" href={selectedVideo.driveViewLink} target="_blank" rel="noreferrer"
                  size="small" startIcon={<ExternalLink size={13} />}
                  sx={{ fontSize: 11.5, color: '#00e676', borderColor: 'rgba(0,230,118,0.3)', '&:hover': { bgcolor: 'rgba(0,230,118,0.08)' } }}
                  variant="outlined"
                >
                  Google Drive
                </Button>
              )}
              <Button
                component="a" href={`${API_BASE_URL}/api/videos/download/${selectedVideo._id}`} download
                size="small" startIcon={<Download size={13} />}
                variant="outlined"
                sx={{ fontSize: 11.5, color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}
              >
                Download
              </Button>
            </Stack>
          </Box>
        </Dialog>
      )}

      {/* Live Surveillance Modal */}
      {liveDevice && (
        <Dialog
          open={!!liveDevice}
          onClose={handleStopLiveStream}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { maxHeight: '95vh', bgcolor: '#060a11', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 3 } }}
        >
          {/* Live Modal Header */}
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', gap: 1.5,
          }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.3, borderRadius: 1, bgcolor: 'rgba(255,23,68,0.15)', border: '1px solid rgba(255,23,68,0.3)' }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#ff1744', animation: 'pulse-glow 1s ease-in-out infinite' }} />
                  <Typography sx={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#ff616f', letterSpacing: '0.1em' }}>LIVE SURVEILLANCE FEED</Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{liveDevice.deviceName || liveDevice.model}</Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.3 }}>
                <Typography sx={{ fontSize: 10.5, fontFamily: 'monospace', color: '#64748b' }}>ID: {liveDevice.deviceId}</Typography>
                <Typography sx={{ fontSize: 10.5, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 600 }}>LENS: {liveLens}</Typography>
                <Typography sx={{ fontSize: 10.5, fontFamily: 'monospace', color: liveFps > 0 ? '#00e676' : '#f59e0b', fontWeight: 600 }}>
                  {liveFps > 0 ? `${liveFps} FPS` : 'Buffering...'}
                </Typography>
              </Stack>
            </Box>

            <Stack direction="row" spacing={0.8} flexWrap="wrap">
              <Button size="small" onClick={toggleAudioMute} startIcon={isAudioMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                variant="outlined" sx={{ fontSize: 11, color: isAudioMuted ? '#94a3b8' : '#00e676', borderColor: isAudioMuted ? 'rgba(255,255,255,0.1)' : 'rgba(0,230,118,0.35)', '&:hover': { bgcolor: 'rgba(0,230,118,0.06)' } }}>
                {isAudioMuted ? 'Unmute' : 'Audio Live'}
              </Button>
              <Button size="small" onClick={handleSwitchCamera} startIcon={<RefreshCw size={13} />}
                variant="outlined" sx={{ fontSize: 11, color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', '&:hover': { color: '#00e5ff', borderColor: 'rgba(0,229,255,0.3)' } }}>
                Switch Lens
              </Button>
              <Button size="small" onClick={handleTakeSnapshot} disabled={!liveFrame} startIcon={<Download size={13} />}
                variant="outlined" sx={{ fontSize: 11, color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }}>
                Snapshot
              </Button>
              <IconButton onClick={handleStopLiveStream} size="small" sx={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1.5, '&:hover': { color: '#ff616f', borderColor: 'rgba(255,23,68,0.3)' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          {/* Live Feed Viewport */}
          <Box className="cctv-viewport" sx={{ position: 'relative', aspectRatio: '16/9', bgcolor: '#000', flex: 1 }}>
            <div className="cctv-bracket-tl" />
            <div className="cctv-bracket-tr" />
            <div className="cctv-bracket-bl" />
            <div className="cctv-bracket-br" />

            {liveFrame ? (
              <>
                <Box component="img" src={liveFrame} alt="Live Camera Feed"
                  sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', position: 'relative', zIndex: 2 }} />
                {/* HUD Overlay */}
                <Box sx={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', fontFamily: 'monospace' }}>
                  <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 0.7 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#ff1744', animation: 'pulse-glow 1s ease-in-out infinite' }} />
                    <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: '#ff616f', fontWeight: 700 }}>REC • {liveLens} CAM</Typography>
                  </Box>
                  <Box sx={{ position: 'absolute', bottom: 12, right: 12 }}>
                    <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: '#00e5ff' }}>{currentTime}</Typography>
                  </Box>
                </Box>
              </>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1 }}>
                <div className="live-radar-spinner" />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                  Connecting to {liveDevice.deviceName}&apos;s camera...
                </Typography>
                <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>
                  Silently streaming via WebSocket relay
                </Typography>
              </Box>
            )}
          </Box>

          {/* Live Modal Footer */}
          <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Info size={14} color="#00e5ff" />
              <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>Live via WebSocket. Zero cloud bandwidth stored on server.</Typography>
            </Box>
            <Button onClick={handleStopLiveStream} variant="outlined" size="small"
              sx={{ fontSize: 12, color: '#ff616f', borderColor: 'rgba(255,23,68,0.3)', '&:hover': { bgcolor: 'rgba(255,23,68,0.08)' } }}>
              End Live View
            </Button>
          </Box>
        </Dialog>
      )}
    </Box>
  );
}
