// src/DashboardView.jsx — Vista 6: Panel SEDEBI
// Persona 3: Dashboard institucional. Lee de Firestore, calcula scores,
// muestra métricas de la semana, mapa de calor por colonia, reporte ejecutivo.

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, where, Timestamp } from "firebase/firestore";
import { db } from "./lib/firebase";
import { accessibilityScore, scoreColor, aggregateColonia } from "./lib/accessibilityScore";

const B = "#691C32";      // Burgundy — color de marca
const BL = "#F5E6EA";    // Burgundy light

// Colonias del demo. En producción vendrían de IMPLAN / OSM.
const COLONIAS_DEMO = [
  "Camino Verde", "Las Brisas", "Zona Río", "Centro", "Otay", "Playas", "La Mesa"
];

// ─── helpers ────────────────────────────────────────────────────────────────

function hace7Dias() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return Timestamp.fromDate(d);
}

function agruparPorColonia(reportes) {
  const mapa = {};
  for (const r of reportes) {
    const col = r.colonia || "Sin clasificar";
    if (!mapa[col]) mapa[col] = [];
    mapa[col].push(r);
  }
  return mapa;
}

function calcularScoresPorColonia(reportes) {
  const agrupado = agruparPorColonia(reportes);
  return Object.entries(agrupado).map(([colonia, reps]) => {
    const metricas = aggregateColonia(reps);
    const score = accessibilityScore(metricas);
    return { colonia, score, total: reps.length, severidadProm: metricas.severidadPromedio };
  }).sort((a, b) => a.score - b.score); // más crítico primero
}

// ─── componentes pequeños ────────────────────────────────────────────────────

function Scorecard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "14px 16px",
      boxShadow: "0 4px 14px rgba(0,0,0,.06)", borderLeft: `4px solid ${color || B}`
    }}>
      <div style={{ fontSize: 11, color: "#777", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: color || B, lineHeight: 1.1, margin: "4px 0" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#999" }}>{sub}</div>}
    </div>
  );
}

function ScoreRow({ colonia, score, total, rank }) {
  const color = scoreColor(score);
  const ancho = `${score}%`;
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{rank}. {colonia}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color }}>{score}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, background: "#f0f0f0", borderRadius: 99, height: 7 }}>
          <div style={{ width: ancho, background: color, borderRadius: 99, height: 7, transition: "width .5s" }} />
        </div>
        <span style={{ fontSize: 11, color: "#aaa", minWidth: 50 }}>{total} reportes</span>
      </div>
    </div>
  );
}

function BadgeSeveridad({ n }) {
  const colores = { 5: "#D32F2F", 4: "#F57C00", 3: "#F9A825", 2: "#388E3C", 1: "#388E3C" };
  return (
    <span style={{
      background: colores[n] || "#ccc", color: "#fff",
      borderRadius: 99, padding: "2px 9px", fontSize: 11, fontWeight: 700
    }}>Sev {n}</span>
  );
}

