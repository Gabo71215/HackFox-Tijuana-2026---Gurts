// src/lib/accessibilityScore.js
// CAPA DETERMINISTA. El Accessibility Score NO lo calcula IA: es una fórmula
// auditable. Esto es clave para uso institucional — el gobierno puede verificar
// el número. Steff es responsable de calibrar los pesos.

// Pesos de la fórmula (suman 1.0). Ajustables con el equipo / con datos reales.
const W = {
  densidad: 0.40,   // barreras por km2
  severidad: 0.35,  // severidad promedio (1-5)
  pendiente: 0.15,  // pendiente media (%)
  rutasBloq: 0.10,  // % de rutas con barrera severa
};

// Normaliza cada componente a 0-100 (peor = aporta más penalización).
function norm(value, max) {
  return Math.min(100, (value / max) * 100);
}

/**
 * Calcula el Accessibility Score (0-100, mayor = mejor) de una colonia.
 * @param {object} m métricas de la colonia
 *   m.densidadBarrerasKm2  number
 *   m.severidadPromedio    number (1-5)
 *   m.pendienteMediaPct    number (%)
 *   m.pctRutasConBarreraSevera number (0-100)
 */
export function accessibilityScore(m) {
  const penal =
    norm(m.densidadBarrerasKm2, 50) * W.densidad +    // 50 barreras/km2 = saturado
    norm(m.severidadPromedio, 5) * W.severidad +
    norm(m.pendienteMediaPct, 15) * W.pendiente +     // 15% pendiente = severo
    norm(m.pctRutasConBarreraSevera, 100) * W.rutasBloq;
  return Math.max(0, Math.round(100 - penal));
}

// Color para el mapa según el score.
export function scoreColor(score) {
  if (score < 35) return "#D32F2F"; // crítico
  if (score < 55) return "#F57C00"; // medio
  if (score < 70) return "#F9A825"; // bajo
  return "#388E3C";                  // bueno
}

// Agrega los reportes de una colonia en las métricas que necesita la fórmula.
export function aggregateColonia(reports, areaKm2 = 2) {
  if (!reports.length) return { densidadBarrerasKm2: 0, severidadPromedio: 0, pendienteMediaPct: 0, pctRutasConBarreraSevera: 0 };
  const sev = reports.map((r) => r.severidad || 0);
  const severas = reports.filter((r) => (r.severidad || 0) >= 4).length;
  return {
    densidadBarrerasKm2: reports.length / areaKm2,
    severidadPromedio: sev.reduce((a, b) => a + b, 0) / sev.length,
    pendienteMediaPct: reports.reduce((a, r) => a + (r.pendientePct || 0), 0) / reports.length,
    pctRutasConBarreraSevera: (severas / reports.length) * 100,
  };
}
