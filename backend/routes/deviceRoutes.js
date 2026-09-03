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
      latitude,
      longitude,
      locationName,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    const updateFields = {
      deviceName: deviceName || 'Android Device',
      model: model || 'Unknown Model',
      androidVersion: androidVersion || '',
      batteryLevel: batteryLevel !== undefined ? batteryLevel : 100,
      isRecording: Boolean(isRecording),
      videoQuality: videoQuality || '720p',
      appVersion: appVersion || '1.0',
      lastSeen: new Date(),
      ipAddress,
    };

    if (latitude !== undefined && latitude !== null) {
      updateFields.latitude = Number(latitude);
    }
    if (longitude !== undefined && longitude !== null) {
      updateFields.longitude = Number(longitude);
    }
    if (locationName) {
      updateFields.locationName = locationName;
    }

    // Fallback: If device GPS is not ready/cached, resolve location via public IP
    if (!updateFields.latitude && ipAddress) {
      try {
        const cleanIp = ipAddress.split(',')[0].trim();
        if (cleanIp && !cleanIp.startsWith('127.') && !cleanIp.startsWith('10.') && !cleanIp.startsWith('192.168.')) {
          const geoRes = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,city,lat,lon`);
          const geoData = await geoRes.json();
          if (geoData && geoData.status === 'success') {
            updateFields.latitude = geoData.lat;
            updateFields.longitude = geoData.lon;
            updateFields.locationName = `${geoData.city}, ${geoData.country}`;
          }
        }
      } catch (e) {
        // Ignore IP geo lookup error
      }
    }

    const device = await Device.findOneAndUpdate(
      { deviceId },
      updateFields,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
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