function TablaReportes({ reportes }) {
  const top = reportes.filter(r => r.valido !== false).slice(0, 8);
  if (!top.length) return <p style={{ color: "#aaa", fontSize: 13 }}>Sin reportes esta semana.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#fafafa", textAlign: "left" }}>
            {["Folio", "Categoría", "Colonia", "Sev.", "Fecha"].map(h => (
              <th key={h} style={{ padding: "8px 10px", color: "#888", fontWeight: 600, borderBottom: "1px solid #eee" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {top.map(r => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
              <td style={{ padding: "8px 10px", fontFamily: "monospace", color: B }}>{r.folio}</td>
              <td style={{ padding: "8px 10px" }}>{r.categoria || "—"}</td>
              <td style={{ padding: "8px 10px", color: "#555" }}>{r.colonia || "Sin zona"}</td>
              <td style={{ padding: "8px 10px" }}><BadgeSeveridad n={r.severidad} /></td>
              <td style={{ padding: "8px 10px", color: "#aaa" }}>
                {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString("es-MX") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Mapa de calor simple (SVG burbujas por colonia)
function MapaCalor({ scores }) {
  // Posiciones aproximadas de colonias de Tijuana en un canvas de 340×200
  const posiciones = {
    "Camino Verde":  { x: 60,  y: 140 },
    "Las Brisas":   { x: 110, y: 90  },
    "Zona Río":     { x: 180, y: 100 },
    "Centro":       { x: 200, y: 130 },
    "Otay":         { x: 270, y: 80  },
    "Playas":       { x: 40,  y: 60  },
    "La Mesa":      { x: 240, y: 140 },
    "Sin clasificar": { x: 160, y: 55 },
  };
  return (
    <svg viewBox="0 0 340 200" style={{ width: "100%", background: "#f9f5f5", borderRadius: 12 }}>
      {/* Fondo mínimo de TJ */}
      <rect x="0" y="0" width="340" height="200" fill="#f9f5f5" rx="12" />
      <text x="10" y="18" fontSize="10" fill="#ccc">Tijuana</text>
      {scores.map(({ colonia, score, total }) => {
        const pos = posiciones[colonia] || { x: 160, y: 100 };
        const r = Math.max(18, Math.min(38, 14 + total * 2));
        const color = scoreColor(score);
        return (
          <g key={colonia}>
            <circle cx={pos.x} cy={pos.y} r={r} fill={color} opacity={0.85} />
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize="12" fontWeight="800" fill="#fff">{score}</text>
            <text x={pos.x} y={pos.y + r + 10} textAnchor="middle"
              fontSize="8" fill="#555">{colonia.split(" ")[0]}</text>
          </g>
        );
      })}
      {/* Leyenda */}
      {[["<35 Crítico", "#D32F2F"], ["35-55 Medio", "#F57C00"], [">55 Bueno", "#388E3C"]].map(([label, c], i) => (
        <g key={label}>
          <rect x={10 + i * 108} y={180} width={10} height={10} fill={c} rx={3} />
          <text x={24 + i * 108} y={189} fontSize="8" fill="#666">{label}</text>
        </g>
      ))}
    </svg>
  );
}

// Reporte ejecutivo generado determinista (sin IA inventada)
function ReporteEjecutivo({ stats, scores }) {
  if (!stats.total) return null;
  const coloniasCriticas = scores.filter(s => s.score < 35).map(s => s.colonia);
  const categoriaMas = stats.categoriaTop;
  return (
    <div style={{ background: BL, borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700, color: B, marginBottom: 6 }}>📋 Reporte ejecutivo · semana {new Date().toLocaleDateString("es-MX")}</div>
      <p style={{ margin: "0 0 8px" }}>
        Esta semana se registraron <strong>{stats.total}</strong> reportes ciudadanos en Tijuana Accesible.
        La severidad promedio fue de <strong>{stats.sevProm.toFixed(1)}/5</strong>.
        {coloniasCriticas.length > 0
          ? ` Las colonias con nivel crítico son: ${coloniasCriticas.join(", ")}.`
          : " No hay colonias en nivel crítico esta semana."}
      </p>
      {categoriaMas && (
        <p style={{ margin: 0 }}>
          La categoría de barrera más frecuente es <strong>{categoriaMas}</strong>.
          Se recomienda priorizar cuadrillas en las zonas señaladas como críticas.
        </p>
      )}
    </div>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function DashboardView({ goTo }) {
  const [reportes, setReportes] = useState([]);
  const [reportesSemana, setReportesSemana] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState("resumen"); // "resumen" | "scores" | "tabla"

  // Suscripción en tiempo real a todos los reportes
  useEffect(() => {
    const q = query(collection(db, "reportes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReportes(todos);

      // Filtrar últimos 7 días
      const corte = hace7Dias();
      const semana = todos.filter(r => r.createdAt && r.createdAt >= corte);
      setReportesSemana(semana.length > 0 ? semana : todos); // fallback: todos si no hay de esta semana
      setCargando(false);
    }, () => setCargando(false));
    return unsub;
  }, []);

  // Datos calculados
  const scores = calcularScoresPorColonia(reportes.length ? reportes : MOCK_REPORTES);
  const datos = reportesSemana.length ? reportesSemana : MOCK_REPORTES;

  const stats = {
    total: datos.length,
    sevProm: datos.length ? datos.reduce((a, r) => a + (r.severidad || 0), 0) / datos.length : 0,
    coloniasCriticas: scores.filter(s => s.score < 35).length,
    sinRampa: datos.filter(r => r.categoria?.toLowerCase().includes("rampa") || r.categoria?.toLowerCase().includes("banqueta")).length,
    categoriaTop: (() => {
      const freq = {};
      datos.forEach(r => { if (r.categoria) freq[r.categoria] = (freq[r.categoria] || 0) + 1; });
      return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    })(),
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f4f4", fontFamily: "'Georgia', serif" }}>

      {/* Header */}
      <header style={{ background: B, color: "#fff", padding: "14px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>♿ TIJUANA ACCESIBLE</div>
            <div style={{ fontSize: 10, opacity: 0.7 }}>Panel SEDEBI · Acceso institucional</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => goTo("crews")}
              style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              🚧 Cuadrillas
            </button>
            <button onClick={() => goTo("map")}
              style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
              ← App
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: "16px 16px 40px" }}>

        {/* Título semana */}
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: "0 0 2px", fontSize: 18, color: "#1a0a0f" }}>Diagnóstico de accesibilidad urbana</h2>
          <div style={{ fontSize: 11, color: "#888" }}>
            Semana del {(() => { const d = new Date(); d.setDate(d.getDate()-7); return d.toLocaleDateString("es-MX"); })()} al {new Date().toLocaleDateString("es-MX")}
            {cargando ? " · Cargando…" : " · Datos en tiempo real"}
          </div>
        </div>

        {/* Scorecards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <Scorecard label="Reportes ciudadanos" value={stats.total} sub="esta semana" />
          <Scorecard label="Severidad media" value={stats.sevProm.toFixed(1)} sub="escala 1-5" color="#F57C00" />
          <Scorecard label="Zonas críticas" value={stats.coloniasCriticas} sub="score < 35" color="#D32F2F" />
          <Scorecard label="Sin rampa / banqueta" value={stats.sinRampa} sub="reportes prioritarios" color="#5C6BC0" />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[["resumen", "Resumen"], ["scores", "Scores"], ["tabla", "Reportes"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{
                padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: tab === id ? B : "#fff",
                color: tab === id ? "#fff" : "#555",
                border: tab === id ? "none" : "1px solid #ddd"
              }}>{label}</button>
          ))}
        </div>

        {/* Tab: Resumen */}
        {tab === "resumen" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 4px 14px rgba(0,0,0,.06)", marginBottom: 12 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#1a0a0f" }}>Mapa de calor · Tijuana</h3>
              <MapaCalor scores={scores} />
            </div>
            <ReporteEjecutivo stats={stats} scores={scores} />
          </div>
        )}

        {/* Tab: Accessibility Scores */}
        {tab === "scores" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 4px 14px rgba(0,0,0,.06)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Accessibility Score por colonia</h3>
            <p style={{ fontSize: 11, color: "#aaa", marginTop: 0 }}>Fórmula determinista auditable — no IA</p>
            {scores.map((s, i) => <ScoreRow key={s.colonia} rank={i + 1} {...s} />)}
            {!scores.length && <p style={{ color: "#aaa" }}>Sin datos suficientes.</p>}
          </div>
        )}

        {/* Tab: Tabla de reportes */}
        {tab === "tabla" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 4px 14px rgba(0,0,0,.06)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Últimos reportes (top 8)</h3>
            <TablaReportes reportes={datos} />
          </div>
        )}

        {/* Looker Studio embed (si hay URL) */}
        <div style={{ marginTop: 16, background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 4px 14px rgba(0,0,0,.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>📊 Looker Studio — reporte oficial</h3>
            <span style={{ fontSize: 10, background: BL, color: B, borderRadius: 99, padding: "3px 10px", fontWeight: 700 }}>Solo directivos</span>
          </div>
          <div style={{ background: "#fafafa", border: "2px dashed #e0d4d7", borderRadius: 10, padding: 20, textAlign: "center", color: "#999", fontSize: 12 }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
            <div style={{ fontWeight: 600, color: "#666", marginBottom: 4 }}>Pendiente: agregar URL de Looker Studio</div>
            <div>Sigue los pasos en <strong>LOOKER_STUDIO.md</strong> para obtener el link de embed.<br />
              Reemplaza el placeholder en este componente y listo.</div>
          </div>
          {/* Cuando tengas la URL, descomenta esto:
          <iframe
            title="Dashboard Looker Studio"
            src="https://lookerstudio.google.com/embed/reporting/TU_ID_AQUI/page/1"
            width="100%" height="600"
            style={{ border: 0, borderRadius: 10, marginTop: 8 }}
            allowFullScreen
          /> */}
        </div>

        {/* Línea de continuidad ADBC */}
        <div style={{ marginTop: 14, background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 4px 14px rgba(0,0,0,.06)" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Continuidad de inclusión digital · ADBC</h3>
          <div style={{ display: "flex", gap: 0, fontSize: 11 }}>
            {[
              { año: "Mayo 2025", label: "MUAC · Lengua de Señas", activo: false },
              { año: "Mayo 2026", label: "Tijuana Accesible", activo: true },
              { año: "2027 →", label: "Punt. estatal BC", activo: false },
            ].map(({ año, label, activo }, i) => (
              <div key={año} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                {i < 2 && <div style={{ position: "absolute", top: 11, left: "50%", width: "100%", height: 2, background: activo ? B : "#ddd" }} />}
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", background: activo ? B : "#ddd",
                  margin: "0 auto 6px", display: "grid", placeItems: "center", position: "relative", zIndex: 1
                }}>
                  {activo && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                </div>
                <div style={{ fontWeight: activo ? 700 : 400, color: activo ? B : "#888" }}>{año}</div>
                <div style={{ color: "#aaa" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

// ─── datos mock para el demo (cuando Firestore esté vacío) ───────────────────
const MOCK_REPORTES = [
  { id: "m1", folio: "TJA-1042", categoria: "Banqueta rota", severidad: 5, colonia: "Camino Verde", lat: 32.52, lng: -117.02, valido: true, pendientePct: 8 },
  { id: "m2", folio: "TJA-1043", categoria: "Sin rampa", severidad: 4, colonia: "Las Brisas", lat: 32.51, lng: -117.04, valido: true, pendientePct: 5 },
  { id: "m3", folio: "TJA-1044", categoria: "Poste CFE obstruyendo", severidad: 4, colonia: "Las Brisas", lat: 32.513, lng: -117.041, valido: true, pendientePct: 3 },
  { id: "m4", folio: "TJA-1045", categoria: "Cruce peatonal sin señal", severidad: 3, colonia: "Zona Río", lat: 32.519, lng: -117.028, valido: true, pendientePct: 2 },
  { id: "m5", folio: "TJA-1046", categoria: "Banqueta rota", severidad: 5, colonia: "Centro", lat: 32.526, lng: -117.022, valido: true, pendientePct: 6 },
  { id: "m6", folio: "TJA-1047", categoria: "Sin rampa", severidad: 3, colonia: "Otay", lat: 32.544, lng: -116.98, valido: true, pendientePct: 4 },
  { id: "m7", folio: "TJA-1048", categoria: "Cableado informal", severidad: 2, colonia: "Playas", lat: 32.51, lng: -117.12, valido: true, pendientePct: 1 },
];

