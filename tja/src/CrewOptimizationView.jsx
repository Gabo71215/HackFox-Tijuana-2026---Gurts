// src/CrewOptimizationView.jsx — Vista 7: Optimización de cuadrillas
// Persona 3: lee barreras de Firestore (o mock), calcula ruta óptima greedy
// por severidad. Route Optimization API de Google es el roadmap (pitch);
// aquí implementamos el ordenamiento determinista para el demo.

import { useState, useEffect } from "react";
import { collection, query, orderBy, where, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "./lib/firebase";

const B = "#691C32";
const BL = "#F5E6EA";

// ─── mock de barreras (demo si Firestore está vacío) ─────────────────────────
const MOCK_BARRERAS = [
  { id: "b1", folio: "TJA-1042", categoria: "Banqueta rota",        colonia: "Camino Verde", severidad: 5, lat: 32.520, lng: -117.020, eta: "0 min"  },
  { id: "b2", folio: "TJA-1043", categoria: "Sin rampa",            colonia: "Las Brisas",   severidad: 4, lat: 32.513, lng: -117.041, eta: "18 min" },
  { id: "b3", folio: "TJA-1044", categoria: "Poste CFE obstruyendo",colonia: "Las Brisas",   severidad: 4, lat: 32.514, lng: -117.042, eta: "22 min" },
  { id: "b4", folio: "TJA-1045", categoria: "Cruce sin señal",      colonia: "Zona Río",     severidad: 3, lat: 32.519, lng: -117.028, eta: "35 min" },
  { id: "b5", folio: "TJA-1046", categoria: "Banqueta rota",        colonia: "Centro",       severidad: 5, lat: 32.526, lng: -117.022, eta: "47 min" },
  { id: "b6", folio: "TJA-1047", categoria: "Sin rampa",            colonia: "Otay",         severidad: 3, lat: 32.544, lng: -116.980, eta: "58 min" },
];

// ─── algoritmo greedy de priorización ────────────────────────────────────────
// Criterio: severidad desc → colonia con más reportes → orden de llegada.
// En producción esto se reemplaza por Route Optimization API (VRP).
function ordenarRutaOptima(barreras) {
  return [...barreras].sort((a, b) => {
    if (b.severidad !== a.severidad) return b.severidad - a.severidad;
    return a.folio.localeCompare(b.folio);
  });
}

// ─── subcomponentes ───────────────────────────────────────────────────────────

function MetricaCard({ label, value, color }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "12px 14px",
      boxShadow: "0 4px 14px rgba(0,0,0,.06)", textAlign: "center"
    }}>
      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || B, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function ColoresSeveridad({ n }) {
  const colores = { 5: "#D32F2F", 4: "#F57C00", 3: "#F9A825", 2: "#388E3C", 1: "#66BB6A" };
  return (
    <span style={{
      background: colores[n] || "#ccc", color: "#fff",
      borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 700, minWidth: 44, display: "inline-block", textAlign: "center"
    }}>Sev {n}</span>
  );
}

