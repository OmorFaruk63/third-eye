const LocationStop = require('../models/LocationStop');
const BreadcrumbPoint = require('../models/BreadcrumbPoint');
const GeofenceZone = require('../models/GeofenceZone');
const { resolveVillageOrPara } = require('./geoCoder');

// In-memory geofence states: deviceId -> Set of zoneIds device is currently inside
const deviceZonePresence = new Map();

// In-memory last breadcrumb per device to throttle points (minimum 10m or 15s)
const lastBreadcrumbCache = new Map();

/**
 * Calculates Haversine distance in meters between two lat/lon points
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Main Mobility Processing Pipeline:
 * 1. Process breadcrumb points for route polyline
 * 2. Stay-point detection: maintain stops, calculate stay durations (>3 mins within 300m)
 * 3. Geofence evaluation: detect zone enter/exit and broadcast instant alert
 */
async function processMobilityTelemetry({
  deviceId,
  deviceName = 'Device',
  latitude,
  longitude,
  speedKmh = 0,
  accuracy = 10,
  timestamp = new Date(),
  io = null,
}) {
  if (!deviceId || latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    return null;
  }

  const lat = Number(latitude);
  const lon = Number(longitude);
  const speed = Number(speedKmh) || 0;
  const acc = Number(accuracy) || 10;
  const pingTime = timestamp ? new Date(timestamp) : new Date();

  if (isNaN(lat) || isNaN(lon)) return null;

  // 1. Breadcrumb Point: Record coordinates for route polyline
  // Throttle: Save if moved > 15 meters or > 30 seconds since last breadcrumb
  const lastPoint = lastBreadcrumbCache.get(deviceId);
  let shouldSaveBreadcrumb = true;
  if (lastPoint) {
    const dist = getDistanceMeters(lastPoint.lat, lastPoint.lon, lat, lon);
    const timeDiffMs = pingTime.getTime() - lastPoint.time.getTime();
    if (dist < 15 && timeDiffMs < 30000) {
      shouldSaveBreadcrumb = false;
    }
  }

  let savedBreadcrumb = null;
  if (shouldSaveBreadcrumb) {
    try {
      savedBreadcrumb = await BreadcrumbPoint.create({
        deviceId,
        latitude: lat,
        longitude: lon,
        speedKmh: speed,
        accuracy: acc,
        timestamp: pingTime,
      });
      lastBreadcrumbCache.set(deviceId, { lat, lon, time: pingTime });
    } catch (e) {
      console.warn('Error saving breadcrumb point:', e.message);
    }
  }

  // 2. Stay-Point Detection Engine
  // Query active open stop for this device
  let activeStop = await LocationStop.findOne({
    deviceId,
    isCurrentlyHere: true,
  }).sort({ arrivalTime: -1 });

  let updatedStop = null;
  const STAY_RADIUS_METERS = 300; // Stationary radius threshold
  const MIN_STAY_MINUTES = 3; // 3+ minutes needed for confirmed stop

  if (activeStop) {
    const distFromStop = getDistanceMeters(activeStop.latitude, activeStop.longitude, lat, lon);

    if (distFromStop <= STAY_RADIUS_METERS) {
      // Device is still stationary in the same stay-point
      activeStop.departureTime = pingTime;
      const durationMs = pingTime.getTime() - new Date(activeStop.arrivalTime).getTime();
      activeStop.stayDurationMinutes = Math.max(0, Math.round(durationMs / 60000));
      activeStop.pingsCount = (activeStop.pingsCount || 1) + 1;
      activeStop.accuracy = Math.min(activeStop.accuracy || 999, acc);
      await activeStop.save();
      updatedStop = activeStop;
    } else {
      // Device moved > 300 meters away!
      // Finalize the previous stop
      activeStop.isCurrentlyHere = false;
      activeStop.departureTime = pingTime;
      const durationMs = pingTime.getTime() - new Date(activeStop.arrivalTime).getTime();
      const stayMins = Math.max(0, Math.round(durationMs / 60000));
      activeStop.stayDurationMinutes = stayMins;

      // If previous candidate stop was less than 3 minutes, remove it so table doesn't get spammed
      if (stayMins < MIN_STAY_MINUTES && activeStop.pingsCount <= 2) {
        await LocationStop.deleteOne({ _id: activeStop._id });
      } else {
        await activeStop.save();
      }

      // Start new candidate stop at new location
      const geo = await resolveVillageOrPara(lat, lon);
      const areaName = geo?.areaName || geo?.villageOrPara || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      const fullAddress = geo?.locationName || areaName;

      updatedStop = await LocationStop.create({
        deviceId,
        areaName,
        fullAddress,
        latitude: lat,
        longitude: lon,
        arrivalTime: pingTime,
        departureTime: pingTime,
        stayDurationMinutes: 0,
        accuracy: acc,
        pingsCount: 1,
        isCurrentlyHere: true,
      });
    }
  } else {
    // No active stop exists, create one
    const geo = await resolveVillageOrPara(lat, lon);
    const areaName = geo?.areaName || geo?.villageOrPara || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const fullAddress = geo?.locationName || areaName;

    updatedStop = await LocationStop.create({
      deviceId,
      areaName,
      fullAddress,
      latitude: lat,
      longitude: lon,
      arrivalTime: pingTime,
      departureTime: pingTime,
      stayDurationMinutes: 0,
      accuracy: acc,
      pingsCount: 1,
      isCurrentlyHere: true,
    });
  }

  // 3. Geofencing Evaluation Engine
  await evaluateGeofences({
    deviceId,
    deviceName,
    latitude: lat,
    longitude: lon,
    timestamp: pingTime,
    io,
  });

  return {
    breadcrumb: savedBreadcrumb,
    stop: updatedStop,
  };
}

