/**
 * Consolidates consecutive duplicate location points in an array into clean timeline entries
 * with combined stay durations, newest location first.
 */
export function consolidateLocationHistory(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // Sort chronologically (oldest first) so consecutive stays can be merged seamlessly
  const sorted = [...raw].sort((a, b) => {
    const tA = new Date(a.startTime || a.timestamp || a.endTime || 0).getTime();
    const tB = new Date(b.startTime || b.timestamp || b.endTime || 0).getTime();
    return tA - tB;
  });

  const isMatch = (loc1, loc2) => {
    if (!loc1 || !loc2) return false;
    const v1 = (loc1.villageOrPara || '').trim().toLowerCase();
    const v2 = (loc2.villageOrPara || '').trim().toLowerCase();
    if (v1 && v2 && (v1 === v2 || v1.includes(v2) || v2.includes(v1))) return true;

    const n1 = (loc1.locationName || '').trim().toLowerCase();
    const n2 = (loc2.locationName || '').trim().toLowerCase();
    if (n1 && n2 && (n1 === n2 || n1.includes(n2) || n2.includes(n1))) return true;

    if (v1 && n2 && (n2.includes(v1) || v1.includes(n2))) return true;
    if (v2 && n1 && (n1.includes(v2) || v2.includes(n1))) return true;

    if (loc1.latitude && loc1.longitude && loc2.latitude && loc2.longitude) {
      const lat1 = Number(loc1.latitude);
      const lon1 = Number(loc1.longitude);
      const lat2 = Number(loc2.latitude);
      const lon2 = Number(loc2.longitude);
      if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c) <= 0.30; // 300 meters threshold
      }
    }
    return false;
  };

  const merged = [];
  for (const entry of sorted) {
    if (merged.length === 0) {
      merged.push({
        ...entry,
        pingsCount: 1,
        startTime: entry.startTime || entry.timestamp || new Date(),
        endTime: entry.endTime || entry.timestamp || new Date(),
      });
      continue;
    }

    const last = merged[merged.length - 1];
    if (isMatch(last, entry)) {
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
      last.pingsCount = (last.pingsCount || 1) + 1;
    } else {
      merged.push({
        ...entry,
        pingsCount: 1,
        startTime: entry.startTime || entry.timestamp || new Date(),
        endTime: entry.endTime || entry.timestamp || new Date(),
      });
    }
  }

  // Return newest location first (reverse chronological order for the table)
  return merged.reverse();
}