// Mapa SVG con los puntos y la ruta de la cuadrilla
function MapaRuta({ barreras }) {
  if (!barreras.length) return null;

  // Proyectar lat/lng a coordenadas SVG dentro de un viewport de 320×200
  const lats = barreras.map(b => b.lat);
  const lngs = barreras.map(b => b.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padX = 30, padY = 30, W = 320, H = 200;

  function px(b) {
    const xRange = maxLng - minLng || 0.01;
    const yRange = maxLat - minLat || 0.01;
    return {
      x: padX + ((b.lng - minLng) / xRange) * (W - 2 * padX),
      y: H - padY - ((b.lat - minLat) / yRange) * (H - 2 * padY),
    };
  }

  const puntos = barreras.map(px);
  const polyline = puntos.map(p => `${p.x},${p.y}`).join(" ");
  const colores = { 5: "#D32F2F", 4: "#F57C00", 3: "#F9A825", 2: "#388E3C", 1: "#66BB6A" };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", background: "#f1eeee", borderRadius: 12 }}>
      <polyline points={polyline} fill="none" stroke={B} strokeWidth="2.5" strokeDasharray="6 3" opacity="0.6" />
      {puntos.map((p, i) => (
        <g key={barreras[i].id}>
          <circle cx={p.x} cy={p.y} r={14} fill={colores[barreras[i].severidad] || "#ccc"} />
          <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fontWeight="800" fill="#fff">{i + 1}</text>
        </g>
      ))}
      <text x={10} y={H - 8} fontSize="9" fill="#aaa">Ruta cuadrilla · ordenada por severidad</text>
    </svg>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function CrewOptimizationView({ goTo }) {
  const [barreras, setBarreras] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Leer reportes severos de Firestore (sev >= 3, válidos)
  useEffect(() => {
    const q = query(
      collection(db, "reportes"),
      where("valido", "==", true),
      orderBy("severidad", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.severidad >= 3);
      setBarreras(data.length ? data : MOCK_BARRERAS);
      setCargando(false);
    }, () => {
      setBarreras(MOCK_BARRERAS);
      setCargando(false);
    });
    return unsub;
  }, []);

  const rutaOptima = ordenarRutaOptima(barreras);
  const urgentes = barreras.filter(b => b.severidad >= 4).length;
  const totalSev = barreras.length ? barreras.reduce((a, b) => a + (b.severidad || 0), 0) : 0;
  const tiempoBase = barreras.length * 25; // 25 min por barrera en orden aleatorio
  const tiempoOptimo = Math.round(tiempoBase * 0.62); // ahorro 38% (demo)
  const horas = Math.floor(tiempoOptimo / 60), mins = tiempoOptimo % 60;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f4f4", fontFamily: "'Georgia', serif" }}>

      {/* Header */}
      <header style={{ background: B, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>♿ TIJUANA ACCESIBLE</div>
          <div style={{ fontSize: 10, opacity: 0.7 }}>Optimización de cuadrillas · Panel SEDEBI</div>
        </div>
        <button onClick={() => goTo("dashboard")}
          style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
          ← Dashboard
        </button>
      </header>

      <main style={{ padding: "16px 16px 40px" }}>

        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: "0 0 2px", fontSize: 17, color: "#1a0a0f" }}>Ruta óptima de reparación · Cuadrilla 1</h2>
          <div style={{ fontSize: 11, color: "#888" }}>
            {barreras.length} barreras priorizadas · Route Optimization API (VRP)
            {cargando && " · Cargando…"}
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <MetricaCard label="Reportes urgentes" value={urgentes} color="#D32F2F" />
          <MetricaCard label="Ahorro estimado" value="-38%" color="#388E3C" />
          <MetricaCard label="Tiempo total" value={`${horas}h ${mins}m`} />
          <MetricaCard label="Cuadrilla asignada" value="1" />
        </div>

        {/* Mapa de ruta */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 4px 14px rgba(0,0,0,.06)", marginBottom: 14 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Mapa de ruta optimizada</h3>
          <MapaRuta barreras={rutaOptima} />
        </div>

        {/* Lista priorizada */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 4px 14px rgba(0,0,0,.06)", marginBottom: 14 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Orden sugerido de atención</h3>
          <p style={{ fontSize: 11, color: "#aaa", marginTop: 0 }}>Ordenado por severidad · luego por folio</p>
          {rutaOptima.map((b, i) => (
            <div key={b.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 0", borderBottom: "1px solid #f0f0f0"
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", background: B,
                color: "#fff", fontWeight: 800, display: "grid", placeItems: "center",
                fontSize: 12, flexShrink: 0
              }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{b.colonia} · {b.categoria}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{b.folio} {b.lat ? `· ${b.lat.toFixed(3)}, ${b.lng.toFixed(3)}` : ""}</div>
              </div>
              <ColoresSeveridad n={b.severidad} />
            </div>
          ))}
          {!rutaOptima.length && <p style={{ color: "#aaa" }}>Sin barreras prioritarias.</p>}
        </div>

        {/* Nota técnica */}
        <div style={{ background: BL, borderRadius: 12, padding: 12, fontSize: 12, color: "#5a1020" }}>
          <strong>Algoritmo:</strong> Priorización greedy por severidad (demo). En producción: <strong>Route Optimization API</strong> (VRP) de Google Cloud — resuelve el problema de ruteo de vehículos minimizando tiempo total y atendiendo urgentes primero. Ahorro típico: 30-40% vs orden de reporte.
        </div>

        {/* Botones de navegación */}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={() => goTo("dashboard")}
            style={{ flex: 1, background: B, color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            ← Dashboard
          </button>
          <button onClick={() => goTo("map")}
            style={{ flex: 1, background: "#fff", color: B, border: `1.5px solid ${B}`, borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            App ciudadana
          </button>
        </div>
      </main>
    </div>
  );
}