/**
 * Evaluates all active Geofence Zones against device coordinates
 * Dispatches instant 'geofence-alert' WebSocket event with audio alert trigger
 */
async function evaluateGeofences({ deviceId, deviceName, latitude, longitude, timestamp, io }) {
  try {
    const zones = await GeofenceZone.find({ isActive: true });
    if (!zones || zones.length === 0) return;

    if (!deviceZonePresence.has(deviceId)) {
      deviceZonePresence.set(deviceId, new Set());
    }
    const currentZones = deviceZonePresence.get(deviceId);

    for (const zone of zones) {
      // Check if zone is applicable to this device
      if (zone.targetDevices && zone.targetDevices.length > 0 && !zone.targetDevices.includes(deviceId)) {
        continue;
      }

      const distMeters = getDistanceMeters(zone.centerLat, zone.centerLon, latitude, longitude);
      const isInside = distMeters <= zone.radiusMeters;
      const zoneIdStr = zone._id.toString();
      const wasInside = currentZones.has(zoneIdStr);

      if (!wasInside && isInside) {
        // Device ENTERED the zone!
        currentZones.add(zoneIdStr);
        if (zone.alertOnEnter) {
          const alertPayload = {
            eventType: 'ENTER',
            zoneId: zoneIdStr,
            zoneName: zone.name,
            deviceId,
            deviceName,
            latitude,
            longitude,
            distanceMeters: Math.round(distMeters),
            radiusMeters: zone.radiusMeters,
            timestamp: timestamp || new Date(),
            message: `⚠️ Alert: ${deviceName} (${deviceId}) entered safe zone "${zone.name}"!`,
          };
          console.log(`🚨 GEOFENCE ENTER ALERT: ${alertPayload.message}`);
          if (io) {
            io.emit('geofence-alert', alertPayload);
          }
        }
      } else if (wasInside && !isInside) {
        // Device EXITED the zone!
        currentZones.delete(zoneIdStr);
        if (zone.alertOnExit) {
          const alertPayload = {
            eventType: 'EXIT',
            zoneId: zoneIdStr,
            zoneName: zone.name,
            deviceId,
            deviceName,
            latitude,
            longitude,
            distanceMeters: Math.round(distMeters),
            radiusMeters: zone.radiusMeters,
            timestamp: timestamp || new Date(),
            message: `⚠️ Alert: ${deviceName} (${deviceId}) left safe zone "${zone.name}"!`,
          };
          console.log(`🚨 GEOFENCE EXIT ALERT: ${alertPayload.message}`);
          if (io) {
            io.emit('geofence-alert', alertPayload);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Geofence evaluation error:', err.message);
  }
}

/**
 * Batch Process Offline Cached Locations
 */
async function processOfflineLocationsBatch({ deviceId, locations = [], io = null }) {
  if (!deviceId || !Array.isArray(locations) || locations.length === 0) {
    return { count: 0 };
  }

  // Sort chronologically
  const sorted = [...locations].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let processedCount = 0;
  for (const loc of sorted) {
    await processMobilityTelemetry({
      deviceId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      speedKmh: loc.speedKmh || loc.speed || 0,
      accuracy: loc.accuracy || 10,
      timestamp: loc.timestamp ? new Date(loc.timestamp) : new Date(),
      io,
    });
    processedCount++;
  }

  return { count: processedCount };
}

module.exports = {
  getDistanceMeters,
  processMobilityTelemetry,
  evaluateGeofences,
  processOfflineLocationsBatch,
};
