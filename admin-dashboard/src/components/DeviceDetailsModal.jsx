import React, { useState } from 'react';
import {
  Smartphone,
  MapPin,
  RefreshCw,
  ExternalLink,
  Clock,
  BatteryCharging,
  BatteryLow,
  Battery,
  Radio,
  Video,
  Copy,
  Check,
  Navigation,
  Globe,
  HardDrive,
  Cpu,
  Wifi,
  AlertCircle,
  ShieldCheck,
  Crosshair,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import {
  getVillageOrPara,
  isLocationLive,
  formatLocationAge,
  getLocationSecondary,
} from '../utils/locationHelper';

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import CloseIcon from '@mui/icons-material/Close';

export default function DeviceDetailsModal() {
  const {
    selectedDeviceDetails,
    isDeviceDetailsOpen,
    isRefreshingLocation,
    locationRefreshStatus,
    handleCloseDeviceDetails,
    handleRequestDeviceLocation,
    onlineSocketDevices,
    openCameraModal,
    handleStopRemoteRecording,
    updateDeviceLocation,
    formatTimeAgo,
  } = useDashboard();

  const [copiedText, setCopiedText] = useState(null);

  if (!selectedDeviceDetails) return null;

  const d = selectedDeviceDetails;
  const isOnline =
    onlineSocketDevices.has(d.deviceId) ||
    (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const isLive = isLocationLive(d, isOnline);
  const villageName = getVillageOrPara(d, updateDeviceLocation);
  const secondaryAddress = getLocationSecondary(d);
  const locationAge = formatLocationAge(d.locationUpdatedAt, d.lastSeen);

  const locationHistory = Array.isArray(d.locationHistory) ? d.locationHistory : [];

  const formatHistoryTime = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Dialog
      open={isDeviceDetailsOpen}
      onClose={handleCloseDeviceDetails}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#080d16',
          backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 229, 255, 0.12), transparent)',
          border: '1px solid rgba(0, 229, 255, 0.25)',
          boxShadow: '0 0 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 229, 255, 0.15)',
          borderRadius: 3,
          color: '#fff',
          overflow: 'hidden',
          maxHeight: '92vh',
        },
      }}
    >
      {/* Modal Header */}
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(13, 22, 38, 0.6)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: '12px',
              background: isOnline ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              border: isOnline ? '1px solid rgba(0, 229, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isOnline ? '#00e5ff' : '#64748b',
              boxShadow: isOnline ? '0 0 16px rgba(0, 229, 255, 0.2)' : 'none',
              flexShrink: 0,
            }}
          >
            <Smartphone size={22} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: { xs: 16, sm: 18 } }}>
                {d.deviceName || d.model}
              </Typography>
              <Chip
                size="small"
                label={d.isRecording ? 'RECORDING' : isOnline ? 'ONLINE' : 'OFFLINE'}
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontWeight: 700,
                  bgcolor: d.isRecording ? 'rgba(255, 23, 68, 0.18)' : isOnline ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: d.isRecording ? '1px solid rgba(255, 23, 68, 0.4)' : isOnline ? '1px solid rgba(0, 230, 118, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: d.isRecording ? '#ff5252' : isOnline ? '#00e676' : '#64748b',
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontFamily: '"JetBrains Mono", monospace', display: 'block', mt: 0.2 }}>
              ID: {d.deviceId}
            </Typography>
          </Box>
        </Box>

        <IconButton
          onClick={handleCloseDeviceDetails}
          size="small"
          sx={{
            color: '#64748b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 1.5,
            '&:hover': { color: '#fff', bgcolor: 'rgba(255, 255, 255, 0.08)' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Modal Body */}
      <DialogContent sx={{ p: { xs: 2, sm: 3 }, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        
        {/* Quick Surveillance Action Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            background: 'rgba(16, 23, 38, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip
              size="small"
              icon={
                !isOnline ? <Battery size={13} /> : d.batteryLevel > 50 ? <BatteryCharging size={13} /> : <BatteryLow size={13} />
              }
              label={`Battery ${d.batteryLevel || 0}%${!isOnline ? ' (Last)' : ''}`}
              sx={{
                bgcolor: !isOnline ? 'rgba(255,255,255,0.04)' : d.batteryLevel > 50 ? 'rgba(0,230,118,0.12)' : 'rgba(245,158,11,0.12)',
                border: !isOnline ? '1px solid rgba(255,255,255,0.1)' : d.batteryLevel > 50 ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(245,158,11,0.3)',
                color: !isOnline ? '#94a3b8' : d.batteryLevel > 50 ? '#00e676' : '#f59e0b',
                fontWeight: 600,
                fontFamily: 'monospace',
              }}
            />
            <Chip
              size="small"
              label={`Quality: ${d.videoQuality || '720p'}`}
              sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#cbd5e1',
                fontFamily: 'monospace',
              }}
            />
            <Chip
              size="small"
              label={`Seen: ${isOnline ? 'Active Now' : formatTimeAgo(d.lastSeen)}`}
              sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: isOnline ? '#00e676' : '#94a3b8',
                fontFamily: 'monospace',
              }}
            />
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              disabled={!isOnline}
              onClick={() => openCameraModal(d, 'live')}
              startIcon={<Radio size={13} />}
              sx={{
                fontSize: '0.75rem',
                background: isOnline ? 'linear-gradient(135deg, rgba(255,23,68,0.35) 0%, rgba(255,23,68,0.15) 100%)' : 'rgba(255,255,255,0.04)',
                border: isOnline ? '1px solid rgba(255,23,68,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: isOnline ? '#ff5252' : '#64748b',
                '&:hover': isOnline ? { background: 'linear-gradient(135deg, #ff1744 0%, #c4001d 100%)', color: '#fff' } : {},
              }}
            >
              Watch Live
            </Button>
            <Button
              size="small"
              variant={d.isRecording ? 'contained' : 'outlined'}
              disabled={!isOnline}
              onClick={() => d.isRecording ? handleStopRemoteRecording(d.deviceId) : openCameraModal(d, 'record')}
              startIcon={<Video size={13} />}
              sx={{
                fontSize: '0.75rem',
                borderColor: d.isRecording ? 'rgba(255,23,68,0.5)' : isOnline ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.1)',
                color: d.isRecording ? '#fff' : isOnline ? '#00e5ff' : '#64748b',
                background: d.isRecording ? 'linear-gradient(135deg, #ff1744 0%, #c4001d 100%)' : 'rgba(0,229,255,0.06)',
              }}
            >
              {d.isRecording ? 'Stop Rec' : 'Remote Rec'}
            </Button>
          </Stack>
        </Box>

        {/* 🛰️ REAL-TIME SATELLITE GPS LOCATION CARD */}
        <Box
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2.5,
            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(13, 22, 38, 0.7) 100%)',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top Label & Refresh Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: 'rgba(0, 229, 255, 0.15)',
                  border: '1px solid rgba(0, 229, 255, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#00e5ff',
                }}
              >
                <Crosshair size={18} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
                  REAL-TIME SATELLITE TELEMETRY
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                  Live GPS coordinate tracking & Geo-reverse resolution
                </Typography>
              </Box>
            </Box>

            {/* 📍 REFRESH LIVE GPS BUTTON */}
            <Button
              size="small"
              variant="contained"
              disabled={!isOnline || isRefreshingLocation}
              onClick={() => handleRequestDeviceLocation(d.deviceId)}
              startIcon={<RefreshCw size={13} className={isRefreshingLocation ? 'spinning' : ''} />}
              sx={{
                fontSize: '0.78rem',
                fontWeight: 700,
                background: isOnline ? 'linear-gradient(135deg, #00e5ff 0%, #0099b8 100%)' : 'rgba(255,255,255,0.05)',
                color: isOnline ? '#000' : '#64748b',
                boxShadow: isOnline ? '0 0 16px rgba(0, 229, 255, 0.3)' : 'none',
                '&:hover': isOnline ? { background: '#33ebff', boxShadow: '0 0 22px rgba(0, 229, 255, 0.5)' } : {},
              }}
            >
              {isRefreshingLocation ? 'Pinging Phone GPS...' : 'Refresh Live GPS'}
            </Button>
          </Box>

          {/* Refresh feedback toast/status */}
          {locationRefreshStatus === 'requesting' && (
            <Box sx={{ mb: 1.5, p: 1, borderRadius: 1.5, bgcolor: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <RefreshCw size={14} color="#00e5ff" className="spinning" />
              <Typography sx={{ fontSize: 11.5, color: '#00e5ff', fontFamily: 'monospace' }}>
                Command sent to phone over socket. Locking satellite GPS coordinates...
              </Typography>
            </Box>
          )}
          {locationRefreshStatus === 'success' && (
            <Box sx={{ mb: 1.5, p: 1, borderRadius: 1.5, bgcolor: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.3)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Check size={14} color="#00e676" />
              <Typography sx={{ fontSize: 11.5, color: '#00e676', fontFamily: 'monospace' }}>
                ✅ Satellite GPS updated successfully in real-time!
              </Typography>
            </Box>
          )}

          {d.latitude && d.longitude ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Village / Para Name & Live Badge */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                    <Typography sx={{ fontSize: { xs: 16, sm: 19 }, fontWeight: 800, color: isLive ? '#00e676' : '#00e5ff' }}>
                      {villageName}
                    </Typography>
                    {isLive ? (
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 0.8,
                          py: 0.2,
                          borderRadius: '4px',
                          background: 'rgba(0, 230, 118, 0.18)',
                          border: '1px solid rgba(0, 230, 118, 0.4)',
                        }}
                      >
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00e676', boxShadow: '0 0 6px #00e676', animation: 'radar-dot-pulse 1.5s infinite' }} />
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#00e676', fontFamily: 'monospace' }}>
                          LIVE
                        </Typography>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 0.8,
                          py: 0.2,
                          borderRadius: '4px',
                          background: 'rgba(245, 158, 11, 0.14)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        <Clock size={10} color="#f59e0b" />
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>
                          {locationAge}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  {secondaryAddress && (
                    <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>
                      {secondaryAddress}
                    </Typography>
                  )}
                </Box>

                {/* Open in Google Maps Button */}
                <Button
                  component="a"
                  href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  variant="outlined"
                  size="small"
                  startIcon={<ExternalLink size={13} />}
                  sx={{
                    fontSize: '0.78rem',
                    color: '#00e5ff',
                    borderColor: 'rgba(0, 229, 255, 0.4)',
                    background: 'rgba(0, 229, 255, 0.06)',
                    '&:hover': {
                      background: 'rgba(0, 229, 255, 0.18)',
                      borderColor: '#00e5ff',
                    },
                  }}
                >
                  Open in Google Maps
                </Button>
              </Box>

              {/* Coordinates Grid */}
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography sx={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                      Coordinates
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.3 }}>
                      <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: '#fff', fontWeight: 600 }}>
                        {d.latitude.toFixed(6)}, {d.longitude.toFixed(6)}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => copyToClipboard(`${d.latitude}, ${d.longitude}`, 'coords')}
                        sx={{ color: '#64748b', p: 0.3 }}
                      >
                        {copiedText === 'coords' ? <Check size={12} color="#00e676" /> : <Copy size={12} />}
                      </IconButton>
                    </Box>
                  </Box>
                </Grid>

                <Grid size={{ xs: 6, sm: 4 }}>
                  <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography sx={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                      Signal Source
                    </Typography>
                    <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 600, mt: 0.3 }}>
                      {d.locationSource || 'GPS (Satellite)'}
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography sx={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                      Last Updated
                    </Typography>
                    <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: isLive ? '#00e676' : '#fbbf24', fontWeight: 600, mt: 0.3 }}>
                      {d.locationUpdatedAt ? formatHistoryTime(d.locationUpdatedAt) : 'Just now'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <AlertCircle size={28} color="#64748b" style={{ margin: '0 auto 8px' }} />
              <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>
                GPS coordinates not yet reported by this device.
              </Typography>
              <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.3 }}>
                Click &quot;Refresh Live GPS&quot; to ping the phone for instant coordinates.
              </Typography>
            </Box>
          )}
        </Box>

        {/* 🗺️ LOCATION MOVEMENT HISTORY (BREADCRUMB TRAIL) */}
        <Box
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2.5,
            background: 'rgba(10, 16, 28, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Navigation size={18} color="#00e5ff" />
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                Location Movement History
              </Typography>
              <Chip
                size="small"
                label={`${locationHistory.length} Visited Points`}
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  bgcolor: 'rgba(0, 229, 255, 0.12)',
                  color: '#00e5ff',
                  border: '1px solid rgba(0, 229, 255, 0.25)',
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
              Chronological Timeline
            </Typography>
          </Box>

          {locationHistory.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px dashed rgba(255,255,255,0.08)' }}>
              <MapPin size={28} color="#475569" style={{ margin: '0 auto 8px' }} />
              <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>
                No movement history recorded yet
              </Typography>
              <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.3 }}>
                As the device moves between areas, every GPS location point will be saved here automatically.
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                maxHeight: 280,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.2,
                pr: 0.5,
              }}
            >
              {locationHistory.map((item, idx) => {
                const itemVillage = item.villageOrPara || (item.locationName ? item.locationName.split(',')[0] : 'Unknown Location');
                const itemSecondary = item.districtAndCountry || (item.locationName ? item.locationName.split(',').slice(1).join(', ') : '');

                return (
                  <Box
                    key={idx}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: idx === 0 ? 'rgba(0, 229, 255, 0.07)' : 'rgba(255, 255, 255, 0.03)',
                      border: idx === 0 ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      transition: 'all 0.2s',
                      '&:hover': {
                        background: 'rgba(0, 229, 255, 0.12)',
                        borderColor: 'rgba(0, 229, 255, 0.4)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '8px',
                          bgcolor: idx === 0 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: idx === 0 ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: idx === 0 ? '#00e676' : '#94a3b8',
                          flexShrink: 0,
                        }}
                      >
                        <MapPin size={14} />
                      </Box>

                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: idx === 0 ? '#00e676' : '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {itemVillage}
                          </Typography>
                          {idx === 0 && (
                            <Chip
                              size="small"
                              label="LATEST"
                              sx={{
                                height: 16,
                                fontSize: 8.5,
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                bgcolor: 'rgba(0, 230, 118, 0.2)',
                                color: '#00e676',
                                border: '1px solid rgba(0, 230, 118, 0.4)',
                              }}
                            />
                          )}
                        </Box>
                        {itemSecondary && (
                          <Typography sx={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {itemSecondary}
                          </Typography>
                        )}
                        <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', mt: 0.2 }}>
                          {item.latitude && item.longitude ? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}` : ''} • {formatHistoryTime(item.timestamp)}
                        </Typography>
                      </Box>
                    </Box>

                    {item.latitude && item.longitude && (
                      <Button
                        component="a"
                        href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        size="small"
                        variant="outlined"
                        endIcon={<ExternalLink size={11} />}
                        sx={{
                          fontSize: '0.72rem',
                          color: '#00e5ff',
                          borderColor: 'rgba(0, 229, 255, 0.3)',
                          px: 1,
                          py: 0.3,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          '&:hover': { bgcolor: 'rgba(0, 229, 255, 0.1)' },
                        }}
                      >
                        View Pin
                      </Button>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* 📱 HARDWARE & SYSTEM TELEMETRY */}
        <Box
          sx={{
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2.5,
            background: 'rgba(10, 16, 28, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Cpu size={16} color="#00e5ff" />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              Device Hardware & Fleet Specs
            </Typography>
          </Box>

          <Grid container spacing={1.5}>
            {[
              { label: 'Device Model', value: d.model || 'Unknown Android' },
              { label: 'Android OS', value: d.androidVersion ? `Android ${d.androidVersion}` : 'N/A' },
              { label: 'Client App Version', value: `v${d.appVersion || '1.0'}` },
              { label: 'Total Recorded Videos', value: `${d.totalRecordings || 0} files` },
              { label: 'IP Address', value: d.ipAddress ? d.ipAddress.split(',')[0] : 'Relay Local' },
              { label: 'Registered Since', value: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Active' },
            ].map((item) => (
              <Grid size={{ xs: 6, sm: 4 }} key={item.label}>
                <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography sx={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', mt: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.value}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

      </DialogContent>
    </Dialog>
  );
}
