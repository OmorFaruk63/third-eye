const clientGeoCache = new Map();
const pendingLookups = new Set();

const genericWords = [
  "dhaka",
  "chittagong",
  "chattogram",
  "sylhet",
  "rajshahi",
  "khulna",
  "barishal",
  "rangpur",
  "mymensingh",
  "cumilla",
  "comilla",
  "district",
  "জেলা",
  "division",
  "বিভাগ",
  "city",
  "মহানগর",
  "bangladesh",
  "বাংলাদেশ",
  "country",
  "দেশ",
];

/**
 * Checks if a string is purely a generic city/district/country name
 */
function isGenericLocation(text) {
  if (!text) return true;
  const clean = text.toLowerCase().trim();
  if (genericWords.includes(clean)) return true;
  const parts = clean.split(/[\s,]+/).filter(Boolean);
  return parts.length > 0 && parts.every((p) => genericWords.includes(p));
}

/**
 * Extracts strictly the deepest, innermost micro-location name
 * (e.g. Bibir Bagicha)
 */
export function getVillageOrPara(device, onResolved) {
  if (!device) return "GPS Standby";

  const lat = Number(device.latitude);
  const lon = Number(device.longitude);
  const hasCoords = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;

  // 1. Check if client has a cached reverse lookup for these coordinates
  if (hasCoords) {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (clientGeoCache.has(key)) {
      const cached = clientGeoCache.get(key);
      if (cached && cached.villageOrPara) {
        return cached.villageOrPara;
      }
    } else if (onResolved && !pendingLookups.has(key)) {
      pendingLookups.add(key);
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=bn,en`,
        {
          headers: { "User-Agent": "ThirdEyeAdmin/1.0" },
        },
      )
        .then((r) => r.json())
        .then((data) => {
          if (data && data.address) {
            const addr = data.address;

            // Ordered strictly from deepest/innermost micro-leaf to broader area
            const building = (
              addr.building ||
              addr.house_name ||
              addr.amenity ||
              addr.shop ||
              addr.place_of_worship ||
              ""
            ).trim();
            const road = (
              addr.road ||
              addr.street ||
              addr.lane ||
              addr.pedestrian ||
              addr.footway ||
              ""
            ).trim();
            const quarter = (
              addr.quarter ||
              addr.neighbourhood ||
              addr.hamlet ||
              ""
            ).trim();
            const residential = (
              addr.residential ||
              addr.subdivision ||
              ""
            ).trim();
            const village = (addr.village || "").trim();
            const suburb = (
              addr.suburb ||
              addr.borough ||
              addr.town ||
              ""
            ).trim();

            const microTokens = [];
            if (
              building &&
              !microTokens.some((t) =>
                t.toLowerCase().includes(building.toLowerCase()),
              )
            ) {
              microTokens.push(building);
            }
            if (
              road &&
              !microTokens.some((t) =>
                t.toLowerCase().includes(road.toLowerCase()),
              )
            ) {
              microTokens.push(road);
            }
            if (
              quarter &&
              !microTokens.some((t) =>
                t.toLowerCase().includes(quarter.toLowerCase()),
              )
            ) {
              microTokens.push(quarter);
            }
            if (
              residential &&
              !microTokens.some((t) =>
                t.toLowerCase().includes(residential.toLowerCase()),
              )
            ) {
              microTokens.push(residential);
            }
            if (
              village &&
              !microTokens.some((t) =>
                t.toLowerCase().includes(village.toLowerCase()),
              )
            ) {
              microTokens.push(village);
            }
            if (microTokens.length === 0 && suburb) {
              microTokens.push(suburb);
            }

            const resolvedVillage =
              microTokens.slice(0, 2).join(", ") ||
              addr.city_district ||
              addr.subdistrict ||
              "Pinpoint GPS";

            const broaderParts = [];
            if (suburb && !resolvedVillage.includes(suburb)) {
              broaderParts.push(suburb);
            }
            const district =
              addr.state_district || addr.county || addr.city || "";
            if (district) {
              broaderParts.push(district);
            }
            const country = addr.country || "";
            if (country) {
              broaderParts.push(country);
            }

            const resolvedDistrict = broaderParts.filter(Boolean).join(", ");

            const result = {
              villageOrPara: resolvedVillage.trim(),
              districtAndCountry: resolvedDistrict.trim(),
              locationName: data.display_name || "",
            };
            clientGeoCache.set(key, result);
            onResolved(device.deviceId, result);
          }
        })
        .catch(() => {})
        .finally(() => pendingLookups.delete(key));
    }
  }

  // 2. If device already has a valid, non-generic villageOrPara
  if (
    device.villageOrPara &&
    device.villageOrPara.trim() &&
    !isGenericLocation(device.villageOrPara)
  ) {
    return device.villageOrPara.trim();
  }

  // 3. Try to extract deepest innermost tokens from full locationName
  if (device.locationName && device.locationName.trim()) {
    const parts = device.locationName
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !isGenericLocation(s) && !s.match(/^[0-9\-\s]+$/));

    if (parts.length > 0) {
      return parts.slice(0, 2).join(", ");
    }
  }

  // 4. Pinpoint GPS coordinates
  if (hasCoords) {
    return `GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }

  return "GPS Standby";
}

/**
 * Determines whether location telemetry is actively live in real-time.
 * Device must be online and location must have updated within the last 75 seconds.
 */
export function isLocationLive(device, isOnline) {
  if (!isOnline || !device) return false;
  const dateVal = device.locationUpdatedAt || device.lastSeen;
  if (!dateVal) return false;
  const diffSecs = Math.floor(
    (Date.now() - new Date(dateVal).getTime()) / 1000,
  );
  return diffSecs >= 0 && diffSecs <= 75;
}

/**
 * Calculates human-readable elapsed time since location was last updated.
 * E.g., 'Just now', '2m ago', '15m ago', '1h 20m ago', '4h ago', '2d ago'.
 */
export function formatLocationAge(locationUpdatedAt, lastSeen) {
  const dateVal = locationUpdatedAt || lastSeen;
  if (!dateVal) return "Unknown";

  const diffSecs = Math.floor(
    (Date.now() - new Date(dateVal).getTime()) / 1000,
  );
  if (diffSecs < 0 || diffSecs < 30) return "Just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;

  const mins = Math.floor(diffSecs / 60);
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    return remMins > 0 ? `${hours}h ${remMins}m ago` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Secondary subtitle text (Thana / Suburb, District, Country, or Lat/Lon)
 */
export function getLocationSecondary(device) {
  if (!device) return "";
  if (device.districtAndCountry && device.districtAndCountry.trim()) {
    return device.districtAndCountry.trim();
  }
  if (device.latitude && device.longitude) {
    return `${Number(device.latitude).toFixed(4)}, ${Number(device.longitude).toFixed(4)}`;
  }
  return "";
}
