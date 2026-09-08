const geoCache = new Map();

/**
 * Reverse geocode latitude/longitude to extract the deepest, innermost micro-location name
 * (e.g. Bibir Bagicha / আনন্দ নগর / Road / Para / Village)
 */
async function resolveVillageOrPara(latitude, longitude) {
  if (!latitude || !longitude) return null;
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (isNaN(lat) || isNaN(lon)) return null;

  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (geoCache.has(key)) {
    return geoCache.get(key);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=bn,en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ThirdEyeAdmin/1.0 (admin@thirdeye.local)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.address) return null;

    const addr = data.address;

    // Ordered strictly from deepest/innermost micro-leaf to broader area
    const building = (addr.building || addr.house_name || addr.amenity || addr.shop || addr.place_of_worship || '').trim();
    const road = (addr.road || addr.street || addr.lane || addr.pedestrian || addr.footway || '').trim();
    const quarter = (addr.quarter || addr.neighbourhood || addr.hamlet || '').trim();
    const residential = (addr.residential || addr.subdivision || '').trim();
    const village = (addr.village || '').trim();
    const suburb = (addr.suburb || addr.borough || addr.town || '').trim();

    // Collect distinct micro-level tokens in inside-out order
    const microTokens = [];
    if (building && !microTokens.some(t => t.toLowerCase().includes(building.toLowerCase()))) {
      microTokens.push(building);
    }
    if (road && !microTokens.some(t => t.toLowerCase().includes(road.toLowerCase()))) {
      microTokens.push(road);
    }
    if (quarter && !microTokens.some(t => t.toLowerCase().includes(quarter.toLowerCase()))) {
      microTokens.push(quarter);
    }
    if (residential && !microTokens.some(t => t.toLowerCase().includes(residential.toLowerCase()))) {
      microTokens.push(residential);
    }
    if (village && !microTokens.some(t => t.toLowerCase().includes(village.toLowerCase()))) {
      microTokens.push(village);
    }

    // If still no micro-tokens, fall back to suburb/town
    if (microTokens.length === 0 && suburb) {
      microTokens.push(suburb);
    }

    // Take up to 2 most granular leaf tokens (e.g. "Road No. 1, আনন্দ নগর" or "Bibir Bagicha No Road, উত্তর যাত্রাবাড়ী")
    const villageOrPara = microTokens.slice(0, 2).join(', ') || addr.city_district || addr.subdistrict || 'Pinpoint GPS';

    // Secondary line: Suburb / Thana + District (e.g., "বাড্ডা, ঢাকা জেলা" or "যাত্রাবাড়ী, ঢাকা জেলা")
    const broaderParts = [];
    if (suburb && !villageOrPara.includes(suburb)) {
      broaderParts.push(suburb);
    }
    const district = addr.state_district || addr.county || addr.city || '';
    if (district) {
      broaderParts.push(district);
    }
    const country = addr.country || '';
    if (country) {
      broaderParts.push(country);
    }

    const districtAndCountry = broaderParts.filter(Boolean).join(', ');
    const fullAddress = data.display_name || '';

    const result = {
      villageOrPara: villageOrPara.trim(),
      districtAndCountry: districtAndCountry.trim(),
      locationName: fullAddress,
    };

    geoCache.set(key, result);
    return result;
  } catch (err) {
    console.warn('Geo reverse error:', err.message);
    return null;
  }
}

module.exports = { resolveVillageOrPara };
