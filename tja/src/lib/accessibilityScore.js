// src/lib/accessibilityScore.js

const W = {
  densidad: 0.40,
  severidad: 0.35,
  pendiente: 0.15,
  rutasBloq: 0.10,
};

function norm(value, max) {
  return Math.min(100, (value / max) * 100);
}

export function accessibilityScore(m) {
  const penal =
    norm(m.densidadBarrerasKm2, 50) * W.densidad +
    norm(m.severidadPromedio, 5) * W.severidad +
    norm(m.pendienteMediaPct, 15) * W.pendiente +
    norm(m.pctRutasConBarreraSevera, 100) * W.rutasBloq;

  return Math.max(0, Math.round(100 - penal));
}

export function scoreColor(score) {
  if (score < 35) return "#D32F2F";
  if (score < 55) return "#F57C00";
  if (score < 70) return "#F9A825";
  return "#388E3C";
}

export function aggregateColonia(reports, areaKm2 = 2) {
  if (!reports.length) {
    return {
      densidadBarrerasKm2: 0,
      severidadPromedio: 0,
      pendienteMediaPct: 0,
      pctRutasConBarreraSevera: 0,
    };
  }

  const sev = reports.map((r) => r.severidad || 0);
  const severas = reports.filter((r) => (r.severidad || 0) >= 4).length;

  return {
    densidadBarrerasKm2: reports.length / areaKm2,
    severidadPromedio: sev.reduce((a, b) => a + b, 0) / sev.length,
    pendienteMediaPct:
      reports.reduce((a, r) => a + (r.pendientePct || 0), 0) / reports.length,
    pctRutasConBarreraSevera: (severas / reports.length) * 100,
  };
}

