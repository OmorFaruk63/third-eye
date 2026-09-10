const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const { resolveVillageOrPara } = require('../utils/geoCoder');
const { processDeviceLocationUpdate } = require('../utils/locationHelper');

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
      cameraLens,
      appVersion,
      latitude,
      longitude,
      locationName,
      villageOrPara,
      districtAndCountry,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const now = new Date();

    let device = await Device.findOne({ deviceId });
    if (!device) {
      device = new Device({ deviceId });
    }

    device.deviceName = deviceName || device.deviceName || 'Android Device';
    device.model = model || device.model || 'Unknown Model';
    device.androidVersion = androidVersion || device.androidVersion || '';
    device.batteryLevel = batteryLevel !== undefined ? batteryLevel : device.batteryLevel;
    device.isRecording = Boolean(isRecording);
    device.videoQuality = videoQuality || device.videoQuality || '720p';
    device.cameraLens = cameraLens || device.cameraLens || 'BACK';
    device.appVersion = appVersion || device.appVersion || '1.0';
    device.lastSeen = now;
    if (ipAddress) device.ipAddress = ipAddress;

    let targetLat = latitude !== undefined && latitude !== null ? Number(latitude) : device.latitude;
    let targetLon = longitude !== undefined && longitude !== null ? Number(longitude) : device.longitude;
    let targetLocName = locationName || device.locationName;
    let targetVillage = villageOrPara || device.villageOrPara;
    let targetDistrict = districtAndCountry || device.districtAndCountry;

    // Fallback: If device GPS is not ready/cached, resolve location via public IP
    if (!targetLat && ipAddress) {
      try {
        const cleanIp = ipAddress.split(',')[0].trim();
        if (cleanIp && !cleanIp.startsWith('127.') && !cleanIp.startsWith('10.') && !cleanIp.startsWith('192.168.')) {
          const geoRes = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,city,lat,lon`);
          const geoData = await geoRes.json();
          if (geoData && geoData.status === 'success') {
            targetLat = geoData.lat;
            targetLon = geoData.lon;
            targetLocName = `${geoData.city}, ${geoData.country}`;
          }
        }
      } catch (e) {
        // Ignore IP geo lookup error
      }
    }

    if (targetLat && targetLon) {
      // High-precision Village / Para resolution if not already set or if generic
      const isGeneric = !targetVillage ||
        ['dhaka', 'chittagong', 'chattogram', 'sylhet', 'rajshahi', 'khulna', 'barishal', 'rangpur'].includes(targetVillage.toLowerCase().trim());
      if (isGeneric) {
        try {
          const resolved = await resolveVillageOrPara(targetLat, targetLon);
          if (resolved && resolved.villageOrPara) {
            targetVillage = resolved.villageOrPara;
            if (resolved.districtAndCountry) targetDistrict = resolved.districtAndCountry;
            if (resolved.locationName) targetLocName = resolved.locationName;
          }
        } catch (e) {
          // ignore
        }
      }

      processDeviceLocationUpdate(device, {
        latitude: targetLat,
        longitude: targetLon,
        locationName: targetLocName,
        villageOrPara: targetVillage,
        districtAndCountry: targetDistrict,
        accuracy: req.body.accuracy,
        source: req.body.source,
      }, now);
    }

    await device.save();

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

    // Asynchronously ensure any devices with lat/long have village/para populated
    for (const d of devices) {
      if (d.latitude && d.longitude && (!d.villageOrPara || ['dhaka', 'chittagong', 'chattogram', 'sylhet', 'rajshahi', 'khulna', 'barishal', 'rangpur'].includes(d.villageOrPara.toLowerCase().trim()))) {
        resolveVillageOrPara(d.latitude, d.longitude).then((resolved) => {
          if (resolved && resolved.villageOrPara) {
            Device.updateOne(
              { _id: d._id },
              {
                villageOrPara: resolved.villageOrPara,
                districtAndCountry: resolved.districtAndCountry || d.districtAndCountry,
                locationName: resolved.locationName || d.locationName,
              }
            ).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    res.json({ success: true, count: devices.length, devices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get specific device details including full locationHistory
router.get('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ success: true, device });
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
