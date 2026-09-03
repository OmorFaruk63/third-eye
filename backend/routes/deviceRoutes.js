const express = require('express');
const router = express.Router();
const Device = require('../models/Device');

// Device Heartbeat & Registration
router.post('/ping', async (req, res) => {
  try {
    const {
      deviceId,
      deviceName,
      model,
      androidVersion,
      batteryLevel,
      isRecording,
      videoQuality,
      appVersion,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    const device = await Device.findOneAndUpdate(
      { deviceId },
      {
        deviceName: deviceName || 'Android Device',
        model: model || 'Unknown Model',
        androidVersion: androidVersion || '',
        batteryLevel: batteryLevel !== undefined ? batteryLevel : 100,
        isRecording: Boolean(isRecording),
        videoQuality: videoQuality || '720p',
        appVersion: appVersion || '1.0',
        lastSeen: new Date(),
        ipAddress,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, device });
  } catch (error) {
    console.error('Error handling device ping:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get all devices
router.get('/', async (req, res) => {
  try {
    const devices = await Device.find().sort({ lastSeen: -1 });
    res.json({ success: true, count: devices.length, devices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete a device
router.delete('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    await Device.findOneAndDelete({ deviceId });
    res.json({ success: true, message: 'Device removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
