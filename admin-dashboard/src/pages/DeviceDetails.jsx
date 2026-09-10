import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
  Crosshair,
  Cpu,
  Search,
  X,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Layers,
} from 'lucide-react';
import { useDashboard, API_BASE_URL } from '../context/DashboardContext';
import {
  getVillageOrPara,
  isLocationLive,
  formatLocationAge,
  getLocationSecondary,
  formatLocationTimeRange,
} from '../utils/locationHelper';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Pagination from '@mui/material/Pagination';
import Divider from '@mui/material/Divider';

export default function DeviceDetails() {
  const { deviceId } = useParams();
  const navigate = useNavigate();

  const {
    devices,
    onlineSocketDevices,
    openCameraModal,
    handleStopRemoteRecording,
    updateDeviceLocation,
    formatTimeAgo,
    handleRequestDeviceLocation,
    isRefreshingLocation,
    locationRefreshStatus,
  } = useDashboard();

  const [deviceData, setDeviceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState(null);
  const [searchHistoryQuery, setSearchHistoryQuery] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch full device data from API including complete locationHistory
  const fetchDeviceDetails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices/${deviceId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.device) {
          setDeviceData(data.device);
        }
      }
    } catch (err) {
      console.error('Failed fetching device details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceDetails();
  }, [deviceId]);

  // Sync real-time updates from DashboardContext devices list
  useEffect(() => {
    const liveDev = devices.find((d) => d.deviceId === deviceId);
    if (liveDev) {
      setDeviceData((prev) => {
        if (!prev) return liveDev;
        return {
          ...prev,
          ...liveDev,
          locationHistory: liveDev.locationHistory || prev.locationHistory || [],
        };
      });
    }
  }, [devices, deviceId]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const formatFullTime = (dateString) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading && !deviceData) {
    return (
      <Box sx={{ maxWidth: 1280, mx: 'auto', p: 4, textAlign: 'center' }}>
        <RefreshCw size={32} color="#00e5ff" className="spinning" style={{ margin: '0 auto 16px' }} />
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
          Loading Device Telemetry...
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, fontFamily: 'monospace' }}>
          Querying central registry for {deviceId}
        </Typography>
      </Box>
    );
  }

  const d = deviceData || { deviceId };
  const isOnline =
    onlineSocketDevices.has(d.deviceId) ||
    (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60);

  const isLive = isLocationLive(d, isOnline);
  const villageName = getVillageOrPara(d, updateDeviceLocation);
  const secondaryAddress = getLocationSecondary(d);
  const locationAge = formatLocationAge(d.locationUpdatedAt, d.lastSeen);

  const allHistory = Array.isArray(d.locationHistory) ? d.locationHistory : [];

  // Filter history by search query
  const filteredHistory = allHistory.filter((item) => {
    if (!searchHistoryQuery) return true;
    const q = searchHistoryQuery.toLowerCase();
    const v = (item.villageOrPara || '').toLowerCase();
    const loc = (item.locationName || '').toLowerCase();
    const dist = (item.districtAndCountry || '').toLowerCase();
    const coords = `${item.latitude || ''}, ${item.longitude || ''}`.toLowerCase();
    return v.includes(q) || loc.includes(q) || dist.includes(q) || coords.includes(q);
  });

  const totalHistoryPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedHistory = filteredHistory.slice(
    (historyPage - 1) * itemsPerPage,
    historyPage * itemsPerPage
  );

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Breadcrumb Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            component={Link}
            to="/devices"
            startIcon={<ArrowLeft size={16} />}
            variant="outlined"
            size="small"
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              '&:hover': { borderColor: '#00e5ff', color: '#00e5ff', bgcolor: 'rgba(0,229,255,0.06)' },
            }}
          >
            Back to Devices
          </Button>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)', height: 20, my: 'auto' }} />
          <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
            FLEET UNIT / <span style={{ color: '#00e5ff' }}>{d.deviceId}</span>
          </Typography>
        </Box>

        {/* Quick Surveillance Action Buttons */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="contained"
            disabled={!isOnline}
            onClick={() => openCameraModal(d, 'live')}
            startIcon={<Radio size={14} />}
            sx={{
              fontSize: '0.8rem',
              fontWeight: 700,
              background: isOnline ? 'linear-gradient(135deg, rgba(255,23,68,0.4) 0%, rgba(255,23,68,0.2) 100%)' : 'rgba(255,255,255,0.04)',
              border: isOnline ? '1px solid rgba(255,23,68,0.5)' : '1px solid rgba(255,255,255,0.08)',
              color: isOnline ? '#ff5252' : '#64748b',
              boxShadow: isOnline ? '0 0 14px rgba(255,23,68,0.25)' : 'none',
              '&:hover': isOnline ? { background: 'linear-gradient(135deg, #ff1744 0%, #c4001d 100%)', color: '#fff' } : {},
            }}
          >
            {isOnline ? 'Watch Live Surveillance' : 'Offline'}
          </Button>

          <Button
            size="small"
            variant={d.isRecording ? 'contained' : 'outlined'}
            disabled={!isOnline}
            onClick={() => d.isRecording ? handleStopRemoteRecording(d.deviceId) : openCameraModal(d, 'record')}
            startIcon={<Video size={14} />}
            sx={{
              fontSize: '0.8rem',
              fontWeight: 700,
              borderColor: d.isRecording ? 'rgba(255,23,68,0.5)' : isOnline ? 'rgba(0,229,255,0.35)' : 'rgba(255,255,255,0.1)',
              color: d.isRecording ? '#fff' : isOnline ? '#00e5ff' : '#64748b',
              background: d.isRecording ? 'linear-gradient(135deg, #ff1744 0%, #c4001d 100%)' : 'rgba(0,229,255,0.06)',
              boxShadow: d.isRecording ? '0 0 14px rgba(255,23,68,0.4)' : 'none',
            }}
          >
            {d.isRecording ? 'Stop Recording' : 'Remote Stealth Rec'}
          </Button>
        </Stack>
      </Box>

      {/* Main Device Header Banner */}
      <Card
        sx={{
          p: { xs: 2, sm: 3 },
          background: 'linear-gradient(135deg, rgba(13, 22, 38, 0.8) 0%, rgba(8, 14, 25, 0.95) 100%)',
          border: '1px solid rgba(0, 229, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2.5 }}>
          {/* Left: Device Icon & Name */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '16px',
                background: isOnline ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                border: isOnline ? '1px solid rgba(0, 229, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isOnline ? '#00e5ff' : '#64748b',
                boxShadow: isOnline ? '0 0 24px rgba(0, 229, 255, 0.25)' : 'none',
                flexShrink: 0,
              }}
            >
              <Smartphone size={28} />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                  {d.deviceName || d.model}
                </Typography>
                <Chip
                  size="small"
                  label={d.isRecording ? 'RECORDING' : isOnline ? 'ONLINE' : 'OFFLINE'}
                  sx={{
                    height: 22,
                    fontSize: 10.5,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 700,
                    bgcolor: d.isRecording ? 'rgba(255, 23, 68, 0.2)' : isOnline ? 'rgba(0, 230, 118, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                    border: d.isRecording ? '1px solid rgba(255, 23, 68, 0.5)' : isOnline ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                    color: d.isRecording ? '#ff5252' : isOnline ? '#00e676' : '#64748b',
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.6, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  onClick={() => copyToClipboard(d.deviceId, 'devId')}
                  endIcon={copiedText === 'devId' ? <Check size={12} color="#00e676" /> : <Copy size={12} />}
                  sx={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    px: 1,
                    py: 0.2,
                    minWidth: 0,
                    '&:hover': { color: '#fff', borderColor: 'rgba(0,229,255,0.4)' },
                  }}
                >
                  ID: {d.deviceId}
                </Button>
                <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                  Model: <span style={{ color: '#cbd5e1' }}>{d.model}</span>
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
                  OS: <span style={{ color: '#cbd5e1' }}>{d.androidVersion ? `Android ${d.androidVersion}` : 'Android'}</span>
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Right: Telemetry Badges */}
          <Stack direction="row" spacing={1.5} flexWrap="wrap">
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', minWidth: 110 }}>
              <Typography sx={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                Battery Health
              </Typography>
              <Typography sx={{
                fontSize: 15, fontWeight: 700, fontFamily: 'monospace', mt: 0.3,
                color: !isOnline ? '#94a3b8' : d.batteryLevel > 50 ? '#00e676' : d.batteryLevel > 20 ? '#f59e0b' : '#ff1744',
              }}>
                {d.batteryLevel || 0}% {!isOnline ? '(Last)' : ''}
              </Typography>
            </Box>

            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', minWidth: 110 }}>
              <Typography sx={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                Heartbeat Status
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', mt: 0.4, color: isOnline ? '#00e676' : '#94a3b8' }}>
                {isOnline ? 'Active Live' : formatTimeAgo(d.lastSeen)}
              </Typography>
            </Box>

            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', minWidth: 110 }}>
              <Typography sx={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                Drive Recordings
              </Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', mt: 0.3, color: '#00e5ff' }}>
                {d.totalRecordings || 0} files
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Card>

      {/* 🛰️ REAL-TIME SATELLITE GPS LOCATION CARD */}
      <Card
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(13, 22, 38, 0.85) 100%)',
          border: '1px solid rgba(0, 229, 255, 0.35)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'rgba(0, 229, 255, 0.18)',
                border: '1px solid rgba(0, 229, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00e5ff',
                boxShadow: '0 0 16px rgba(0, 229, 255, 0.25)',
              }}
            >
              <Crosshair size={20} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.06em' }}>
                LIVE SATELLITE GPS TELEMETRY
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: '#64748b', fontFamily: 'monospace' }}>
                Precision hardware GPS fix & reverse geo-location resolution
              </Typography>
            </Box>
          </Box>

          {/* 📍 REFRESH LIVE GPS BUTTON */}
          <Button
            size="medium"
            variant="contained"
            disabled={!isOnline || isRefreshingLocation}
            onClick={() => handleRequestDeviceLocation(d.deviceId)}
            startIcon={<RefreshCw size={15} className={isRefreshingLocation ? 'spinning' : ''} />}
            sx={{
              fontSize: '0.85rem',
              fontWeight: 800,
              py: 0.8,
              px: 2,
              background: isOnline ? 'linear-gradient(135deg, #00e5ff 0%, #0099b8 100%)' : 'rgba(255,255,255,0.05)',
              color: isOnline ? '#000' : '#64748b',
              boxShadow: isOnline ? '0 0 20px rgba(0, 229, 255, 0.4)' : 'none',
              '&:hover': isOnline ? { background: '#33ebff', boxShadow: '0 0 28px rgba(0, 229, 255, 0.6)' } : {},
            }}
          >
            {isRefreshingLocation ? 'Pinging Phone Satellite GPS...' : 'Refresh Live GPS'}
          </Button>
        </Box>

        {/* Live status banner feedback */}
        {locationRefreshStatus === 'requesting' && (
          <Box sx={{ mb: 2, p: 1.2, borderRadius: 2, bgcolor: 'rgba(0, 229, 255, 0.12)', border: '1px solid rgba(0, 229, 255, 0.35)', display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <RefreshCw size={16} color="#00e5ff" className="spinning" />
            <Typography sx={{ fontSize: 12.5, color: '#00e5ff', fontFamily: 'monospace', fontWeight: 600 }}>
              Command dispatched via WebSocket. Awaiting single-shot high accuracy GPS fix from phone...
            </Typography>
          </Box>
        )}
        {locationRefreshStatus === 'success' && (
          <Box sx={{ mb: 2, p: 1.2, borderRadius: 2, bgcolor: 'rgba(0, 230, 118, 0.12)', border: '1px solid rgba(0, 230, 118, 0.35)', display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Check size={16} color="#00e676" />
            <Typography sx={{ fontSize: 12.5, color: '#00e676', fontFamily: 'monospace', fontWeight: 600 }}>
              ✅ Satellite GPS updated successfully in real-time!
            </Typography>
          </Box>
        )}

        {d.latitude && d.longitude ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: { xs: 18, sm: 22 }, fontWeight: 800, color: isLive ? '#00e676' : '#00e5ff' }}>
                    {villageName}
                  </Typography>
                  {isLive ? (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.6,
                        px: 1,
                        py: 0.3,
                        borderRadius: '6px',
                        background: 'rgba(0, 230, 118, 0.2)',
                        border: '1px solid rgba(0, 230, 118, 0.45)',
                      }}
                    >
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#00e676', boxShadow: '0 0 8px #00e676', animation: 'radar-dot-pulse 1.5s infinite' }} />
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#00e676', fontFamily: 'monospace' }}>
                        LIVE
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.6,
                        px: 1,
                        py: 0.3,
                        borderRadius: '6px',
                        background: 'rgba(245, 158, 11, 0.16)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                      }}
                    >
                      <Clock size={11} color="#f59e0b" />
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>
                        {locationAge}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {secondaryAddress && (
                  <Typography sx={{ fontSize: 14, color: '#94a3b8' }}>
                    {secondaryAddress}
                  </Typography>
                )}
              </Box>

              <Button
                component="a"
                href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                size="medium"
                startIcon={<ExternalLink size={15} />}
                sx={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#00e5ff',
                  borderColor: 'rgba(0, 229, 255, 0.45)',
                  background: 'rgba(0, 229, 255, 0.08)',
                  py: 0.8,
                  px: 2,
                  '&:hover': { background: 'rgba(0, 229, 255, 0.2)', borderColor: '#00e5ff' },
                }}
              >
                Open in Google Maps
              </Button>
            </Box>

            {/* Telemetry Metrics Grid */}
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography sx={{ fontSize: 10.5, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                    Exact Coordinates
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.4 }}>
                    <Typography sx={{ fontSize: 13, fontFamily: 'monospace', color: '#fff', fontWeight: 700 }}>
                      {d.latitude.toFixed(6)}, {d.longitude.toFixed(6)}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => copyToClipboard(`${d.latitude}, ${d.longitude}`, 'coords')}
                      sx={{ color: '#64748b', p: 0.4 }}
                    >
                      {copiedText === 'coords' ? <Check size={14} color="#00e676" /> : <Copy size={14} />}
                    </IconButton>
                  </Box>
                </Box>
              </Grid>

              <Grid size={{ xs: 6, sm: 4 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography sx={{ fontSize: 10.5, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                    Telemetry Source
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 700, mt: 0.4 }}>
                    {d.locationSource || 'GPS (Satellite)'}
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 6, sm: 4 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography sx={{ fontSize: 10.5, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                    Last Fix Acquired
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontFamily: 'monospace', color: isLive ? '#00e676' : '#fbbf24', fontWeight: 700, mt: 0.4 }}>
                    {d.locationUpdatedAt ? formatFullTime(d.locationUpdatedAt) : 'Just now'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <AlertCircle size={32} color="#64748b" style={{ margin: '0 auto 10px' }} />
            <Typography sx={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>
              GPS coordinates not yet reported by this device.
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              Click &quot;Refresh Live GPS&quot; above to request satellite coordinates directly from the phone.
            </Typography>
          </Box>
        )}
      </Card>

      {/* 🗺️ LOCATION MOVEMENT HISTORY TABLE (REQUESTED CORE FEATURE) */}
      <Card sx={{ p: { xs: 2, sm: 3 }, overflow: 'hidden' }}>
        {/* Table Header with Search & Filter */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Navigation size={20} color="#00e5ff" />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
                Location Movement History
              </Typography>
              <Chip
                size="small"
                label={`${allHistory.length} Visited Points`}
                sx={{
                  background: 'rgba(0,229,255,0.12)',
                  border: '1px solid rgba(0,229,255,0.3)',
                  color: '#00e5ff',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.3 }}>
              Chronological breadcrumb trail of everywhere this device has traveled
            </Typography>
          </Box>

          {/* Search within location logs */}
          <TextField
            size="small"
            placeholder="Search village, area, coordinates..."
            value={searchHistoryQuery}
            onChange={(e) => {
              setSearchHistoryQuery(e.target.value);
              setHistoryPage(1);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={15} color="#64748b" />
                  </InputAdornment>
                ),
                endAdornment: searchHistoryQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchHistoryQuery('')} sx={{ color: '#64748b' }}>
                      <X size={13} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
            sx={{ width: { xs: '100%', sm: 300 } }}
          />
        </Box>

        {/* Location History Data Table */}
        {filteredHistory.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center', background: 'rgba(16,23,38,0.5)', borderRadius: 2, border: '1px dashed rgba(255,255,255,0.08)' }}>
            <MapPin size={36} color="#475569" style={{ margin: '0 auto 12px' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
              {searchHistoryQuery ? 'No matching location logs found' : 'No movement history recorded yet'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, maxWidth: 420, mx: 'auto' }}>
              {searchHistoryQuery
                ? 'Try searching with a different village name, road or coordinate.'
                : 'As the phone travels between locations, every GPS coordinate ping is automatically saved to this table.'}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 50 }}>#</TableCell>
                  <TableCell>Area</TableCell>
                  <TableCell>Date, Time & Duration</TableCell>
                  <TableCell>Source & Accuracy</TableCell>
                  <TableCell align="right">Google Maps</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedHistory.map((item, idx) => {
                  const absoluteIndex = (historyPage - 1) * itemsPerPage + idx + 1;
                  const isLatest = absoluteIndex === 1 && !searchHistoryQuery;
                  const itemVillage = item.villageOrPara || (item.locationName ? item.locationName.split(',')[0] : 'Unknown Location');

                  const startDate = item.startTime ? new Date(item.startTime) : (item.timestamp ? new Date(item.timestamp) : new Date());
                  const endDate = item.endTime ? new Date(item.endTime) : (item.timestamp ? new Date(item.timestamp) : startDate);

                  const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  const startStr = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  const endStr = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                  const diffMins = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 60000));

                  let durationLabel = '';
                  if (diffMins >= 60) {
                    const hrs = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    durationLabel = mins > 0 ? `${hrs}h ${mins}m stayed` : `${hrs}h stayed`;
                  } else if (diffMins > 0) {
                    durationLabel = `${diffMins}m stayed`;
                  } else {
                    durationLabel = formatTimeAgo(endDate);
                  }

                  return (
                    <TableRow
                      key={idx}
                      hover
                      sx={{
                        background: isLatest ? 'rgba(0, 229, 255, 0.04)' : 'transparent',
                        '&:hover': { background: 'rgba(0, 229, 255, 0.08)' },
                      }}
                    >
                      {/* Index */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: isLatest ? '#00e676' : '#64748b', fontWeight: 700 }}>
                            #{absoluteIndex}
                          </Typography>
                          {isLatest && (
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00e676', boxShadow: '0 0 6px #00e676' }} />
                          )}
                        </Box>
                      </TableCell>

                      {/* Area */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 26,
                              height: 26,
                              borderRadius: '6px',
                              bgcolor: isLatest ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isLatest ? '#00e676' : '#94a3b8',
                              flexShrink: 0,
                            }}
                          >
                            <MapPin size={13} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: isLatest ? '#00e676' : '#fff' }}>
                                {itemVillage}
                              </Typography>
                              {isLatest && (
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
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Date, Time & Duration (Combined) */}
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#cbd5e1', fontWeight: 700, display: 'block' }}>
                          {dateStr}
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: '0.75rem', display: 'block', mt: 0.2 }}>
                          {startStr} – {endStr}
                          {' '}
                          <span style={{ color: '#00e5ff', fontWeight: 700 }}>({durationLabel})</span>
                        </Typography>
                      </TableCell>

                      {/* Source & Accuracy */}
                      <TableCell>
                        <Chip
                          size="small"
                          label={`${item.source || 'GPS'} ${item.accuracy ? `(±${Math.round(item.accuracy)}m)` : ''}`}
                          sx={{
                            height: 20,
                            fontSize: 9.5,
                            fontFamily: 'monospace',
                            bgcolor: 'rgba(0, 229, 255, 0.08)',
                            border: '1px solid rgba(0, 229, 255, 0.25)',
                            color: '#00e5ff',
                          }}
                        />
                      </TableCell>

                      {/* Google Maps Pin */}
                      <TableCell align="right">
                        {item.latitude && item.longitude && (
                          <Button
                            component="a"
                            href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            size="small"
                            variant="outlined"
                            endIcon={<ExternalLink size={12} />}
                            sx={{
                              fontSize: '0.75rem',
                              color: '#00e5ff',
                              borderColor: 'rgba(0, 229, 255, 0.35)',
                              background: 'rgba(0, 229, 255, 0.04)',
                              px: 1.2,
                              py: 0.3,
                              '&:hover': { bgcolor: 'rgba(0, 229, 255, 0.16)', borderColor: '#00e5ff' },
                            }}
                          >
                            View Pin
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination Controls */}
        {filteredHistory.length > itemsPerPage && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              mt: 2,
              pt: 2,
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
              Showing {(historyPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(historyPage * itemsPerPage, filteredHistory.length)} of {filteredHistory.length} location records
            </Typography>
            <Pagination
              count={totalHistoryPages}
              page={historyPage}
              onChange={(_, page) => setHistoryPage(page)}
              size="small"
              showFirstButton
              showLastButton
            />
          </Box>
        )}
      </Card>

      {/* Hardware & Fleet Specifications Card */}
      <Card sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2 }}>
          <Cpu size={18} color="#00e5ff" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
            Hardware & Device Specifications
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {[
            { label: 'Device Model', value: d.model || 'Unknown Android' },
            { label: 'Android OS Version', value: d.androidVersion ? `Android ${d.androidVersion}` : 'Android OS' },
            { label: 'Third Eye App Version', value: `v${d.appVersion || '1.0'}` },
            { label: 'Local / Remote IP Address', value: d.ipAddress ? d.ipAddress.split(',')[0] : 'Relay Local' },
            { label: 'Video Quality Profile', value: d.videoQuality || '720p HD' },
            { label: 'Initial Registration Date', value: d.createdAt ? formatFullTime(d.createdAt) : 'Active' },
          ].map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.label}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography sx={{ fontSize: 10.5, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                  {item.label}
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1', mt: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Card>
    </Box>
  );
}
