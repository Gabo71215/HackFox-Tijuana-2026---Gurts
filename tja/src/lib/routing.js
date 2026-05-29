// src/lib/routing.js
// Ruteo accesible: Google Routes API + Elevation API + ranking por barreras y pendiente.
// Lo que los amigos importan: computeRoutes, rankAccessibleRoutes, elevationProfile, maxSlopePct.

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Pesos del ranking por perfil — ajustables
const PROFILE_WEIGHTS = {
  silla_manual:    { severas: 6.0, slope: 4.0, dist: 0.001 },
  silla_electrica: { severas: 4.0, slope: 2.0, dist: 0.0008 },
  muletas:         { severas: 5.0, slope: 3.0, dist: 0.001 },
  baja_vision:     { severas: 5.0, slope: 1.0, dist: 0.0006 },
};

// Distancia Haversine en metros
export function distH(a, b) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Decode polyline encoded — fallback si no usamos geoJsonLinestring
export function decodePoly(encoded) {
  if (!encoded) return [];
  const points = []; let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Extrae path [{lat,lng}] de una route de Routes API
export function extractPath(route) {
  const coords = route?.polyline?.geoJsonLinestring?.coordinates;
  if (coords?.length) return coords.map(([lng, lat]) => ({ lat, lng }));
  // fallback a encoded
  return decodePoly(route?.polyline?.encodedPolyline);
}

// Llamar Routes API y devolver array de routes
export async function computeRoutes(origin, destination, travelMode = "WALK") {
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": MAPS_KEY,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode,
      computeAlternativeRoutes: true,
      polylineEncoding: "GEO_JSON_LINESTRING",
    }),
  });
  if (!res.ok) throw new Error(`Routes API ${res.status}`);
  const data = await res.json();
  return data.routes || [];
}

// Llamada a Google Elevation API — sample de puntos a lo largo de la ruta
// Returns array of {elevation, location:{lat,lng}}
export async function elevationProfile(points) {
  if (!window.google?.maps?.ElevationService) return [];
  const svc = new window.google.maps.ElevationService();
  return new Promise((resolve) => {
    svc.getElevationAlongPath(
      { path: points.map(p => new window.google.maps.LatLng(p.lat, p.lng)), samples: Math.min(64, Math.max(8, points.length)) },
      (results, status) => {
        if (status === "OK" && results) resolve(results.map(r => ({
          elevation: r.elevation,
          location: { lat: r.location.lat(), lng: r.location.lng() }
        })));
        else resolve([]);
      }
    );
  });
}

// Calcular pendiente máxima entre samples consecutivos (en %)
export function maxSlopePct(elevSamples, totalDistMeters) {
  if (!elevSamples?.length || elevSamples.length < 2) return 0;
  const segDist = totalDistMeters / (elevSamples.length - 1);
  let maxPct = 0;
  for (let i = 1; i < elevSamples.length; i++) {
    const dh = Math.abs(elevSamples[i].elevation - elevSamples[i-1].elevation);
    const pct = segDist > 0 ? (dh / segDist) * 100 : 0;
    if (pct > maxPct) maxPct = pct;
  }
  return Math.round(maxPct * 10) / 10;
}

// Cuenta barreras severas (sev >= minSev) cerca de la ruta (<thresholdM)
export function countNearbyBarriers(route, reports, minSev = 4, thresholdM = 30) {
  const path = extractPath(route);
  if (!path.length) return 0;
  return reports.filter(r =>
    (r.severidad || 0) >= minSev &&
    r.lat && r.lng &&
    path.some(p => distH(p, r) < thresholdM)
  ).length;
}

// Rankea rutas por (severasEnRuta, slope, distancia), según perfil
export function rankAccessibleRoutes(routes, barriers, profile = "silla_manual", slopeMap = {}) {
  const w = PROFILE_WEIGHTS[profile] || PROFILE_WEIGHTS.silla_manual;
  return routes
    .map((r, idx) => {
      const severas = countNearbyBarriers(r, barriers, 4, 30);
      const slope = slopeMap[idx] || 0;
      const dist = r.distanceMeters || 0;
      const dur = parseInt(r.duration || "0", 10);
      const cost = w.severas * severas + w.slope * slope + w.dist * dist;
      return { route: r, idx, severasEnRuta: severas, slopePct: slope, distanceMeters: dist, durationSec: dur, cost };
    })
    .sort((a, b) => a.cost - b.cost);
}
