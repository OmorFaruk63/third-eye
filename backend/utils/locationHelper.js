/**
 * Check if two location objects refer to the same physical location.
 * Compares village/para name, location name, cross-token inclusion, or geographical distance (< 300m).
 */
function isSameLocation(loc1, loc2) {
  if (!loc1 || !loc2) return false;

  // 1. Compare villageOrPara if present in both
  const v1 = (loc1.villageOrPara || '').trim().toLowerCase();
  const v2 = (loc2.villageOrPara || '').trim().toLowerCase();
  if (v1 && v2) {
    if (v1 === v2) return true;
    if (v1.includes(v2) || v2.includes(v1)) return true;
  }

  // 2. Compare locationName if present in both
  const n1 = (loc1.locationName || '').trim().toLowerCase();
  const n2 = (loc2.locationName || '').trim().toLowerCase();
  if (n1 && n2) {
    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }

  // 3. Cross-compare villageOrPara with locationName
  if (v1 && n2 && (n2.includes(v1) || v1.includes(n2))) return true;
  if (v2 && n1 && (n1.includes(v2) || v2.includes(n1))) return true;

  // 4. Distance check using Haversine formula (<= 0.30 km = 300 meters, accounts for cellular/GPS drift)
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

      if (distKm <= 0.30) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Consolidates consecutive identical location points in an array into single timeline entries with expanded durations.
 */
function consolidateHistoryArray(history) {
  if (!Array.isArray(history) || history.length === 0) return [];
  const merged = [];

  for (const entry of history) {
    if (merged.length === 0) {
      merged.push({
        latitude: entry.latitude,
        longitude: entry.longitude,
        locationName: entry.locationName || '',
        villageOrPara: entry.villageOrPara || '',
        districtAndCountry: entry.districtAndCountry || '',
        accuracy: entry.accuracy || 10,
        source: entry.source || 'GPS',
        startTime: entry.startTime || entry.timestamp || new Date(),
        endTime: entry.endTime || entry.timestamp || new Date(),
        timestamp: entry.timestamp || entry.startTime || new Date(),
      });
      continue;
    }

    const last = merged[merged.length - 1];
    if (isSameLocation(last, entry)) {
      const entryStart = new Date(entry.startTime || entry.timestamp || entry.endTime || Date.now());
      const entryEnd = new Date(entry.endTime || entry.timestamp || entry.startTime || Date.now());
      const lastStart = new Date(last.startTime);
      const lastEnd = new Date(last.endTime);

      if (entryStart < lastStart) last.startTime = entryStart;
      if (entryEnd > lastEnd) last.endTime = entryEnd;

      if (entry.villageOrPara && (!last.villageOrPara || entry.villageOrPara.length > last.villageOrPara.length)) {
        last.villageOrPara = entry.villageOrPara;
      }
      if (entry.locationName && (!last.locationName || entry.locationName.length > last.locationName.length)) {
        last.locationName = entry.locationName;
      }
      if (entry.districtAndCountry && !last.districtAndCountry) {
        last.districtAndCountry = entry.districtAndCountry;
      }
      last.latitude = entry.latitude;
      last.longitude = entry.longitude;
      if (entry.accuracy) last.accuracy = Math.min(last.accuracy || 999, entry.accuracy);
    } else {
      merged.push({
        latitude: entry.latitude,
        longitude: entry.longitude,
        locationName: entry.locationName || '',
        villageOrPara: entry.villageOrPara || '',
        districtAndCountry: entry.districtAndCountry || '',
        accuracy: entry.accuracy || 10,
        source: entry.source || 'GPS',
        startTime: entry.startTime || entry.timestamp || new Date(),
        endTime: entry.endTime || entry.timestamp || new Date(),
        timestamp: entry.timestamp || entry.startTime || new Date(),
      });
    }
  }

  return merged;
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

  // Check recent entries (up to last 3 entries to handle GPS bounce)
  let matchedEntry = null;
  for (let i = history.length - 1; i >= Math.max(0, history.length - 3); i--) {
    if (isSameLocation(history[i], newLocEntry)) {
      matchedEntry = history[i];
      break;
    }
  }

  if (matchedEntry) {
    // Same location: update endTime of matching entry
    matchedEntry.endTime = now;
    matchedEntry.latitude = lat;
    matchedEntry.longitude = lon;
    if (locData.locationName && (!matchedEntry.locationName || locData.locationName.length > matchedEntry.locationName.length)) {
      matchedEntry.locationName = locData.locationName;
    }
    if (locData.villageOrPara && (!matchedEntry.villageOrPara || locData.villageOrPara.length > matchedEntry.villageOrPara.length)) {
      matchedEntry.villageOrPara = locData.villageOrPara;
    }
    if (locData.districtAndCountry && !matchedEntry.districtAndCountry) {
      matchedEntry.districtAndCountry = locData.districtAndCountry;
    }
    if (!matchedEntry.startTime) {
      matchedEntry.startTime = matchedEntry.timestamp || now;
    }
    device.markModified('locationHistory');
    return { updatedEntry: matchedEntry, isNew: false };
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
  consolidateHistoryArray,
  processDeviceLocationUpdate,
};
