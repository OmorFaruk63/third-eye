const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const { resolveVillageOrPara } = require('../utils/geoCoder');
const { processDeviceLocationUpdate, consolidateHistoryArray } = require('../utils/locationHelper');

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
    if (req.body.fcmToken) device.fcmToken = req.body.fcmToken;

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

    // Broadcast live telemetry update to connected admin dashboards
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('device-heartbeat', {
        deviceId: device.deviceId,
        lastSeen: device.lastSeen,
        batteryLevel: device.batteryLevel,
        isRecording: device.isRecording,
        videoQuality: device.videoQuality,
        cameraLens: device.cameraLens,
        latitude: targetLat,
        longitude: targetLon,
        locationName: targetLocName,
        villageOrPara: targetVillage,
        districtAndCountry: targetDistrict,
      });
    }

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

    for (const d of devices) {
      if (Array.isArray(d.locationHistory) && d.locationHistory.length > 1) {
        const cleanHistory = consolidateHistoryArray(d.locationHistory);
        if (cleanHistory.length !== d.locationHistory.length) {
          d.locationHistory = cleanHistory;
          d.markModified('locationHistory');
          d.save().catch(() => {});
        }
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

    if (Array.isArray(device.locationHistory) && device.locationHistory.length > 1) {
      const cleanHistory = consolidateHistoryArray(device.locationHistory);
      if (cleanHistory.length !== device.locationHistory.length) {
        device.locationHistory = cleanHistory;
        device.markModified('locationHistory');
        await device.save().catch(() => {});
      }
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

// Device: Register or refresh FCM push token
router.post('/fcm-token', async (req, res) => {
  try {
    const { deviceId, fcmToken } = req.body;
    if (!deviceId || !fcmToken) {
      return res.status(400).json({ error: 'deviceId and fcmToken are required' });
    }
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { fcmToken, lastSeen: new Date() },
      { upsert: true, new: true }
    );
    console.log(`📱 FCM token registered for device: ${deviceId}`);
    res.json({ success: true, deviceId, fcmToken });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 📍 SMART MOBILITY & LOCATION HISTORY TRACKING ENGINE ENDPOINTS
// -------------------------------------------------------------
const LocationStop = require('../models/LocationStop');
const BreadcrumbPoint = require('../models/BreadcrumbPoint');
const GeofenceZone = require('../models/GeofenceZone');
const { processOfflineLocationsBatch } = require('../utils/mobilityEngine');

/**
 * GET /api/devices/:deviceId/mobility-route?date=YYYY-MM-DD
 * Returns breadcrumb points for polyline map & stay-point stops for a selected date
 */
router.get('/:deviceId/mobility-route', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { date } = req.query;

    let targetDate = new Date();
    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [breadcrumbs, stops] = await Promise.all([
      BreadcrumbPoint.find({
        deviceId,
        timestamp: { $gte: startOfDay, $lte: endOfDay },
      }).sort({ timestamp: 1 }).lean(),
      LocationStop.find({
        deviceId,
        $or: [
          { arrivalTime: { $gte: startOfDay, $lte: endOfDay } },
          { departureTime: { $gte: startOfDay, $lte: endOfDay } },
          { isCurrentlyHere: true },
        ],
      }).sort({ arrivalTime: 1 }).lean(),
    ]);

    res.json({
      success: true,
      deviceId,
      date: startOfDay.toISOString().split('T')[0],
      breadcrumbsCount: breadcrumbs.length,
      stopsCount: stops.length,
      breadcrumbs,
      stops,
    });
  } catch (error) {
    console.error('Error fetching mobility route:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/devices/:deviceId/stops
 * Returns all detected stay-point stops for a device
 */
router.get('/:deviceId/stops', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const stops = await LocationStop.find({ deviceId })
      .sort({ arrivalTime: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, count: stops.length, stops });
  } catch (error) {
    console.error('Error fetching device stops:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/devices/:deviceId/sync-offline-locations
 * Receives batch of cached GPS coordinates stored while phone was offline
 */
router.post('/:deviceId/sync-offline-locations', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { locations } = req.body;

    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ error: 'locations array is required' });
    }

    const io = req.app.get('io');
    const result = await processOfflineLocationsBatch({
      deviceId,
      locations,
      io,
    });

    console.log(`📥 Processed ${result.count} offline location pings for device: ${deviceId}`);
    res.json({ success: true, syncedCount: result.count });
  } catch (error) {
    console.error('Error syncing offline locations:', error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 🛡️ GEOFENCE MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

/**
 * GET /api/devices/geofences/all
 * List all configured geofence safe zones
 */
router.get('/geofences/all', async (req, res) => {
  try {
    const zones = await GeofenceZone.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, zones });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/devices/geofences/create
 * Create a new geofence zone
 */
router.post('/geofences/create', async (req, res) => {
  try {
    const { name, description, centerLat, centerLon, radiusMeters, alertOnEnter, alertOnExit, targetDevices } = req.body;

    if (!name || centerLat === undefined || centerLon === undefined) {
      return res.status(400).json({ error: 'name, centerLat, and centerLon are required' });
    }

    const zone = await GeofenceZone.create({
      name,
      description: description || '',
      centerLat: Number(centerLat),
      centerLon: Number(centerLon),
      radiusMeters: Number(radiusMeters) || 300,
      alertOnEnter: alertOnEnter !== undefined ? Boolean(alertOnEnter) : true,
      alertOnExit: alertOnExit !== undefined ? Boolean(alertOnExit) : true,
      targetDevices: Array.isArray(targetDevices) ? targetDevices : [],
      isActive: true,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('geofence-updated', { action: 'create', zone });
    }

    res.json({ success: true, zone });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/devices/geofences/:id
 * Delete a geofence zone
 */
router.delete('/geofences/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await GeofenceZone.findByIdAndDelete(id);

    const io = req.app.get('io');
    if (io) {
      io.emit('geofence-updated', { action: 'delete', id });
    }

    res.json({ success: true, message: 'Geofence removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

