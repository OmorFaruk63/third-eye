/**
 * Check if two location objects refer to the same physical location.
 * Compares village/para name, location name, or geographical distance (< 150m).
 */
function isSameLocation(loc1, loc2) {
  if (!loc1 || !loc2) return false;

  // 1. Compare villageOrPara if present in both
  const v1 = (loc1.villageOrPara || '').trim().toLowerCase();
  const v2 = (loc2.villageOrPara || '').trim().toLowerCase();
  if (v1 && v2 && v1 === v2) return true;

  // 2. Compare locationName if present in both
  const n1 = (loc1.locationName || '').trim().toLowerCase();
  const n2 = (loc2.locationName || '').trim().toLowerCase();
  if (n1 && n2 && n1 === n2) return true;

  // 3. Distance check using Haversine formula (<= 0.15 km = 150 meters)
  if (loc1.latitude !== undefined && loc1.longitude !== undefined && loc2.latitude !== undefined && loc2.longitude !== undefined) {
    const lat1 = Number(loc1.latitude);
    const lon1 = Number(loc1.longitude);
    const lat2 = Number(loc2.latitude);
    const lon2 = Number(loc2.longitude);

    if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = R * c;

      if (distKm <= 0.15) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Process location update for a Device document.
 * Consolidates continuous heartbeats at the same location by updating endTime.
 */
function processDeviceLocationUpdate(device, locData, now = new Date()) {
  if (!locData || locData.latitude === undefined || locData.longitude === undefined || locData.latitude === null || locData.longitude === null) {
    return { updatedEntry: null, isNew: false };
  }

  const lat = Number(locData.latitude);
  const lon = Number(locData.longitude);

  device.latitude = lat;
  device.longitude = lon;
  device.locationUpdatedAt = now;
  if (locData.locationName) device.locationName = locData.locationName;
  if (locData.villageOrPara) device.villageOrPara = locData.villageOrPara;
  if (locData.districtAndCountry) device.districtAndCountry = locData.districtAndCountry;

  const newLocEntry = {
    latitude: lat,
    longitude: lon,
    locationName: locData.locationName || '',
    villageOrPara: locData.villageOrPara || '',
    districtAndCountry: locData.districtAndCountry || '',
    accuracy: locData.accuracy || 10,
    source: locData.source || 'GPS',
    startTime: now,
    endTime: now,
    timestamp: now,
  };

  if (!Array.isArray(device.locationHistory)) {
    device.locationHistory = [];
  }

  const history = device.locationHistory;
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;

  if (lastEntry && isSameLocation(lastEntry, newLocEntry)) {
    // Same location: update endTime of current entry
    lastEntry.endTime = now;
    lastEntry.latitude = lat;
    lastEntry.longitude = lon;
    if (locData.locationName) lastEntry.locationName = locData.locationName;
    if (locData.villageOrPara) lastEntry.villageOrPara = locData.villageOrPara;
    if (locData.districtAndCountry) lastEntry.districtAndCountry = locData.districtAndCountry;
    if (!lastEntry.startTime) {
      lastEntry.startTime = lastEntry.timestamp || now;
    }
    device.markModified('locationHistory');
    return { updatedEntry: lastEntry, isNew: false };
  } else {
    // New location: push new entry
    history.push(newLocEntry);
    if (history.length > 100) {
      device.locationHistory = history.slice(-100);
    }
    device.markModified('locationHistory');
    return { updatedEntry: newLocEntry, isNew: true };
  }
}

module.exports = {
  isSameLocation,
  processDeviceLocationUpdate,
};
