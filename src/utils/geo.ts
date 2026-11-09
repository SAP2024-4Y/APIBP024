const EARTH_RADIUS_KM = 6371;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Haversine great-circle distance between two points in kilometres. */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Approximate bounding box for a lat/lon centre and radius (km). */
export function radiusToBbox(lat: number, lon: number, radiusKm: number) {
  const latDelta = radiusKm / EARTH_RADIUS_KM * (180 / Math.PI);
  const lonDelta = radiusKm / (EARTH_RADIUS_KM * Math.cos(toRad(lat))) * (180 / Math.PI);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}
