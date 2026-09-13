import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Play,
  Pause,
  RotateCcw,
  Navigation,
  MapPin,
  Shield,
  Plus,
  Trash2,
  ExternalLink,
  Layers,
  Clock,
  Gauge,
  Calendar,
  Eye,
} from 'lucide-react';
import { API_BASE_URL } from '../context/DashboardContext';

// Fix default leaflet marker asset paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function MobilityRouteMap({ deviceId, liveLat, liveLon, liveLocationName }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    polyline: null,
    glowPolyline: null,
    stopMarkers: [],
    geofenceCircles: [],
    liveMarker: null,
    playbackMarker: null,
  });

  // Data states
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [routeData, setRouteData] = useState({ breadcrumbs: [], stops: [] });
  const [loading, setLoading] = useState(false);
  const [geofences, setGeofences] = useState([]);

  // Playback Trail states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(2); // 1x, 2x, 5x, 10x
  const playbackTimerRef = useRef(null);

  // Geofence modal state
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState(300);
  const [newZoneLat, setNewZoneLat] = useState('');
  const [newZoneLon, setNewZoneLon] = useState('');
  const [alertOnEnter, setAlertOnEnter] = useState(true);
  const [alertOnExit, setAlertOnExit] = useState(true);

  // 1. Initialize Leaflet Map with CartoDB Dark Matter
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = liveLat || 23.8103;
    const initialLon = liveLon || 90.4125;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    // Click map to set geofence coordinates
    map.on('click', (e) => {
      setNewZoneLat(e.latlng.lat.toFixed(6));
      setNewZoneLon(e.latlng.lng.toFixed(6));
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Fetch Route Data (Breadcrumbs & Stops) for Selected Date
  const fetchRouteData = async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/mobility-route?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRouteData({
            breadcrumbs: data.breadcrumbs || [],
            stops: data.stops || [],
          });
          setPlaybackIndex(0);
          setIsPlaying(false);
        }
      }
    } catch (err) {
      console.error('Failed fetching mobility route:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Geofences
  const fetchGeofences = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices/geofences/all`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setGeofences(data.zones || []);
        }
      }
    } catch (err) {
      console.error('Failed fetching geofences:', err);
    }
  };

  useEffect(() => {
    fetchRouteData();
  }, [deviceId, selectedDate]);

  useEffect(() => {
    fetchGeofences();
  }, []);

  // 4. Render Layers on Map (Polyline, Stops, Geofences, Live Position)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old layers
    if (layersRef.current.glowPolyline) map.removeLayer(layersRef.current.glowPolyline);
    if (layersRef.current.polyline) map.removeLayer(layersRef.current.polyline);
    layersRef.current.stopMarkers.forEach((m) => map.removeLayer(m));
    layersRef.current.stopMarkers = [];
    layersRef.current.geofenceCircles.forEach((c) => map.removeLayer(c));
    layersRef.current.geofenceCircles = [];
    if (layersRef.current.liveMarker) map.removeLayer(layersRef.current.liveMarker);

    const { breadcrumbs, stops } = routeData;

    // --- A. Draw Glowing Neon Route Polyline ---
    if (breadcrumbs && breadcrumbs.length > 0) {
      const latLngs = breadcrumbs.map((b) => [b.latitude, b.longitude]);

      // Outer cyan glow layer
      layersRef.current.glowPolyline = L.polyline(latLngs, {
        color: '#00e5ff',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Inner crisp neon line
      layersRef.current.polyline = L.polyline(latLngs, {
        color: '#00e5ff',
        weight: 3.5,
        opacity: 0.95,
        dashArray: '2, 6',
      }).addTo(map);

      // Auto fit bounds
      if (latLngs.length > 1) {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
      }
    }

    // --- B. Draw Stop Markers ---
    if (stops && stops.length > 0) {
      stops.forEach((stop, idx) => {
        const stopNum = idx + 1;
        const durationText = stop.stayDurationMinutes >= 60
          ? `${Math.floor(stop.stayDurationMinutes / 60)}h ${stop.stayDurationMinutes % 60}m`
          : `${stop.stayDurationMinutes || 1}m`;

        const stopIcon = L.divIcon({
          className: 'custom-stop-icon',
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: 4px;
              background: rgba(13, 22, 38, 0.92);
              border: 1.5px solid #00e5ff;
              box-shadow: 0 0 14px rgba(0, 229, 255, 0.4);
              border-radius: 20px;
              padding: 3px 8px;
              color: #fff;
              font-family: 'JetBrains Mono', monospace;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              cursor: pointer;
            ">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #00e5ff; display: inline-block;"></span>
              <span>#${stopNum}</span>
              <span style="color: #00e5ff; font-size: 10px;">${durationText}</span>
            </div>
          `,
          iconSize: [80, 26],
          iconAnchor: [40, 13],
        });

        const arrivalStr = stop.arrivalTime ? new Date(stop.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
        const departureStr = stop.departureTime ? new Date(stop.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Present';

        const popupContent = `
          <div style="font-family: sans-serif; min-width: 200px; color: #fff; padding: 4px;">
            <div style="font-size: 11px; color: #00e5ff; font-weight: 800; font-family: monospace; text-transform: uppercase;">
              STAY-POINT #${stopNum}
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #fff; margin: 4px 0;">
              ${stop.areaName || 'Known Area'}
            </div>
            ${stop.fullAddress ? `<div style="font-size: 11.5px; color: #94a3b8; margin-bottom: 6px;">${stop.fullAddress}</div>` : ''}
            <div style="font-size: 12px; font-family: monospace; color: #cbd5e1; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
              <div>🕒 Arrived: <span style="color: #00e676;">${arrivalStr}</span></div>
              <div>🚪 Departed: <span style="color: #f59e0b;">${departureStr}</span></div>
              <div>⏱️ Stay Duration: <span style="color: #00e5ff; font-weight: 700;">${durationText}</span></div>
            </div>
            <a href="https://www.google.com/maps?q=${stop.latitude},${stop.longitude}" target="_blank" rel="noreferrer" style="display: inline-block; margin-top: 8px; color: #00e5ff; font-size: 11px; text-decoration: none; font-weight: 700;">
              Open in Google Maps ↗
            </a>
          </div>
        `;

        const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
          .bindPopup(popupContent, { className: 'dark-neon-popup' })
          .addTo(map);

        layersRef.current.stopMarkers.push(marker);
      });
    }

    // --- C. Draw Geofence Safe Zones ---
    geofences.forEach((zone) => {
      const circle = L.circle([zone.centerLat, zone.centerLon], {
        radius: zone.radiusMeters || 300,
        color: '#00e676',
        fillColor: '#00e676',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '4, 6',
      }).addTo(map);

      circle.bindPopup(`
        <div style="color: #fff; font-family: sans-serif;">
          <div style="color: #00e676; font-size: 11px; font-weight: 800; text-transform: uppercase;">SAFE ZONE</div>
          <div style="font-size: 14px; font-weight: 700; color: #fff;">${zone.name}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Radius: ${zone.radiusMeters}m</div>
          <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">
            ${zone.alertOnEnter ? '🔔 Alert on Enter' : ''} ${zone.alertOnExit ? '🔔 Alert on Exit' : ''}
          </div>
        </div>
      `);

      layersRef.current.geofenceCircles.push(circle);
    });

    // --- D. Draw Live Current Position Marker ---
    if (liveLat && liveLon) {
      const liveIcon = L.divIcon({
        className: 'custom-live-radar-icon',
        html: `
          <div style="position: relative; width: 24px; height: 24px;">
            <div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: rgba(0, 230, 118, 0.3); animation: radar-pulse 2s infinite ease-out;"></div>
            <div style="position: absolute; top: 6px; left: 6px; width: 12px; height: 12px; border-radius: 50%; background: #00e676; border: 2px solid #fff; box-shadow: 0 0 10px #00e676;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const liveMarker = L.marker([liveLat, liveLon], { icon: liveIcon })
        .bindPopup(`
          <div style="color: #fff; font-family: sans-serif;">
            <div style="color: #00e676; font-weight: 800; font-size: 11px;">📍 LIVE CURRENT POSITION</div>
            <div style="font-size: 13px; font-weight: 700;">${liveLocationName || 'Active Location'}</div>
            <div style="font-size: 11px; color: #94a3b8; font-family: monospace; margin-top: 4px;">${liveLat.toFixed(6)}, ${liveLon.toFixed(6)}</div>
          </div>
        `)
        .addTo(map);

      layersRef.current.liveMarker = liveMarker;
    }
  }, [routeData, geofences, liveLat, liveLon, liveLocationName]);

  // 5. Playback Trail Loop
  useEffect(() => {
    if (!isPlaying) {
      clearInterval(playbackTimerRef.current);
      return;
    }

    const { breadcrumbs } = routeData;
    if (!breadcrumbs || breadcrumbs.length === 0) return;

    const intervalMs = Math.max(80, Math.floor(1000 / playbackSpeed));

    playbackTimerRef.current = setInterval(() => {
      setPlaybackIndex((prev) => {
        if (prev >= breadcrumbs.length - 1) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(playbackTimerRef.current);
  }, [isPlaying, playbackSpeed, routeData]);

  // 6. Update Moving Playback Marker on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const { breadcrumbs } = routeData;
    if (!breadcrumbs || breadcrumbs.length === 0) return;

    const pt = breadcrumbs[playbackIndex];
    if (!pt) return;

    if (!layersRef.current.playbackMarker) {
      const playIcon = L.divIcon({
        className: 'playback-trail-cursor',
        html: `
          <div style="
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #ff007a;
            border: 2px solid #fff;
            box-shadow: 0 0 16px #ff007a;
            display: flex;
            align-items: center;
            justifyContent: center;
          ">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #fff;"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      layersRef.current.playbackMarker = L.marker([pt.latitude, pt.longitude], {
        icon: playIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      layersRef.current.playbackMarker.setLatLng([pt.latitude, pt.longitude]);
    }
  }, [playbackIndex, routeData]);

  // Handle Save Geofence
  const handleCreateGeofence = async () => {
    if (!newZoneName || !newZoneLat || !newZoneLon) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices/geofences/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newZoneName,
          centerLat: Number(newZoneLat),
          centerLon: Number(newZoneLon),
          radiusMeters: Number(newZoneRadius) || 300,
          alertOnEnter,
          alertOnExit,
          targetDevices: deviceId ? [deviceId] : [],
        }),
      });
      if (res.ok) {
        fetchGeofences();
        setGeofenceModalOpen(false);
        setNewZoneName('');
      }
    } catch (e) {
      console.error('Failed creating geofence:', e);
    }
  };

  const handleDeleteGeofence = async (zoneId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/devices/geofences/${zoneId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchGeofences();
      }
    } catch (e) {
      console.error('Failed deleting geofence:', e);
    }
  };

  const currentPlaybackPoint = routeData.breadcrumbs[playbackIndex] || null;

  return (
    <Card
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid rgba(0, 229, 255, 0.25)',
        background: 'linear-gradient(135deg, rgba(8, 14, 25, 0.95) 0%, rgba(13, 22, 38, 0.9) 100%)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Top Map Toolbar Header */}
      <Box
        sx={{
          p: { xs: 1.5, sm: 2 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Left: Title & Stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              background: 'rgba(0, 229, 255, 0.15)',
              border: '1px solid rgba(0, 229, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00e5ff',
            }}
          >
            <Navigation size={20} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff' }}>
                Mobility Trail & Route Polyline Map
              </Typography>
              <Chip
                size="small"
                label={`${routeData.stops.length} Stops`}
                sx={{
                  height: 20,
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  bgcolor: 'rgba(0, 229, 255, 0.15)',
                  color: '#00e5ff',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Stay-point detection, high-frequency breadcrumbs, and geofencing zones
            </Typography>
          </Box>
        </Box>

        {/* Right: Date Picker & Geofence Button */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            type="date"
            size="small"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            slotProps={{
              input: {
                sx: {
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  color: '#00e5ff',
                  bgcolor: 'rgba(0,0,0,0.4)',
                  borderColor: 'rgba(0,229,255,0.3)',
                  height: 36,
                },
              },
            }}
          />

          <Button
            size="small"
            variant="outlined"
            startIcon={<Shield size={14} />}
            onClick={() => {
              setNewZoneLat(liveLat ? liveLat.toFixed(6) : '23.8103');
              setNewZoneLon(liveLon ? liveLon.toFixed(6) : '90.4125');
              setGeofenceModalOpen(true);
            }}
            sx={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#00e676',
              borderColor: 'rgba(0, 230, 118, 0.4)',
              background: 'rgba(0, 230, 118, 0.08)',
              '&:hover': { borderColor: '#00e676', background: 'rgba(0, 230, 118, 0.2)' },
            }}
          >
            Safe Zones ({geofences.length})
          </Button>
        </Stack>
      </Box>

      {/* Interactive Map Box */}
      <Box sx={{ position: 'relative', width: '100%', height: { xs: 380, sm: 460, md: 520 } }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(8, 14, 25, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              gap: 1.5,
            }}
          >
            <CircularProgress size={32} sx={{ color: '#00e5ff' }} />
            <Typography variant="caption" sx={{ color: '#00e5ff', fontFamily: 'monospace' }}>
              Loading Route & Stay-Points...
            </Typography>
          </Box>
        )}

        {/* Map Legend Overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 500,
            p: 1.2,
            borderRadius: 2,
            bgcolor: 'rgba(13, 22, 38, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.8,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 14, height: 3, bgcolor: '#00e5ff', borderRadius: 1 }} />
            <Typography sx={{ fontSize: 10.5, color: '#cbd5e1', fontFamily: 'monospace' }}>
              Route Polyline
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', border: '1.5px solid #00e5ff', bgcolor: '#0d1626' }} />
            <Typography sx={{ fontSize: 10.5, color: '#cbd5e1', fontFamily: 'monospace' }}>
              Stay-Point (&gt;3 min)
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#00e676' }} />
            <Typography sx={{ fontSize: 10.5, color: '#cbd5e1', fontFamily: 'monospace' }}>
              Live Pin / Safe Zone
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Bottom Playback Trail Controller HUD */}
      <Box
        sx={{
          p: 2,
          background: 'rgba(0, 0, 0, 0.4)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          {/* Controls: Play/Pause, Reset, Speed */}
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              size="small"
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={routeData.breadcrumbs.length === 0}
              sx={{
                width: 36,
                height: 36,
                bgcolor: isPlaying ? 'rgba(255,23,68,0.2)' : 'rgba(0,229,255,0.2)',
                color: isPlaying ? '#ff5252' : '#00e5ff',
                border: isPlaying ? '1px solid rgba(255,23,68,0.5)' : '1px solid rgba(0,229,255,0.5)',
                '&:hover': { bgcolor: isPlaying ? 'rgba(255,23,68,0.3)' : 'rgba(0,229,255,0.3)' },
              }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </IconButton>

            <IconButton
              size="small"
              onClick={() => {
                setIsPlaying(false);
                setPlaybackIndex(0);
              }}
              disabled={routeData.breadcrumbs.length === 0}
              sx={{ color: '#94a3b8' }}
            >
              <RotateCcw size={16} />
            </IconButton>

            <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
              {[1, 2, 5, 10].map((spd) => (
                <Button
                  key={spd}
                  size="small"
                  onClick={() => setPlaybackSpeed(spd)}
                  variant={playbackSpeed === spd ? 'contained' : 'outlined'}
                  sx={{
                    minWidth: 32,
                    px: 0.8,
                    py: 0.2,
                    fontSize: 10,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    borderColor: 'rgba(255,255,255,0.1)',
                    bgcolor: playbackSpeed === spd ? '#00e5ff' : 'transparent',
                    color: playbackSpeed === spd ? '#000' : '#94a3b8',
                  }}
                >
                  {spd}x
                </Button>
              ))}
            </Stack>
          </Stack>

          {/* Current Playback Point Telemetry Readout */}
          {currentPlaybackPoint ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Clock size={14} color="#00e5ff" />
                <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: '#fff', fontWeight: 700 }}>
                  {new Date(currentPlaybackPoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Gauge size={14} color="#00e676" />
                <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: '#00e676', fontWeight: 700 }}>
                  {Math.round(currentPlaybackPoint.speedKmh || 0)} km/h
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>
                Point {playbackIndex + 1} / {routeData.breadcrumbs.length}
              </Typography>
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
              No route points recorded for this date.
            </Typography>
          )}
        </Box>

        {/* Time Scrubber Slider */}
        <Slider
          size="small"
          disabled={routeData.breadcrumbs.length === 0}
          value={playbackIndex}
          min={0}
          max={Math.max(0, routeData.breadcrumbs.length - 1)}
          onChange={(_, val) => {
            setIsPlaying(false);
            setPlaybackIndex(val);
          }}
          sx={{
            color: '#00e5ff',
            py: 0.8,
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              boxShadow: '0 0 10px #00e5ff',
            },
            '& .MuiSlider-rail': {
              bgcolor: 'rgba(255,255,255,0.1)',
            },
          }}
        />
      </Box>

      {/* Geofence Management Dialog */}
      <Dialog
        open={geofenceModalOpen}
        onClose={() => setGeofenceModalOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#0d1626',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              borderRadius: 3,
            },
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Shield size={20} color="#00e676" />
          Geofencing & Safe Zones
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            Safe zones trigger instant acoustic and visual alerts whenever this phone enters or exits the boundary.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="subtitle2" sx={{ color: '#00e5ff', fontWeight: 700 }}>
              + Create New Safe Zone
            </Typography>
            <TextField
              size="small"
              label="Zone Name (e.g. Home, Office, Campus)"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              fullWidth
            />
            <Stack direction="row" spacing={1.5}>
              <TextField
                size="small"
                label="Center Latitude"
                value={newZoneLat}
                onChange={(e) => setNewZoneLat(e.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                label="Center Longitude"
                value={newZoneLon}
                onChange={(e) => setNewZoneLon(e.target.value)}
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                select
                size="small"
                label="Safe Radius"
                value={newZoneRadius}
                onChange={(e) => setNewZoneRadius(e.target.value)}
                sx={{ width: 160 }}
              >
                <MenuItem value={150}>150 meters</MenuItem>
                <MenuItem value={300}>300 meters</MenuItem>
                <MenuItem value={500}>500 meters</MenuItem>
                <MenuItem value={1000}>1,000 meters</MenuItem>
                <MenuItem value={2000}>2,000 meters</MenuItem>
              </TextField>

              <FormControlLabel
                control={<Switch size="small" checked={alertOnEnter} onChange={(e) => setAlertOnEnter(e.target.checked)} />}
                label={<Typography sx={{ fontSize: 12, color: '#cbd5e1' }}>Alert Enter</Typography>}
              />
              <FormControlLabel
                control={<Switch size="small" checked={alertOnExit} onChange={(e) => setAlertOnExit(e.target.checked)} />}
                label={<Typography sx={{ fontSize: 12, color: '#cbd5e1' }}>Alert Exit</Typography>}
              />
            </Stack>

            <Button
              variant="contained"
              size="small"
              onClick={handleCreateGeofence}
              disabled={!newZoneName || !newZoneLat || !newZoneLon}
              startIcon={<Plus size={15} />}
              sx={{
                bgcolor: '#00e676',
                color: '#000',
                fontWeight: 700,
                alignSelf: 'flex-start',
                '&:hover': { bgcolor: '#33eb91' },
              }}
            >
              Add Zone to Map
            </Button>
          </Box>

          {/* Existing Zones List */}
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, mt: 1 }}>
            Active Safe Zones ({geofences.length})
          </Typography>

          {geofences.map((zone) => (
            <Box
              key={zone._id}
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700, color: '#fff', fontSize: 13 }}>
                  {zone.name}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                  Radius: {zone.radiusMeters}m • ({zone.centerLat?.toFixed(4)}, {zone.centerLon?.toFixed(4)})
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => handleDeleteGeofence(zone._id)} sx={{ color: '#ff5252' }}>
                <Trash2 size={15} />
              </IconButton>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGeofenceModalOpen(false)} sx={{ color: '#94a3b8' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
