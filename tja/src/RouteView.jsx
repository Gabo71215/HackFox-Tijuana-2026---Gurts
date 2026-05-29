// src/RouteView.jsx  — Vista 4: Ruteo accesible multimodal

import { useState, useRef, useEffect, useCallback } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { computeRoutes, rankAccessibleRoutes, elevationProfile, maxSlopePct } from "./lib/routing";
import { subscribeReports } from "./lib/reports";

const B  = "#691C32";
const G  = "#388E3C";
const RD = "#E53935";
const LIBRARIES = ["places"];
const TIJUANA_CENTER = { lat: 32.5149, lng: -117.0382 };

const QUICK_DEST = [
  { label: "IMSS Clínica 20",  lat: 32.5245, lng: -117.0278 },
  { label: "Hospital General", lat: 32.5052, lng: -117.0315 },
  { label: "Centro Cívico",    lat: 32.5187, lng: -117.0252 },
  { label: "Troncal SITT P1",  lat: 32.5070, lng: -117.0198 },
];

const PROFILES_LABEL = {
  silla_manual:    "Silla manual",
  silla_electrica: "Silla eléctrica",
  muletas:         "Muletas",
  baja_vision:     "Baja visión",
};

export default function RouteView({ profile, goTo }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  // Inputs no controlados (evita conflicto con Places SDK)
  const originInputRef = useRef(null);
  const destInputRef   = useRef(null);
  const acOriginInst   = useRef(null);
  const acDestInst     = useRef(null);

  // Ref al mapa y polylines/markers nativos
  const mapRef       = useRef(null);
  const polylinesRef = useRef([]);
  const markersRef   = useRef([]);

  // Coordenadas
  const [originLatLng, setOriginLatLng] = useState(null);
  const [destLatLng,   setDestLatLng]   = useState(null);

  // Resultados
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [accPath,     setAccPath]     = useState([]);   // [{lat,lng}]
  const [stdPath,     setStdPath]     = useState([]);
  const [stats,       setStats]       = useState(null);
  const [barriers,    setBarriers]    = useState([]);
  const [activeTab,   setActiveTab]   = useState("accessible");
  const [fullscreen,  setFullscreen]  = useState(false);
  const [activeQuick, setActiveQuick] = useState({ origin: null, dest: null });

  // Suscribir barreras
  useEffect(() => {
    const unsub = subscribeReports(setBarriers);
    return () => unsub?.();
  }, []);

  // Montar Autocomplete sobre los inputs
  useEffect(() => {
    if (!isLoaded) return;
    const opts = { componentRestrictions: { country: "mx" }, fields: ["geometry", "formatted_address", "name"] };
    if (originInputRef.current && !acOriginInst.current) {
      const ac = new window.google.maps.places.Autocomplete(originInputRef.current, opts);
      ac.addListener("place_changed", () => {
        const p = ac.getPlace();
        if (p?.geometry?.location) {
          setOriginLatLng({ lat: p.geometry.location.lat(), lng: p.geometry.location.lng() });
          setActiveQuick(q => ({ ...q, origin: null }));
        }
      });
      acOriginInst.current = ac;
    }
    if (destInputRef.current && !acDestInst.current) {
      const ac = new window.google.maps.places.Autocomplete(destInputRef.current, opts);
      ac.addListener("place_changed", () => {
        const p = ac.getPlace();
        if (p?.geometry?.location) {
          setDestLatLng({ lat: p.geometry.location.lat(), lng: p.geometry.location.lng() });
          setActiveQuick(q => ({ ...q, dest: null }));
        }
      });
      acDestInst.current = ac;
    }
  }, [isLoaded]);

  // ── Dibujar / redibujar polylines cuando cambian los paths o el tab activo ──
  useEffect(() => {
    if (!mapRef.current || (!accPath.length && !stdPath.length)) return;

    // Limpiar anteriores
    polylinesRef.current.forEach(p => p.setMap(null));
    markersRef.current.forEach(m => m.setMap(null));
    polylinesRef.current = [];
    markersRef.current   = [];

    const map = mapRef.current;

    // Dibujar ruta estándar (roja)
    if (stdPath.length) {
      const line = new window.google.maps.Polyline({
        path: stdPath,
        strokeColor:   RD,
        strokeOpacity: activeTab === "standard"   ? 0.9 : 0.25,
        strokeWeight:  activeTab === "standard"   ? 6   : 3,
        map,
      });
      polylinesRef.current.push(line);
    }

    // Dibujar ruta accesible (verde) — encima
    if (accPath.length) {
      const line = new window.google.maps.Polyline({
        path: accPath,
        strokeColor:   G,
        strokeOpacity: activeTab === "accessible" ? 0.95 : 0.25,
        strokeWeight:  activeTab === "accessible" ? 7    : 3,
        map,
      });
      polylinesRef.current.push(line);
    }

    // Marcadores de origen y destino
    const startPt = accPath[0] || stdPath[0];
    const endPt   = accPath[accPath.length - 1] || stdPath[stdPath.length - 1];

    if (startPt) {
      markersRef.current.push(new window.google.maps.Marker({
        position: startPt, map,
        label: { text: "A", color: "#fff", fontWeight: "bold" },
        title: "Origen",
      }));
    }
    if (endPt) {
      markersRef.current.push(new window.google.maps.Marker({
        position: endPt, map,
        label: { text: "B", color: "#fff", fontWeight: "bold" },
        title: "Destino",
      }));
    }

    // Ajustar zoom para que quepan ambas rutas
    const bounds = new window.google.maps.LatLngBounds();
    [...accPath, ...stdPath].forEach(p => bounds.extend(p));
    map.fitBounds(bounds, { top: 40, right: 20, bottom: 20, left: 20 });

  }, [accPath, stdPath, activeTab]);

  // Limpiar polylines al desmontar
  useEffect(() => {
    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
      markersRef.current.forEach(m => m.setMap(null));
    };
  }, []);

  // ── Helpers ──
  function fmtTime(sec) {
    if (!sec) return "--";
    const m = Math.round(sec / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60}m`;
  }
  function fmtDist(m) {
    if (!m) return "--";
    return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${m} m`;
  }

  // Extraer path [{lat,lng}] de una ruta de Routes API
  function extractPath(routeObj) {
    const coords = routeObj?.polyline?.geoJsonLinestring?.coordinates || [];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  }

  async function geocode(text) {
    return new Promise((res, rej) => {
      new window.google.maps.Geocoder().geocode(
        { address: text + ", Tijuana, BC, México" },
        (results, status) => {
          if (status === "OK" && results[0]) {
            const loc = results[0].geometry.location;
            res({ lat: loc.lat(), lng: loc.lng() });
          } else rej(new Error("No se encontró la dirección"));
        }
      );
    });
  }

  // ── Calcular rutas ──
  const handleRoute = useCallback(async () => {
    setError(null);
    let oLL = originLatLng;
    let dLL = destLatLng;
    const oVal = originInputRef.current?.value?.trim();
    const dVal = destInputRef.current?.value?.trim();
    try {
      if (!oLL && oVal) oLL = await geocode(oVal);
      if (!dLL && dVal) dLL = await geocode(dVal);
    } catch {
      setError("No se pudo ubicar la dirección. Intenta con una más específica.");
      return;
    }
    if (!oLL || !dLL) { setError("Ingresa origen y destino."); return; }

    setLoading(true);
    try {
      const rawRoutes = await computeRoutes(oLL, dLL, "WALK");
      if (!rawRoutes.length) throw new Error("No se encontraron rutas.");

      let slope0 = 0;
      try {
        const pts = extractPath(rawRoutes[0]).filter((_, i) => i % 5 === 0);
        if (pts.length >= 2) {
          const elevs = await elevationProfile(pts);
          slope0 = maxSlopePct(elevs, rawRoutes[0].distanceMeters);
        }
      } catch (_) {}

      const ranked = rankAccessibleRoutes(rawRoutes, barriers, profile, { 0: slope0 });
      const acc = ranked[0];
      const std = ranked.length > 1 ? ranked[ranked.length - 1] : ranked[0];

      setAccPath(extractPath(acc.route));
      setStdPath(extractPath(std.route));
      setStats({
        acc: { time: fmtTime(acc.durationSec), dist: fmtDist(acc.distanceMeters), severas: acc.severasEnRuta, slope: acc.slopePct },
        std: { time: fmtTime(std.durationSec), dist: fmtDist(std.distanceMeters), severas: std.severasEnRuta, slope: std.slopePct },
      });
      setActiveTab("accessible");
    } catch (e) {
      setError(e.message || "Error al calcular la ruta.");
    } finally {
      setLoading(false);
    }
  }, [originLatLng, destLatLng, barriers, profile]);

  function pickQuick(q, field = "dest") {
    if (field === "origin") {
      // Si ya está activo, deseleccionar y limpiar para escribir libremente
      if (activeQuick.origin === q.label) {
        if (originInputRef.current) { originInputRef.current.value = ""; originInputRef.current.focus(); }
        setOriginLatLng(null);
        setActiveQuick(p => ({ ...p, origin: null }));
      } else {
        if (originInputRef.current) originInputRef.current.value = q.label;
        setOriginLatLng({ lat: q.lat, lng: q.lng });
        setActiveQuick(p => ({ ...p, origin: q.label }));
      }
    } else {
      // Si ya está activo, deseleccionar y limpiar
      if (activeQuick.dest === q.label) {
        if (destInputRef.current) { destInputRef.current.value = ""; destInputRef.current.focus(); }
        setDestLatLng(null);
        setActiveQuick(p => ({ ...p, dest: null }));
      } else {
        if (destInputRef.current) destInputRef.current.value = q.label;
        setDestLatLng({ lat: q.lat, lng: q.lng });
        setActiveQuick(p => ({ ...p, dest: q.label }));
      }
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        setOriginLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (originInputRef.current) originInputRef.current.value = "Mi ubicación";
        setActiveQuick(p => ({ ...p, origin: null }));
      },
      () => setError("No se pudo obtener tu ubicación.")
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh" }}>
        <div style={{ fontSize: 32 }}>🗺️</div>
        <div style={{ color: B, fontWeight: 600, marginTop: 8 }}>Cargando mapa…</div>
      </div>
    );
  }

  const hasRoutes = accPath.length > 0 || stdPath.length > 0;
  const mapHeight = fullscreen ? "100vh" : (hasRoutes ? "44vh" : "32vh");

  return (
    <div style={S.container}>

      {/* ── Header (oculto en fullscreen) ── */}
      {!fullscreen && (
        <div style={S.header}>
          <button onClick={() => goTo("map")} style={S.backBtn}>←</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Ruta accesible</div>
            <div style={{ fontSize: 9, opacity: 0.7 }}>{PROFILES_LABEL[profile] || profile}</div>
          </div>
          <div style={S.badge}>Vista 4</div>
        </div>
      )}

      {/* ── Mapa ── */}
      <div style={{ position: "relative", height: mapHeight, transition: "height .3s" }}>
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={originLatLng || destLatLng || TIJUANA_CENTER}
          zoom={13}
          options={{ disableDefaultUI: true, zoomControl: true }}
          onLoad={map => { mapRef.current = map; }}
        />

        {/* Leyenda */}
        {hasRoutes && (
          <div style={S.legend}>
            <button style={{ ...S.legendBtn, opacity: activeTab === "accessible" ? 1 : 0.45 }}
              onClick={() => setActiveTab("accessible")}>
              <span style={{ ...S.dot, background: G }} /> Accesible
            </button>
            <button style={{ ...S.legendBtn, opacity: activeTab === "standard" ? 1 : 0.45 }}
              onClick={() => setActiveTab("standard")}>
              <span style={{ ...S.dot, background: RD }} /> Estándar
            </button>
          </div>
        )}

        {/* Botón fullscreen */}
        <button
          style={S.fsBtn}
          onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        >
          {fullscreen ? "✕" : "⛶"}
        </button>

        {/* Overlay de instrucciones en fullscreen */}
        {fullscreen && (
          <div style={S.fsOverlay}>
            <button style={S.fsBack} onClick={() => setFullscreen(false)}>← Volver</button>
            {hasRoutes && (
              <div style={S.fsLegend}>
                <button style={{ ...S.legendBtn, opacity: activeTab === "accessible" ? 1 : 0.5 }}
                  onClick={() => setActiveTab("accessible")}>
                  <span style={{ ...S.dot, background: G }} /> Accesible
                </button>
                <button style={{ ...S.legendBtn, opacity: activeTab === "standard" ? 1 : 0.5 }}
                  onClick={() => setActiveTab("standard")}>
                  <span style={{ ...S.dot, background: RD }} /> Estándar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Panel inferior (oculto en fullscreen) ── */}
      {!fullscreen && (
        <div style={S.panel}>

          {/* Inputs */}
          <div style={S.inputGroup}>
            <div style={S.inputRow}>
              <span style={S.icon}>📍</span>
              <input ref={originInputRef} style={S.input} placeholder="Origen"
                onChange={() => setOriginLatLng(null)} />
              <button style={S.gpsBtn} onClick={useMyLocation} title="Mi ubicación">🎯</button>
            </div>
            <div style={{ height: 1, background: "#f0e0e4", margin: "4px 0" }} />
            <div style={S.inputRow}>
              <span style={S.icon}>🏁</span>
              <input ref={destInputRef} style={S.input} placeholder="Destino"
                onChange={() => setDestLatLng(null)} />
            </div>
          </div>

          {/* Quick destinations */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: "#bbb", marginBottom: 4, letterSpacing: 0.5 }}>
              DESTINOS FRECUENTES — toca para destino · ✚O para origen
            </div>
            <div style={S.quickRow}>
              {QUICK_DEST.map(q => (
                <div key={q.label} style={{ display: "flex", gap: 2 }}>
                  <button style={{
                    ...S.quickBtn,
                    background: activeQuick.dest === q.label ? "#F5E6EA" : "#fafafa",
                    border: activeQuick.dest === q.label ? `1.5px solid ${B}` : "1.5px solid #eee",
                    color: activeQuick.dest === q.label ? B : "#555",
                  }} onClick={() => pickQuick(q, "dest")}>{q.label}</button>
                  <button style={{
                    ...S.quickBtn, padding: "4px 6px", fontSize: 9,
                    background: activeQuick.origin === q.label ? "#F5E6EA" : "#f0f0f0",
                    border: activeQuick.origin === q.label ? `1.5px solid ${B}` : "1.5px solid #ddd",
                    color: activeQuick.origin === q.label ? B : "#999",
                  }} onClick={() => pickQuick(q, "origin")} title="Usar como origen">✚O</button>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <div style={S.errorBox}>⚠️ {error}</div>}

          {/* CTA */}
          <button style={{ ...S.mainBtn, background: loading ? "#bbb" : B, cursor: loading ? "not-allowed" : "pointer" }}
            onClick={handleRoute} disabled={loading}>
            {loading ? "⏳ Calculando rutas…" : "🗺️ Comparar rutas"}
          </button>

          {/* Comparativa */}
          {stats && (
            <div style={S.compareBox}>
              <div style={S.compareTitle}>Comparativa de rutas</div>
              <div style={S.compareGrid}>
                <div style={{ ...S.card, border: activeTab === "accessible" ? `2px solid ${G}` : "2px solid #e0e0e0" }}
                  onClick={() => setActiveTab("accessible")}>
                  <div style={{ color: G, fontWeight: 700, fontSize: 12, marginBottom: 6 }}>✅ Ruta accesible</div>
                  <Stat label="Tiempo"          value={stats.acc.time} />
                  <Stat label="Distancia"       value={stats.acc.dist} />
                  <Stat label="Barreras severas" value={stats.acc.severas} good={stats.acc.severas === 0} />
                  <Stat label="Pendiente máx."  value={`${stats.acc.slope}%`} />
                </div>
                <div style={{ ...S.card, border: activeTab === "standard" ? `2px solid ${RD}` : "2px solid #e0e0e0" }}
                  onClick={() => setActiveTab("standard")}>
                  <div style={{ color: RD, fontWeight: 700, fontSize: 12, marginBottom: 6 }}>🗺️ Ruta Google Maps</div>
                  <Stat label="Tiempo"          value={stats.std.time} />
                  <Stat label="Distancia"       value={stats.std.dist} />
                  <Stat label="Barreras severas" value={stats.std.severas} bad={stats.std.severas > 0} />
                  <Stat label="Pendiente máx."  value={`${stats.std.slope}%`} />
                </div>
              </div>
              <div style={S.note}>
                ℹ️ Ruta calculada matemáticamente — no por IA. Pesos por perfil:{" "}
                <strong>{PROFILES_LABEL[profile]}</strong>.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, good, bad }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
      <span style={{ fontSize: 10, color: "#888" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: good ? "#388E3C" : bad ? "#E53935" : "#222" }}>
        {value}
      </span>
    </div>
  );
}

const S = {
  container:   { maxWidth: 430, margin: "0 auto", minHeight: "100vh", fontFamily: "system-ui", background: "#fff", display: "flex", flexDirection: "column" },
  header:      { background: "#691C32", color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 },
  backBtn:     { background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 16 },
  badge:       { marginLeft: "auto", background: "rgba(255,255,255,.15)", borderRadius: 12, padding: "3px 10px", fontSize: 10 },
  legend:      { position: "absolute", top: 10, right: 48, background: "rgba(255,255,255,.93)", borderRadius: 10, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 2px 8px rgba(0,0,0,.15)" },
  legendBtn:   { display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: 0 },
  dot:         { width: 10, height: 10, borderRadius: "50%", display: "inline-block" },
  fsBtn:       { position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,.93)", border: "none", borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,.2)", display: "flex", alignItems: "center", justifyContent: "center" },
  fsOverlay:   { position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: 10, pointerEvents: "none" },
  fsBack:      { background: "rgba(255,255,255,.93)", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", pointerEvents: "all", boxShadow: "0 2px 6px rgba(0,0,0,.2)" },
  fsLegend:    { background: "rgba(255,255,255,.93)", borderRadius: 10, padding: "6px 12px", display: "flex", flexDirection: "column", gap: 4, pointerEvents: "all", boxShadow: "0 2px 6px rgba(0,0,0,.15)" },
  panel:       { flex: 1, padding: "14px 14px 24px", overflowY: "auto", background: "#fff" },
  inputGroup:  { background: "#fff", border: "1.5px solid #F5E6EA", borderRadius: 14, padding: "6px 10px", marginBottom: 10, boxShadow: "0 1px 6px rgba(105,28,50,.07)" },
  inputRow:    { display: "flex", alignItems: "center", gap: 6 },
  icon:        { fontSize: 14, flexShrink: 0 },
  input:       { flex: 1, border: "none", outline: "none", fontSize: 13, padding: "7px 4px", background: "transparent", color: "#222" },
  gpsBtn:      { background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 2, flexShrink: 0 },
  quickRow:    { display: "flex", gap: 6, flexWrap: "wrap" },
  quickBtn:    { borderRadius: 20, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontWeight: 500 },
  errorBox:    { background: "#FFF3CD", border: "1px solid #FFCA28", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#7B5800", marginBottom: 10 },
  mainBtn:     { width: "100%", color: "#fff", border: "none", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, marginBottom: 14 },
  compareBox:  { background: "#fafafa", borderRadius: 14, padding: 12, border: "1px solid #f0e0e4" },
  compareTitle:{ fontWeight: 700, fontSize: 13, color: "#3a0f1a", marginBottom: 10 },
  compareGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 },
  card:        { background: "#fff", borderRadius: 10, padding: 10, cursor: "pointer" },
  note:        { fontSize: 10, color: "#999", lineHeight: 1.5, borderTop: "1px solid #eee", paddingTop: 8 },
};
