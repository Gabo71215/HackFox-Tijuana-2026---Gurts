// src/lib/routing.js
// Ruteo multimodal + scoring de accesibilidad de rutas. DETERMINISTA.
// Usa Routes API (a pie/transporte/auto) y Elevation API (pendientes).
// La decisión de "ruta accesible" la toma esta lógica, NO Gemini.

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const ELEVATION_URL = "https://maps.googleapis.com/maps/api/elevation/json";
const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Pesos de penalización por perfil de movilidad. Mayor = la barrera duele más.
const PERFIL_PESOS = {
  silla_manual:    { barreraSevera: 100, pendiente: 8, sinRampa: 60 },
  silla_electrica: { barreraSevera: 80,  pendiente: 4, sinRampa: 50 },
  muletas:         { barreraSevera: 60,  pendiente: 6, sinRampa: 20 },
  baja_vision:     { barreraSevera: 70,  pendiente: 1, sinRampa: 10 },
};

// 1) Pide rutas alternativas a Google (a pie por default).
export async function computeRoutes(origin, destination, travelMode = "WALK") {
  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode, // "WALK" | "TRANSIT" | "DRIVE"
    computeAlternativeRoutes: true,
    polylineEncoding: "GEO_JSON_LINESTRING",
  };
  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      // pedir solo los campos que usamos = más barato
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline,routes.legs",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Routes API: " + res.status);
  const data = await res.json();
  return data.routes || [];
}

// 2) Pendiente de una serie de puntos (Elevation API).
export async function elevationProfile(points) {
  const locations = points.map((p) => `${p.lat},${p.lng}`).join("|");
  const res = await fetch(`${ELEVATION_URL}?locations=${locations}&key=${KEY}`);
  const data = await res.json();
  return (data.results || []).map((r) => r.elevation);
}

// Calcula pendiente máxima (%) a partir de un perfil de elevación y distancia.
export function maxSlopePct(elevations, distanceMeters) {
  if (elevations.length < 2 || !distanceMeters) return 0;
  const seg = distanceMeters / (elevations.length - 1);
  let max = 0;
  for (let i = 1; i < elevations.length; i++) {
    const slope = Math.abs(elevations[i] - elevations[i - 1]) / seg * 100;
    if (slope > max) max = slope;
  }
  return Math.round(max * 10) / 10;
}

// 3) Penaliza cada ruta según barreras que cruza, pendiente y perfil del usuario.
//    barriers = lista de {lat, lng, severidad, sinRampa} desde Firestore.
//    Devuelve las rutas ordenadas de la más accesible a la menos.
export function rankAccessibleRoutes(routes, barriers, profile, slopesByRoute) {
  const pesos = PERFIL_PESOS[profile] || PERFIL_PESOS.silla_manual;
  const scored = routes.map((route, idx) => {
    const coords = route.polyline?.geoJsonLinestring?.coordinates || [];
    let penal = 0, severasEnRuta = 0;
    for (const b of barriers) {
      if (nearAnySegment(b, coords, 25)) { // 25 m de tolerancia
        if ((b.severidad || 0) >= 4) { penal += pesos.barreraSevera; severasEnRuta++; }
        else penal += pesos.barreraSevera * 0.3;
        if (b.sinRampa) penal += pesos.sinRampa;
      }
    }
    const slope = slopesByRoute?.[idx] || 0;
    penal += slope * pesos.pendiente;
    return {
      route,
      durationSec: parseInt(route.duration) || 0,
      distanceMeters: route.distanceMeters || 0,
      slopePct: slope,
      severasEnRuta,
      penal,
    };
  });
  return scored.sort((a, b) => a.penal - b.penal); // menor penalización primero
}

// distancia aprox punto-a-polilínea (metros), versión simple para hackathon.
function nearAnySegment(point, coords, tolMeters) {
  for (const [lng, lat] of coords) {
    if (haversine(point.lat, point.lng, lat, lng) <= tolMeters) return true;
  }
  return false;
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
