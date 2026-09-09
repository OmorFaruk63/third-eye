const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const { resolveVillageOrPara } = require('../utils/geoCoder');

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
      villageOrPara,
      districtAndCountry,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const now = new Date();

    const updateFields = {
      deviceName: deviceName || 'Android Device',
      model: model || 'Unknown Model',
      androidVersion: androidVersion || '',
      batteryLevel: batteryLevel !== undefined ? batteryLevel : 100,
      isRecording: Boolean(isRecording),
      videoQuality: videoQuality || '720p',
      appVersion: appVersion || '1.0',
      lastSeen: now,
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
    if (villageOrPara) {
      updateFields.villageOrPara = villageOrPara;
    }
    if (districtAndCountry) {
      updateFields.districtAndCountry = districtAndCountry;
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

    if (updateFields.latitude && updateFields.longitude) {
      updateFields.locationUpdatedAt = now;
      // High-precision Village / Para resolution if not already set or if generic
      const isGeneric = !updateFields.villageOrPara ||
        ['dhaka', 'chittagong', 'chattogram', 'sylhet', 'rajshahi', 'khulna', 'barishal', 'rangpur'].includes(updateFields.villageOrPara.toLowerCase().trim());
      if (isGeneric) {
        try {
          const resolved = await resolveVillageOrPara(updateFields.latitude, updateFields.longitude);
          if (resolved && resolved.villageOrPara) {
            updateFields.villageOrPara = resolved.villageOrPara;
            if (resolved.districtAndCountry) updateFields.districtAndCountry = resolved.districtAndCountry;
            if (resolved.locationName) updateFields.locationName = resolved.locationName;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    const updateDoc = {
      $set: updateFields,
    };

    if (updateFields.latitude && updateFields.longitude) {
      updateDoc.$push = {
        locationHistory: {
          $each: [{
            latitude: updateFields.latitude,
            longitude: updateFields.longitude,
            locationName: updateFields.locationName || '',
            villageOrPara: updateFields.villageOrPara || '',
            districtAndCountry: updateFields.districtAndCountry || '',
            accuracy: req.body.accuracy || 10,
            source: req.body.source || 'GPS',
            timestamp: now,
          }],
          $slice: -100,
        }
      };
    }

    const device = await Device.findOneAndUpdate(
      { deviceId },
      updateDoc,
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