// Datos semilla para demo.
// Valores estimados con base en ubicación urbana, percepción pública,
// conectividad, pendiente y nivel de riesgo de la zona.
export const COLONIAS_TIJUANA = [
  {
    nombre: "Chapultepec",
    lat: 32.506,
    lng: -117.01,
    densidadBarrerasKm2: 5,
    severidadPromedio: 1.2,
    pendienteMediaPct: 3,
    pctRutasConBarreraSevera: 8,
  },
  {
    nombre: "Colonia Madero (La Cacho)",
    lat: 32.523,
    lng: -117.028,
    densidadBarrerasKm2: 6,
    severidadPromedio: 1.3,
    pendienteMediaPct: 3,
    pctRutasConBarreraSevera: 10,
  },
  {
    nombre: "Cumbres de Juárez",
    lat: 32.514,
    lng: -117.047,
    densidadBarrerasKm2: 7,
    severidadPromedio: 1.4,
    pendienteMediaPct: 4,
    pctRutasConBarreraSevera: 12,
  },
  {
    nombre: "Agua Caliente",
    lat: 32.512,
    lng: -117.005,
    densidadBarrerasKm2: 8,
    severidadPromedio: 1.5,
    pendienteMediaPct: 4,
    pctRutasConBarreraSevera: 13,
  },
  {
    nombre: "Burócrata Hipódromo",
    lat: 32.514,
    lng: -117.002,
    densidadBarrerasKm2: 9,
    severidadPromedio: 1.6,
    pendienteMediaPct: 4,
    pctRutasConBarreraSevera: 15,
  },
  {
    nombre: "Zona Río",
    lat: 32.523,
    lng: -117.01,
    densidadBarrerasKm2: 10,
    severidadPromedio: 1.7,
    pendienteMediaPct: 2,
    pctRutasConBarreraSevera: 16,
  },
  {
    nombre: "Playas de Tijuana",
    lat: 32.531,
    lng: -117.123,
    densidadBarrerasKm2: 12,
    severidadPromedio: 1.8,
    pendienteMediaPct: 5,
    pctRutasConBarreraSevera: 18,
  },
  {
    nombre: "Zona Otay",
    lat: 32.528,
    lng: -116.965,
    densidadBarrerasKm2: 13,
    severidadPromedio: 1.9,
    pendienteMediaPct: 4,
    pctRutasConBarreraSevera: 20,
  },
  {
    nombre: "Gabilondo",
    lat: 32.521,
    lng: -117.03,
    densidadBarrerasKm2: 14,
    severidadPromedio: 2,
    pendienteMediaPct: 4,
    pctRutasConBarreraSevera: 22,
  },
  {
    nombre: "Colonia Neidhart",
    lat: 32.525,
    lng: -117.02,
    densidadBarrerasKm2: 15,
    severidadPromedio: 2.1,
    pendienteMediaPct: 4,
    pctRutasConBarreraSevera: 24,
  },

  {
    nombre: "Zona Centro",
    lat: 32.535,
    lng: -117.038,
    densidadBarrerasKm2: 36,
    severidadPromedio: 3.9,
    pendienteMediaPct: 6,
    pctRutasConBarreraSevera: 68,
  },
  {
    nombre: "Zona Urbana Río Tijuana",
    lat: 32.522,
    lng: -117.014,
    densidadBarrerasKm2: 25,
    severidadPromedio: 3,
    pendienteMediaPct: 3,
    pctRutasConBarreraSevera: 45,
  },
  {
    nombre: "Mariano Matamoros Centro",
    lat: 32.478,
    lng: -116.879,
    densidadBarrerasKm2: 30,
    severidadPromedio: 3.4,
    pendienteMediaPct: 8,
    pctRutasConBarreraSevera: 55,
  },
  {
    nombre: "Camino Verde",
    lat: 32.49,
    lng: -117.043,
    densidadBarrerasKm2: 42,
    severidadPromedio: 4.3,
    pendienteMediaPct: 12,
    pctRutasConBarreraSevera: 78,
  },
  {
    nombre: "Zona Norte",
    lat: 32.538,
    lng: -117.045,
    densidadBarrerasKm2: 40,
    severidadPromedio: 4.1,
    pendienteMediaPct: 6,
    pctRutasConBarreraSevera: 74,
  },
  {
    nombre: "Libertad",
    lat: 32.539,
    lng: -117.018,
    densidadBarrerasKm2: 24,
    severidadPromedio: 3,
    pendienteMediaPct: 7,
    pctRutasConBarreraSevera: 44,
  },
  {
    nombre: "El Florido II Sección",
    lat: 32.46,
    lng: -116.84,
    densidadBarrerasKm2: 32,
    severidadPromedio: 3.5,
    pendienteMediaPct: 7,
    pctRutasConBarreraSevera: 58,
  },
  {
    nombre: "Fraccionamiento Las Delicias",
    lat: 32.424,
    lng: -116.875,
    densidadBarrerasKm2: 34,
    severidadPromedio: 3.6,
    pendienteMediaPct: 8,
    pctRutasConBarreraSevera: 60,
  },
  {
    nombre: "El Pípila",
    lat: 32.486,
    lng: -116.89,
    densidadBarrerasKm2: 37,
    severidadPromedio: 3.9,
    pendienteMediaPct: 9,
    pctRutasConBarreraSevera: 70,
  },
  {
    nombre: "Nueva Tijuana",
    lat: 32.54,
    lng: -116.935,
    densidadBarrerasKm2: 25,
    severidadPromedio: 3.1,
    pendienteMediaPct: 5,
    pctRutasConBarreraSevera: 46,
  },
  {
    nombre: "Empleados Federales",
    lat: 32.526,
    lng: -117.036,
    densidadBarrerasKm2: 26,
    severidadPromedio: 3.2,
    pendienteMediaPct: 5,
    pctRutasConBarreraSevera: 48,
  },
  {
    nombre: "Mariano Matamoros Norte",
    lat: 32.493,
    lng: -116.88,
    densidadBarrerasKm2: 36,
    severidadPromedio: 3.8,
    pendienteMediaPct: 8,
    pctRutasConBarreraSevera: 66,
  },
  {
    nombre: "Urbivilla del Prado II",
    lat: 32.432,
    lng: -116.856,
    densidadBarrerasKm2: 38,
    severidadPromedio: 4,
    pendienteMediaPct: 8,
    pctRutasConBarreraSevera: 70,
  },
  {
    nombre: "Villa del Campo Residencial",
    lat: 32.409,
    lng: -116.804,
    densidadBarrerasKm2: 34,
    severidadPromedio: 3.7,
    pendienteMediaPct: 7,
    pctRutasConBarreraSevera: 62,
  },
  {
    nombre: "Terrazas del Valle",
    lat: 32.433,
    lng: -116.827,
    densidadBarrerasKm2: 39,
    severidadPromedio: 4,
    pendienteMediaPct: 9,
    pctRutasConBarreraSevera: 72,
  },
];

export const COLONIAS_CON_SCORE = COLONIAS_TIJUANA.map((c) => ({
  ...c,
  score: accessibilityScore(c),
  color: scoreColor(accessibilityScore(c)),
}));