// src/App.jsx — Tijuana Accesible · v3
// Apple/iOS 26 Liquid Glass · integra: Places Autocomplete, Elevation API,
// banquetas OSM, TutorialRapido, folios TJA-, NAVEGACIÓN TURN-BY-TURN con voz.
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, Polyline, CircleF } from "@react-google-maps/api";
import {
  Map as MapIcon, Camera, Mic, MicOff, Navigation, MessageCircle,
  Accessibility, Zap, Activity, Eye, Lock, Check, AlertTriangle, Star,
  Truck, BarChart2, Bot, RefreshCw, Send, LogOut, Monitor, Smartphone,
  MapPin, Loader2, Volume2, ArrowRight, TrendingUp, Sparkles,
  ChevronRight, HelpCircle, Crosshair, Layers, X, Play, Compass,
  Bus, Globe, Apple, Construction,
} from "lucide-react";
import { ensureAnonymousAuth } from "./lib/firebase";
import { subscribeReports, createReport } from "./lib/reports";
import { classifyBarrierPhoto, extractBarrierFromText, generateExecutiveReport } from "./lib/gemini";
import {
  computeRoutes, rankAccessibleRoutes, elevationProfile, maxSlopePct, extractPath, distH,
} from "./lib/routing";
import osmData from "./data/osm-tijuana.json";

// ── DESIGN TOKENS ───────────────────────────────────────────────────────────
const B        = "#691C32";
const B_DARK   = "#4A1322";
const B_TINT   = "#F5E6EA";
const B_SOFT   = "#FBF6F8";
const GREEN    = "#2E7D46";
const RED      = "#B3261E";
const ORANGE   = "#F57C00";
const INK      = "#1C1C1E";
const INK_2    = "#3C3C43";
const INK_3    = "#8E8E93";
const SURFACE  = "#FFFFFF";
const SURFACE_2= "#F2F2F7";
const HAIRLINE = "rgba(60,60,67,0.12)";

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Helvetica Neue", Arial, sans-serif';
const TIJUANA_CENTER = { lat: 32.5149, lng: -117.0382 };
const LIBS = ["places", "geometry"];
const MAPS_KEY   = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const COLONIAS = [
  { name: "Camino Verde",   lat: 32.4754, lng: -116.9614 },
  { name: "Las Brisas",     lat: 32.4760, lng: -116.9840 },
  { name: "Centro",         lat: 32.5310, lng: -117.0250 },
  { name: "Zona Río",       lat: 32.5260, lng: -117.0240 },
  { name: "Otay",           lat: 32.5345, lng: -116.9540 },
  { name: "Playas",         lat: 32.5300, lng: -117.1180 },
  { name: "La Mesa",        lat: 32.4860, lng: -116.9740 },
  { name: "Sánchez Taboada",lat: 32.4600, lng: -117.0200 },
];

const PROFILES = [
  { id: "silla_manual",    label: "Silla manual",    Icon: Accessibility },
  { id: "silla_electrica", label: "Silla eléctrica", Icon: Zap },
  { id: "muletas",         label: "Muletas",          Icon: Activity },
  { id: "baja_vision",     label: "Baja visión",      Icon: Eye },
];

const QUICK_DEST = [
  { label: "IMSS Clínica 20",   lat: 32.5246, lng: -117.0252 },
  { label: "Hospital General",  lat: 32.5031, lng: -117.0387 },
  { label: "Plaza Río",         lat: 32.5252, lng: -117.0306 },
  { label: "CECUT",             lat: 32.5234, lng: -117.0235 },
  { label: "UABC Tijuana",      lat: 32.4914, lng: -116.9697 },
  { label: "Palacio Municipal", lat: 32.5103, lng: -117.0173 },
];

const CATEGORIAS_DEMO = [
  "poste CFE en banqueta", "cableado informal expuesto", "banqueta rota o levantada",
  "ausencia de rampa", "desnivel banqueta-calle", "obstáculo comercial",
];

const GLOBAL_CSS = `
  @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
  @keyframes pulseRing {
    0%   { box-shadow: 0 0 0 0    rgba(179,38,30,0.45) }
    70%  { box-shadow: 0 0 0 22px rgba(179,38,30,0)    }
    100% { box-shadow: 0 0 0 0    rgba(179,38,30,0)    }
  }
  * { -webkit-tap-highlight-color: transparent }
  body { margin: 0; font-family: ${FONT}; color: ${INK}; background: ${SURFACE_2}; }
  button, input, textarea, select { font-family: inherit; }
  .tap { transition: transform 120ms cubic-bezier(.4,0,.2,1), opacity 120ms; }
  .tap:active { transform: scale(0.97); opacity: 0.88; }
  .glass {
    background: rgba(255,255,255,0.72);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid rgba(255,255,255,0.6);
  }
  ::-webkit-scrollbar { width: 6px; height: 6px }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 3px }
  /* Apple Places Autocomplete fix */
  .pac-container { border-radius: 12px; margin-top: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); font-family: ${FONT}; }
  .pac-item { padding: 8px 12px; }
`;

// ── ROOT ────────────────────────────────────────────────────────────────────
export default function App() {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAPS_KEY, libraries: LIBS });
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("map");
  const [adminMode, setAdminMode] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [reports, setReports] = useState(() => loadLocal());
  const [preloadedDest, setPreloadedDest] = useState(null); // 🆕 destino del link de WhatsApp

  // Leer query params del link que manda el WhatsApp Bot
  // Formato: ?to=lat,lng&dest=Nombre&from=lat,lng  (con destino específico)
  //          ?route=1                              (solo abrir en pestaña ruta)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");
    const dest = params.get("dest");
    const from = params.get("from");
    const routeOnly = params.get("route");

    if (to) {
      const [lat, lng] = to.split(",").map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        const destObj = { lat, lng, name: dest || "Destino" };
        let originObj = null;
        if (from) {
          const [fLat, fLng] = from.split(",").map(Number);
          if (!isNaN(fLat) && !isNaN(fLng)) originObj = { lat: fLat, lng: fLng };
        }
        setPreloadedDest({ dest: destObj, origin: originObj, autoGPS: !originObj });
        setProfile("silla_manual");
        setTab("route");
      }
    } else if (routeOnly === "1") {
      // Llegó del bot pero sin destino — saltar a Ruta y pedir GPS
      setPreloadedDest({ autoGPS: true });
      setProfile("silla_manual");
      setTab("route");
    }
  }, []);

  useEffect(() => {
    ensureAnonymousAuth().then(() => {
      subscribeReports((remote) => {
        if (remote.length) { setReports(remote); saveLocal(remote); }
      });
    }).catch(console.error);
  }, []);

  useEffect(() => { saveLocal(reports); }, [reports]);

  if (!isLoaded) return (<><style>{GLOBAL_CSS}</style><Center><Loader2 size={32} color={B} style={{ animation: "spin 1s linear infinite" }} /></Center></>);
  if (!profile)  return (<><style>{GLOBAL_CSS}</style><Welcome onSelect={setProfile} onTutorial={() => setShowTutorial(true)} />{showTutorial && <TutorialSheet onClose={() => setShowTutorial(false)} />}</>);
  if (adminMode) return (<><style>{GLOBAL_CSS}</style><AdminPanel reports={reports} setReports={setReports} onExit={() => setAdminMode(false)} /></>);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Layout profile={profile} tab={tab} setTab={setTab} onAdmin={() => setAdminMode(true)} onTutorial={() => setShowTutorial(true)}>
        {tab === "map"       && <MapView reports={reports} />}
        {tab === "report"    && <ReportView reports={reports} setReports={setReports} />}
        {tab === "voice"     && <VoiceView reports={reports} setReports={setReports} />}
        {tab === "route"     && <RouteView profile={profile} reports={reports} preloadedDest={preloadedDest} />}
        {tab === "assistant" && <AssistantView reports={reports} />}
      </Layout>
      {showTutorial && <TutorialSheet onClose={() => setShowTutorial(false)} />}
    </>
  );
}

// ── WELCOME ────────────────────────────────────────────────────────────────
function Welcome({ onSelect, onTutorial }) {
  const [pick, setPick] = useState(null);
  return (
    <Frame>
      <div style={{
        position: "relative",
        background: `linear-gradient(160deg, ${B} 0%, ${B_DARK} 100%)`,
        color: "#fff", padding: "56px 24px 80px", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: -40, left: -30, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.12), transparent 60%)" }} />
        <div style={{ position: "relative", animation: "fadeUp 500ms ease" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", display: "grid", placeItems: "center", marginBottom: 20 }}>
            <Accessibility size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 700, margin: 0, letterSpacing: -0.5, lineHeight: 1.1 }}>Tijuana<br/>Accesible</h1>
          <p style={{ opacity: 0.78, fontSize: 14, margin: "10px 0 0", fontWeight: 500 }}>FITD 2026 · ADBC · Google Cloud</p>
        </div>
      </div>

      <div style={{ background: SURFACE_2, marginTop: -28, borderRadius: "28px 28px 0 0", padding: "28px 20px 24px", flex: 1, position: "relative" }}>
        <div style={{ width: 36, height: 5, background: "rgba(60,60,67,0.18)", borderRadius: 3, margin: "0 auto 20px" }} />

        <h2 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 6px", letterSpacing: -0.3 }}>¿Cómo te mueves hoy?</h2>
        <p style={{ fontSize: 13, color: INK_3, margin: "0 0 18px", lineHeight: 1.4 }}>
          Tu perfil ajusta cómo la app pondera barreras. Sin login. Sin datos personales.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, animation: "fadeUp 600ms ease 100ms both" }}>
          {PROFILES.map(({ id, label, Icon }) => {
            const active = pick === id;
            return (
              <button key={id} className="tap" onClick={() => setPick(id)} style={{
                padding: 18, borderRadius: 16, cursor: "pointer",
                border: active ? `2px solid ${B}` : "1px solid rgba(60,60,67,0.1)",
                background: active ? "#fff" : "rgba(255,255,255,0.85)",
                boxShadow: active ? `0 4px 16px rgba(105,28,50,0.18)` : "0 1px 2px rgba(0,0,0,0.04)",
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12,
                textAlign: "left", minHeight: 100,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? B : B_TINT, display: "grid", placeItems: "center", transition: "background 200ms" }}>
                  <Icon size={20} color={active ? "#fff" : B} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{label}</span>
              </button>
            );
          })}
        </div>

        <button className="tap" disabled={!pick} onClick={() => onSelect(pick)} style={{
          width: "100%", background: pick ? B : "rgba(60,60,67,0.18)", color: "#fff", border: "none",
          borderRadius: 14, padding: "16px 18px", fontSize: 16, fontWeight: 600,
          cursor: pick ? "pointer" : "not-allowed", marginTop: 18,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: pick ? "0 8px 24px rgba(105,28,50,0.28)" : "none",
          transition: "background 200ms, box-shadow 200ms",
        }}>
          <Lock size={14} /> Continuar sin registro <ArrowRight size={16} />
        </button>

        <button className="tap" onClick={onTutorial} style={{
          width: "100%", background: "transparent", border: "none",
          padding: "12px 0 0", color: B, fontSize: 13, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <HelpCircle size={14} /> ¿Primera vez? Ver tutorial rápido
        </button>

        <p style={{ fontSize: 11, color: INK_3, textAlign: "center", margin: "14px 0 0" }}>
          Cumple NIST AI RMF · EU AI Act Art. 13/14
        </p>
      </div>
    </Frame>
  );
}

// ── LAYOUT ─────────────────────────────────────────────────────────────────
function Layout({ profile, tab, setTab, onAdmin, onTutorial, children }) {
  const p = PROFILES.find((x) => x.id === profile);
  const [pressTimer, setPressTimer] = useState(null);
  const onPressStart = () => setPressTimer(setTimeout(() => {
    const pwd = prompt("Acceso institucional SEDEBI:");
    if (pwd === "sedebi2026") onAdmin();
    else if (pwd) alert("Acceso denegado");
  }, 1500));
  const onPressEnd = () => { clearTimeout(pressTimer); setPressTimer(null); };

  const titles = { map: "Mapa", report: "Reportar", voice: "Voz", route: "Ruta accesible", assistant: "Asistente" };

  return (
    <Frame>
      <div style={{
        background: "rgba(255,255,255,0.85)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)", backdropFilter: "saturate(180%) blur(20px)",
        borderBottom: `1px solid ${HAIRLINE}`, padding: "10px 16px 12px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div onMouseDown={onPressStart} onMouseUp={onPressEnd} onMouseLeave={onPressEnd}
          onTouchStart={onPressStart} onTouchEnd={onPressEnd}
          style={{ cursor: "pointer", userSelect: "none", flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: INK, letterSpacing: -0.3 }}>{titles[tab]}</div>
          <div style={{ fontSize: 11, color: INK_3, marginTop: 1 }}>Tijuana Accesible · FITD 2026</div>
        </div>
        <button onClick={onTutorial} className="tap" style={{
          background: "transparent", border: "none", padding: 6, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", color: INK_3,
        }}>
          <HelpCircle size={20} />
        </button>
        {p && (
          <span style={{
            background: B_TINT, color: B, borderRadius: 999, padding: "6px 11px",
            fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5,
          }}>
            <p.Icon size={12} /> {p.label}
          </span>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: SURFACE_2 }}>
        {children}
      </div>

      <div style={{
        background: "rgba(255,255,255,0.85)",
        WebkitBackdropFilter: "saturate(180%) blur(24px)", backdropFilter: "saturate(180%) blur(24px)",
        borderTop: `1px solid ${HAIRLINE}`, display: "flex",
        paddingBottom: "max(6px, env(safe-area-inset-bottom))",
      }}>
        {[
          { id: "map",       Icon: MapIcon,       label: "Mapa" },
          { id: "report",    Icon: Camera,        label: "Foto" },
          { id: "voice",     Icon: Mic,           label: "Voz" },
          { id: "route",     Icon: Navigation,    label: "Ruta" },
          { id: "assistant", Icon: MessageCircle, label: "Ayuda" },
        ].map(({ id, Icon, label }) => {
          const active = tab === id;
          return (
            <button key={id} className="tap" onClick={() => setTab(id)} style={{
              flex: 1, background: "none", border: "none", padding: "8px 0 6px", cursor: "pointer",
              color: active ? B : INK_3, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}>
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.1 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </Frame>
  );
}

// ── MAP VIEW · ahora con CAPAS OSM TOGGLE ──────────────────────────────────
function MapView({ reports }) {
  const colonias = useMemo(() => computeColoniaScores(reports), [reports]);
  const [showOSM, setShowOSM] = useState(true);
  const [mapInstance, setMapInstance] = useState(null);

  // Render de features OSM en el mapa (líneas y puntos) usando google.maps nativos
  useEffect(() => {
    if (!mapInstance || !showOSM) return;
    const overlays = [];
    const SCORE_COLOR = { g: "#388E3C", b: "#D32F2F", n: "rgba(60,60,67,0.45)", l: "#F57C00" };

    osmData.features.forEach((feat) => {
      const { s, k } = feat.properties;
      // Saltarse muchos neutrales para no saturar (ya están muestreados, pero por si acaso)
      if (s === "n" && (k === "crossing" || k === "footway") && Math.random() < 0.4) return;
      const color = SCORE_COLOR[s] || "#888";
      if (feat.geometry.type === "LineString") {
        const path = feat.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        const poly = new window.google.maps.Polyline({
          path, strokeColor: color,
          strokeWeight: s === "b" ? 3.5 : (s === "g" ? 2.5 : 1.5),
          strokeOpacity: s === "n" ? 0.4 : 0.85,
          map: mapInstance, clickable: false, zIndex: s === "n" ? 1 : 2,
        });
        overlays.push(poly);
      } else if (feat.geometry.type === "Point") {
        const [lng, lat] = feat.geometry.coordinates;
        const circle = new window.google.maps.Circle({
          center: { lat, lng }, radius: k === "bus_stop" ? 18 : (k === "kerb" ? 8 : 6),
          fillColor: color, fillOpacity: 0.85, strokeColor: color, strokeWeight: 1,
          strokeOpacity: 1, map: mapInstance, clickable: false, zIndex: 3,
        });
        overlays.push(circle);
      }
    });

    return () => { overlays.forEach(o => o.setMap(null)); };
  }, [mapInstance, showOSM]);

  return (
    <div style={{ flex: 1, position: "relative" }}>
      <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={TIJUANA_CENTER} zoom={12}
        options={{ disableDefaultUI: true, zoomControl: true, styles: APPLE_MAP_STYLE }}
        onLoad={setMapInstance}>
        {colonias.map((c) => (
          <CircleF key={c.name} center={{ lat: c.lat, lng: c.lng }} radius={600 + c.count * 30}
            options={{ fillColor: scoreColor(c.score), fillOpacity: 0.22, strokeColor: scoreColor(c.score), strokeWeight: 2, strokeOpacity: 0.6 }} />
        ))}
        {reports.map((r, i) => (
          <MarkerF key={r.id || i} position={{ lat: r.lat, lng: r.lng }}
            label={{ text: String(r.severidad || "!"), color: "#fff", fontWeight: "700", fontSize: "11px" }} />
        ))}
      </GoogleMap>

      {/* KPI flotante */}
      <div className="glass" style={{
        position: "absolute", top: 12, left: 12, right: 12,
        borderRadius: 14, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        display: "flex", alignItems: "center", gap: 10, fontSize: 13,
      }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: B_TINT, display: "grid", placeItems: "center" }}>
          <AlertTriangle size={16} color={B} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, color: INK, fontSize: 15 }}>{reports.length} barreras · {osmData.features.length.toLocaleString()} elementos OSM</span>
          <span style={{ fontSize: 11, color: INK_3 }}>{colonias.length} colonias · datos OpenStreetMap</span>
        </div>
        <button onClick={() => setShowOSM(s => !s)} className="tap" style={{
          background: showOSM ? B : "rgba(60,60,67,0.08)", color: showOSM ? "#fff" : INK_2,
          border: "none", borderRadius: 9, padding: "6px 10px", fontSize: 11, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
        }}>
          <Layers size={12} /> OSM
        </button>
      </div>

      {/* Legend */}
      <div className="glass" style={{
        position: "absolute", bottom: 14, left: 12,
        borderRadius: 12, padding: "10px 12px",
        boxShadow: "0 6px 16px rgba(0,0,0,0.08)", fontSize: 11,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: INK, fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase" }}>
          Capas
        </div>
        {[
          ["#388E3C", "Accesible (banqueta, rampa, táctil)"],
          ["#D32F2F", "Barrera (escaleras, kerb, sin banqueta)"],
          ["#F57C00", "Limitado"],
          [B, "Reporte ciudadano"],
        ].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 7, margin: "3px 0", color: INK_2 }}>
            <span style={{ width: 10, height: 10, background: c, borderRadius: 3, display: "inline-block" }} />
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── REPORT VIEW ────────────────────────────────────────────────────────────
function ReportView({ reports, setReports }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handle = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setResult(null);
    try {
      const gps = await getGps();
      const classification = await classifyBarrierPhoto(file);
      const local = { id: Date.now(), lat: gps.lat, lng: gps.lng, ...classification, createdAt: new Date().toISOString() };
      setReports((prev) => [local, ...prev]);
      setResult({ ...classification, gps });
      setBusy(false);
      createReport({ file, gps, classification, valid: true }).catch((err) => console.error("Save:", err));
    } catch (err) { alert("Error: " + err.message); setBusy(false); }
  }, [setReports]);

  return (
    <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
      <SectionTitle Icon={Camera} title="Reportar con foto" subtitle="Gemini Vision clasifica barrera, severidad y perfiles afectados." />

      <button onClick={() => fileRef.current?.click()} className="tap" style={{
        width: "100%", marginTop: 20, padding: 0, border: "none", cursor: "pointer",
        borderRadius: 20, overflow: "hidden",
        background: `linear-gradient(160deg, ${B} 0%, ${B_DARK} 100%)`,
        boxShadow: "0 12px 32px rgba(105,28,50,0.32)", position: "relative",
      }}>
        <div style={{ position: "absolute", top: -40, right: -30, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)" }} />
        <div style={{ padding: "28px 24px", color: "#fff", textAlign: "left", position: "relative" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.25)", display: "grid", placeItems: "center", marginBottom: 14 }}>
            <Camera size={26} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Tomar foto</div>
          <div style={{ fontSize: 13, opacity: 0.78, marginTop: 4 }}>O elegir desde galería</div>
        </div>
      </button>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handle} style={{ display: "none" }} />

      <InfoNote Icon={Eye}>
        Gemini difumina caras y placas. Solo se guarda imagen procesada, GPS y clasificación.
      </InfoNote>

      {busy && <Overlay><Loader2 size={28} color={B} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} /><span>Analizando con Gemini Vision…</span></Overlay>}
      {result && <ResultCard result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

// ── VOICE VIEW ─────────────────────────────────────────────────────────────
function VoiceView({ reports, setReports }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const recogRef = useRef(null);
  const supported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR(); r.lang = "es-MX"; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => setTranscript(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recogRef.current = r; r.start(); setListening(true);
  };
  const stop = () => { recogRef.current?.stop(); setListening(false); };

  const process = async () => {
    if (!transcript.trim()) return alert("Habla o escribe primero.");
    setBusy(true);
    try {
      const gps = await getGps();
      const extracted = await extractBarrierFromText(transcript);
      const classification = {
        categoria: extracted.categoria || "otro",
        severidad: extracted.severidad || 3,
        perfiles_afectados: extracted.perfiles_afectados || [],
        descripcion_accesible: extracted.resumen || transcript,
        confianza: 0.85,
      };
      const local = { id: Date.now(), lat: gps.lat, lng: gps.lng, ...classification, createdAt: new Date().toISOString() };
      setReports((prev) => [local, ...prev]);
      setResult({ ...classification, gps });
      setBusy(false);
      createReport({ gps, classification, valid: true }).catch((err) => console.error("Save:", err));
      setTranscript("");
    } catch (err) { alert("Error: " + err.message); setBusy(false); }
  };

  return (
    <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
      <SectionTitle Icon={Mic} title="Reportar con voz" subtitle="Para baja visión o quien no puede escribir. Habla — Gemini estructura el reporte." />

      {!supported && (
        <div style={{ padding: 12, background: "#FFF7E6", borderRadius: 12, border: "1px solid #FFE0B2", fontSize: 12, color: "#B26500", marginTop: 14 }}>
          Usa Chrome para reconocimiento de voz, o escribe abajo.
        </div>
      )}

      <div style={{ textAlign: "center", margin: "28px 0 16px" }}>
        <button onClick={listening ? stop : start} className="tap" style={{
          width: 104, height: 104, borderRadius: "50%", border: "none",
          background: listening ? `linear-gradient(160deg, ${RED} 0%, #8E1B14 100%)` : `linear-gradient(160deg, ${B} 0%, ${B_DARK} 100%)`,
          color: "#fff", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          boxShadow: listening ? "0 0 0 12px rgba(179,38,30,0.22), 0 12px 32px rgba(179,38,30,0.35)" : "0 12px 32px rgba(105,28,50,0.35)",
          animation: listening ? "pulseRing 1.6s infinite" : "none",
        }}>
          {listening ? <MicOff size={40} /> : <Mic size={40} />}
        </button>
        <div style={{ marginTop: 12, fontSize: 13, color: INK_2, fontWeight: 500 }}>
          {listening ? "Escuchando…" : "Toca para hablar"}
        </div>
      </div>

      <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder='Ej: "Hay un poste tirado en la banqueta de mi casa."'
        style={{ width: "100%", minHeight: 96, padding: 14, border: "1px solid rgba(60,60,67,0.18)", borderRadius: 14, fontSize: 14, fontFamily: FONT, background: "#fff", color: INK, boxSizing: "border-box", outline: "none", resize: "vertical" }} />

      <button onClick={process} disabled={!transcript.trim() || busy} className="tap" style={{ ...primaryBtn(transcript.trim() && !busy), marginTop: 12 }}>
        <Bot size={16} style={{ marginRight: 8 }} />Procesar con Gemini
      </button>

      {busy && <Overlay><Loader2 size={28} color={B} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} /><span>Extrayendo con Gemini…</span></Overlay>}
      {result && <ResultCard result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

// ── ROUTE VIEW · con Places Autocomplete + Elevation + Navegación turn-by-turn ──
function RouteView({ profile, reports, preloadedDest }) {
  const originRef = useRef(null);
  const destRef = useRef(null);
  const acOriginRef = useRef(null);
  const acDestRef = useRef(null);
  const mapRef = useRef(null);
  const polysRef = useRef([]);

  const [origin, setOrigin] = useState(null);
  const [dest, setDest] = useState(null);
  const [activeQuick, setActiveQuick] = useState({ origin: null, dest: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [accPath, setAccPath] = useState([]);
  const [stdPath, setStdPath] = useState([]);
  const [tab, setTab] = useState("accessible");
  const [navigating, setNavigating] = useState(false);
  const [fromWhatsApp, setFromWhatsApp] = useState(false);

  // Pre-cargar destino que llegó desde el bot de WhatsApp
  useEffect(() => {
    if (!preloadedDest) return;
    const { dest: d, origin: o, autoGPS } = preloadedDest;
    if (d) {
      setDest(d);
      if (destRef.current) destRef.current.value = d.name;
      setFromWhatsApp(true);
    }
    if (o) {
      setOrigin(o);
      if (originRef.current) originRef.current.value = "Origen del link";
    } else if (autoGPS) {
      // Auto-pedir ubicación
      setFromWhatsApp(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            if (originRef.current) originRef.current.value = "Mi ubicación";
          },
          () => setError("Permite la ubicación para autocompletar tu origen."),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    }
  }, [preloadedDest]);

  useEffect(() => {
    const opts = { componentRestrictions: { country: "mx" }, fields: ["geometry", "formatted_address", "name"] };
    if (originRef.current && !acOriginRef.current) {
      const ac = new window.google.maps.places.Autocomplete(originRef.current, opts);
      ac.addListener("place_changed", () => {
        const p = ac.getPlace();
        if (p?.geometry?.location) {
          setOrigin({ lat: p.geometry.location.lat(), lng: p.geometry.location.lng() });
          setActiveQuick(q => ({ ...q, origin: null }));
        }
      });
      acOriginRef.current = ac;
    }
    if (destRef.current && !acDestRef.current) {
      const ac = new window.google.maps.places.Autocomplete(destRef.current, opts);
      ac.addListener("place_changed", () => {
        const p = ac.getPlace();
        if (p?.geometry?.location) {
          setDest({ lat: p.geometry.location.lat(), lng: p.geometry.location.lng() });
          setActiveQuick(q => ({ ...q, dest: null }));
        }
      });
      acDestRef.current = ac;
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    polysRef.current.forEach(p => p.setMap(null));
    polysRef.current = [];
    const isAcc = tab === "accessible";
    if (accPath.length) {
      polysRef.current.push(new window.google.maps.Polyline({
        path: accPath, strokeColor: GREEN, strokeWeight: isAcc ? 7 : 4, strokeOpacity: isAcc ? 0.95 : 0.4, map: mapRef.current, zIndex: isAcc ? 5 : 3,
      }));
    }
    if (stdPath.length) {
      polysRef.current.push(new window.google.maps.Polyline({
        path: stdPath, strokeColor: "#D32F2F", strokeWeight: !isAcc ? 7 : 4, strokeOpacity: !isAcc ? 0.95 : 0.4, map: mapRef.current, zIndex: !isAcc ? 5 : 3,
      }));
    }
    if (accPath.length || stdPath.length) {
      const bounds = new window.google.maps.LatLngBounds();
      [...accPath, ...stdPath].forEach(p => bounds.extend(p));
      mapRef.current.fitBounds(bounds, { top: 60, right: 30, bottom: 30, left: 30 });
    }
  }, [accPath, stdPath, tab]);

  const useMyLoc = () => {
    if (!navigator.geolocation) return setError("Geolocalización no disponible.");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (originRef.current) originRef.current.value = "Mi ubicación";
        setActiveQuick(q => ({ ...q, origin: null }));
      },
      () => setError("No se pudo obtener tu ubicación.")
    );
  };

  const pickQuick = (q, field) => {
    if (field === "origin") {
      if (activeQuick.origin === q.label) {
        if (originRef.current) { originRef.current.value = ""; }
        setOrigin(null); setActiveQuick(p => ({ ...p, origin: null }));
      } else {
        if (originRef.current) originRef.current.value = q.label;
        setOrigin({ lat: q.lat, lng: q.lng }); setActiveQuick(p => ({ ...p, origin: q.label }));
      }
    } else {
      if (activeQuick.dest === q.label) {
        if (destRef.current) { destRef.current.value = ""; }
        setDest(null); setActiveQuick(p => ({ ...p, dest: null }));
      } else {
        if (destRef.current) destRef.current.value = q.label;
        setDest({ lat: q.lat, lng: q.lng }); setActiveQuick(p => ({ ...p, dest: q.label }));
      }
    }
  };

  const calc = async () => {
    if (!origin || !dest) return setError("Ingresa origen y destino.");
    setError(null); setBusy(true);
    try {
      const routes = await computeRoutes(origin, dest, "WALK");
      if (!routes.length) throw new Error("Sin rutas disponibles.");
      let slope0 = 0;
      try {
        const pts = extractPath(routes[0]).filter((_, i) => i % 5 === 0);
        if (pts.length >= 2) {
          const elev = await elevationProfile(pts);
          slope0 = maxSlopePct(elev, routes[0].distanceMeters);
        }
      } catch (e) { console.warn("Elevation fail:", e); }
      const ranked = rankAccessibleRoutes(routes, reports, profile, { 0: slope0 });
      const acc = ranked[0];
      const std = ranked.length > 1 ? ranked[ranked.length - 1] : ranked[0];
      setAccPath(extractPath(acc.route));
      setStdPath(extractPath(std.route));
      setStats({
        acc: { time: Math.round(acc.durationSec / 60), dist: (acc.distanceMeters / 1000).toFixed(1), severas: acc.severasEnRuta, slope: acc.slopePct },
        std: { time: Math.round(std.durationSec / 60), dist: (std.distanceMeters / 1000).toFixed(1), severas: std.severasEnRuta, slope: std.slopePct },
      });
      setTab("accessible");
    } catch (e) {
      setError(e.message || "Error al calcular ruta.");
    } finally {
      setBusy(false);
    }
  };

  // Modo navegación turn-by-turn fullscreen
  if (navigating) {
    return (
      <NavigationMode
        origin={origin}
        dest={dest}
        path={tab === "accessible" ? accPath : stdPath}
        reports={reports}
        onClose={() => setNavigating(false)}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: 14, background: SURFACE_2, borderBottom: `1px solid ${HAIRLINE}` }}>
        <div className="glass" style={{ borderRadius: 14, padding: 12, marginBottom: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <label style={{ fontSize: 10, color: INK_3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 4 }}>
            <MapPin size={11} /> Origen
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <input ref={originRef} placeholder="Buscar dirección..."
              style={{ flex: 1, border: "none", fontSize: 15, fontWeight: 500, color: INK, background: "transparent", outline: "none", fontFamily: FONT, padding: "4px 0" }} />
            <button onClick={useMyLoc} className="tap" style={{
              background: B_TINT, color: B, border: "none", borderRadius: 8, padding: "6px 10px",
              fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
            }}>
              <Crosshair size={12} /> Aquí
            </button>
          </div>
        </div>

        <div className="glass" style={{ borderRadius: 14, padding: 12, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <label style={{ fontSize: 10, color: INK_3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 4 }}>
            <Navigation size={11} /> Destino
          </label>
          <input ref={destRef} placeholder="¿A dónde vas?"
            style={{ width: "100%", border: "none", fontSize: 15, fontWeight: 500, color: INK, background: "transparent", outline: "none", fontFamily: FONT, padding: "4px 0 0", marginTop: 4, boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "0 -14px", padding: "0 14px 4px" }}>
          {QUICK_DEST.map((q) => {
            const active = activeQuick.dest === q.label;
            return (
              <button key={q.label} onClick={() => pickQuick(q, "dest")} className="tap" style={{
                flexShrink: 0, fontSize: 12, padding: "7px 11px",
                borderRadius: 14, border: active ? `1px solid ${B}` : `1px solid ${HAIRLINE}`,
                background: active ? B : "#fff", color: active ? "#fff" : INK_2,
                cursor: "pointer", fontWeight: 600,
              }}>
                {q.label}
              </button>
            );
          })}
        </div>

        <button onClick={calc} disabled={busy || !origin || !dest} className="tap"
          style={{ ...primaryBtn(!busy && origin && dest), marginTop: 10 }}>
          {busy ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />Calculando rutas y pendiente…</> : <><Navigation size={14} style={{ marginRight: 6 }} />Comparar rutas</>}
        </button>

        {fromWhatsApp && (
          <div style={{
            background: "#E7F8EE", border: "1px solid #A8D5B5", borderRadius: 12,
            padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#1A6B3A",
            display: "flex", alignItems: "center", gap: 8, fontWeight: 600,
          }}>
            <span style={{ fontSize: 18 }}>💬</span>
            Ruta desde WhatsApp — destino pre-cargado. Solo toca <b>Aquí</b> para origen y <b>Comparar rutas</b>.
          </div>
        )}
        {error && <div style={{ marginTop: 8, padding: 10, background: "#FFEBEE", color: RED, borderRadius: 10, fontSize: 12, fontWeight: 500 }}>{error}</div>}
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={origin || TIJUANA_CENTER} zoom={13}
          options={{ disableDefaultUI: true, zoomControl: true, styles: APPLE_MAP_STYLE }}
          onLoad={(m) => { mapRef.current = m; }}>
          {origin && <MarkerF position={origin} label={{ text: "A", color: "#fff", fontWeight: "700" }} />}
          {dest   && <MarkerF position={dest}   label={{ text: "B", color: "#fff", fontWeight: "700" }} />}
          {reports.filter((r) => (r.severidad || 0) >= 4).map((r, i) => (
            <MarkerF key={"b" + i} position={{ lat: r.lat, lng: r.lng }} label={{ text: "!", color: "#fff", fontWeight: "700" }} />
          ))}
        </GoogleMap>
      </div>

      {stats && (
        <div style={{ padding: 14, background: SURFACE_2, borderTop: `1px solid ${HAIRLINE}` }}>
          <div style={{ display: "flex", background: "rgba(60,60,67,0.08)", borderRadius: 10, padding: 3, marginBottom: 10 }}>
            {[
              { id: "accessible", label: "Accesible", color: GREEN },
              { id: "standard",   label: "Estándar",  color: "#D32F2F" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className="tap" style={{
                flex: 1, padding: "8px 10px", border: "none", borderRadius: 8,
                background: tab === t.id ? "#fff" : "transparent",
                color: tab === t.id ? t.color : INK_2,
                fontWeight: 600, fontSize: 13, cursor: "pointer",
                boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}>{t.label}</button>
            ))}
          </div>

          {(() => {
            const d = stats[tab === "accessible" ? "acc" : "std"];
            const color = tab === "accessible" ? GREEN : "#D32F2F";
            return (
              <div className="glass" style={{ borderRadius: 14, padding: 14, borderLeft: `4px solid ${color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      {tab === "accessible" ? "Ruta accesible" : "Ruta estándar"}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: INK, letterSpacing: -0.5 }}>
                      {d.time} min · <span style={{ color: INK_3, fontSize: 18 }}>{d.dist} km</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: INK_2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {d.severas > 0 ? <AlertTriangle size={11} color="#D32F2F" /> : <Check size={11} color={GREEN} />}
                      <b>{d.severas}</b> barreras severas
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <TrendingUp size={11} color={d.slope > 8 ? "#D32F2F" : d.slope > 5 ? ORANGE : GREEN} />
                      <b>{d.slope}%</b> pendiente máx.
                    </div>
                  </div>
                </div>

                <button onClick={() => setNavigating(true)} className="tap" style={{
                  width: "100%", marginTop: 14, padding: "12px 16px",
                  background: color, color: "#fff", border: "none", borderRadius: 12,
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: `0 8px 20px ${color}40`,
                }}>
                  <Play size={16} fill="#fff" /> Iniciar navegación
                </button>

                {/* Deeplinks a apps externas de mapas */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: INK_3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                    O abre en otra app
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {/* Moovit — DESHABILITADO */}
                    <button
                      onClick={() => alert("Feature en construcción.\n\nMoovit aún no tiene cobertura de transporte público accesible en Tijuana. Lo activaremos cuando el SITT publique GTFS abierto.")}
                      className="tap"
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: 10,
                        border: `1px solid ${HAIRLINE}`, background: SURFACE_2,
                        color: INK_3, fontSize: 12, fontWeight: 600, textAlign: "center",
                        cursor: "pointer", opacity: 0.65,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      }}
                    >
                      <Bus size={18} strokeWidth={1.8} />
                      <span>Moovit</span>
                    </button>

                    {/* Google Maps */}
                    <a
                      href={origin
                        ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=walking`
                        : `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=walking`}
                      target="_blank" rel="noopener noreferrer" className="tap"
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: 10,
                        border: `1px solid ${HAIRLINE}`, background: "#fff",
                        color: INK, fontSize: 12, fontWeight: 600, textAlign: "center",
                        textDecoration: "none", cursor: "pointer",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      }}
                    >
                      <Globe size={18} strokeWidth={1.8} />
                      <span>Google Maps</span>
                    </a>

                    {/* Apple Maps */}
                    <a
                      href={origin
                        ? `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${dest.lat},${dest.lng}&dirflg=w`
                        : `https://maps.apple.com/?daddr=${dest.lat},${dest.lng}&dirflg=w`}
                      target="_blank" rel="noopener noreferrer" className="tap"
                      style={{
                        flex: 1, padding: "10px 8px", borderRadius: 10,
                        border: `1px solid ${HAIRLINE}`, background: "#fff",
                        color: INK, fontSize: 12, fontWeight: 600, textAlign: "center",
                        textDecoration: "none", cursor: "pointer",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      }}
                    >
                      <Apple size={18} strokeWidth={1.8} />
                      <span>Apple Maps</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── ASSISTANT VIEW// ── ASSISTANT VIEW (sin cambios) ───────────────────────────────────────────
function AssistantView({ reports }) {
  const [msgs, setMsgs] = useState([
    { role: "assistant", text: "Hola, soy tu asistente de accesibilidad en Tijuana. Puedo decirte qué barreras hay cerca, sugerir rutas accesibles o ayudarte a encontrar lugares con rampas, baños accesibles, transporte SITT, etc." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState(null);
  const [listeningAI, setListeningAI] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const recogAIRef = useRef(null);
  const endRef = useRef(null);

  const startVoiceInput = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Usa Chrome para reconocimiento de voz.");
    const r = new SR(); r.lang = "es-MX"; r.interimResults = false;
    r.onresult = (e) => {
      const txt = e.results[0][0].transcript;
      setInput(txt);
      setTimeout(() => send(txt), 300);
    };
    r.onerror = () => setListeningAI(false);
    r.onend = () => setListeningAI(false);
    recogAIRef.current = r; r.start(); setListeningAI(true);
  };

  const speakMsg = (text, idx) => {
    if (speakingIdx === idx) { window.speechSynthesis?.cancel(); setSpeakingIdx(null); return; }
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-MX"; u.rate = 1.0;
    u.onend = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(u);
  };

  useEffect(() => { getGps().then(setGps); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (txt) => {
    const q = (txt || input).trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput(""); setBusy(true);
    try {
      let context = "";
      if (gps) {
        context += `\nUbicación actual del usuario: lat ${gps.lat.toFixed(4)}, lng ${gps.lng.toFixed(4)}.`;
        const cerca = reports.map(r => ({ ...r, d: distH(gps, r) })).filter(r => r.d < 1500 && r.lat && r.lng).sort((a,b) => a.d - b.d).slice(0, 5);
        if (cerca.length) context += `\nBarreras reportadas a menos de 1.5km:\n` + cerca.map((r, i) => `${i+1}. ${r.categoria} (severidad ${r.severidad}/5), a ${Math.round(r.d)}m: ${r.descripcion || r.descripcion_accesible || ""}`).join("\n");
        context += `\nLugares de referencia en Tijuana: ${QUICK_DEST.map(d => d.label).join(", ")}.`;
      }
      const res = await fetch("https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text:
`Eres el asistente de accesibilidad de Tijuana Accesible (app del Ayuntamiento de Tijuana). Tienes acceso a la ubicación del usuario y a los reportes ciudadanos de barreras. Responde en español, breve y útil. Si el usuario pregunta cómo llegar a un lugar, sugiere la pestaña "Ruta" de la app — ahí calculamos la ruta accesible certificada con pendiente real y barreras evitadas, y también ofrecemos abrir directo en SITT (transporte público accesible de Tijuana), Google Maps o Apple Maps. Si pregunta dónde reportar algo, sugiere las pestañas "Foto" o "Voz". Da datos concretos con distancia cuando puedas. La troncal del SITT (Centro-Insurgentes, 47 estaciones) es la única línea de transporte accesible de Tijuana (rampas, piso táctil, abordaje a nivel). Las calafias NO son accesibles.
${context}
Pregunta del usuario: "${q}"` }] }] }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "assistant", text: data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta." }]);
    } catch (err) { setMsgs((m) => [...m, { role: "assistant", text: "Error: " + err.message }]); }
    setBusy(false);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {!gps && (
        <div style={{ padding: "10px 14px", background: "#FFF7E6", borderBottom: "1px solid #FFE0B2", fontSize: 12, color: "#B26500", display: "flex", alignItems: "center", gap: 6 }}>
          <MapPin size={12} /> Esperando tu ubicación para dar respuestas precisas…
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", background: SURFACE_2 }}>
        {msgs.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", margin: "6px 0", alignItems: "flex-end", gap: 6 }}>
              {!isUser && <div style={{ width: 28, height: 28, borderRadius: "50%", background: B_TINT, display: "grid", placeItems: "center", flexShrink: 0 }}><Bot size={14} color={B} /></div>}
              <div style={{ maxWidth: "76%", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{
                  padding: "9px 14px",
                  borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  fontSize: 14, lineHeight: 1.45,
                  background: isUser ? B : "#fff", color: isUser ? "#fff" : INK,
                  boxShadow: isUser ? "0 2px 8px rgba(105,28,50,0.18)" : "0 1px 2px rgba(0,0,0,0.06)",
                  whiteSpace: "pre-wrap",
                  border: isUser ? "none" : "1px solid rgba(60,60,67,0.06)",
                }}>{m.text}</div>
                {!isUser && (
                  <button onClick={() => speakMsg(m.text, i)} className="tap" style={{
                    alignSelf: "flex-start", background: "transparent",
                    border: `1px solid ${HAIRLINE}`, borderRadius: 999, padding: "3px 9px",
                    fontSize: 11, color: speakingIdx === i ? B : INK_3, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4, fontWeight: 500,
                    outline: speakingIdx === i ? `1px solid ${B}` : "none",
                  }}>
                    <Volume2 size={11} /> {speakingIdx === i ? "Detener" : "Escuchar"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {busy && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0", paddingLeft: 34 }}>
            <Loader2 size={14} color={B} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12, color: INK_3 }}>pensando…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {msgs.length <= 1 && (
        <div style={{ display: "flex", gap: 6, padding: "0 12px 8px", overflowX: "auto" }}>
          {["¿Hay barreras cerca de mí?", "¿Cómo llego al IMSS Clínica 20?", "¿Dónde reporto una banqueta rota?", "¿Qué hace esta app?"].map((s) => (
            <button key={s} className="tap" onClick={() => send(s)} style={{ flexShrink: 0, fontSize: 12, padding: "8px 12px", borderRadius: 16, border: `1px solid ${B_TINT}`, background: "#fff", color: B, cursor: "pointer", fontWeight: 500 }}>{s}</button>
          ))}
        </div>
      )}
      <div style={{ padding: 10, borderTop: `1px solid ${HAIRLINE}`, background: "rgba(255,255,255,0.85)", WebkitBackdropFilter: "blur(20px)", backdropFilter: "blur(20px)", display: "flex", gap: 8 }}>
        <button onClick={startVoiceInput} disabled={listeningAI} className="tap" style={{
          background: listeningAI ? RED : "rgba(60,60,67,0.08)", color: listeningAI ? "#fff" : INK_2,
          border: "none", borderRadius: "50%", width: 40, height: 40,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
          animation: listeningAI ? "pulseRing 1.4s infinite" : "none",
        }}>
          <Mic size={16} />
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={listeningAI ? "Escuchando…" : "Escribe o habla tu pregunta…"}
          style={{ flex: 1, padding: "10px 14px", border: "1px solid rgba(60,60,67,0.18)", borderRadius: 22, fontSize: 14, outline: "none", background: SURFACE_2, color: INK, fontFamily: FONT }} />
        <button onClick={() => send()} disabled={busy || !input.trim()} className="tap" style={{
          background: input.trim() ? B : "rgba(60,60,67,0.2)", color: "#fff", border: "none",
          borderRadius: "50%", width: 40, height: 40, cursor: input.trim() ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Send size={16} /></button>
      </div>
    </div>
  );
}

// ── TUTORIAL SHEET (modal desde abajo, iOS style) ──────────────────────────
function TutorialSheet({ onClose }) {
  const STEPS = [
    { num: "1", title: "Elige tu perfil", text: "Silla manual, eléctrica, muletas o baja visión. El perfil ajusta cómo se ponderan barreras y pendientes." },
    { num: "2", title: "Revisa el mapa", text: "Banquetas OSM en verde (accesibles) y rojo (barreras). Círculos por colonia con Accessibility Score 0-100." },
    { num: "3", title: "Reporta una barrera", text: "Foto: Gemini Vision la clasifica. Voz: dicta lo que ves para baja visión o motricidad limitada." },
    { num: "4", title: "Pide tu ruta", text: "Origen + destino → comparas ruta accesible vs estándar con pendiente real (Elevation API) y barreras severas." },
  ];
  const USES = [
    { icon: "🏥", title: "Voy al IMSS", text: "Reviso ruta que evita banquetas rotas y pendientes >8%." },
    { icon: "📸", title: "Vi una barrera", text: "Foto + GPS anónimo. Aparece en el mapa al instante." },
    { icon: "🗺️", title: "Quiero mi colonia", text: "Veo el Accessibility Score y qué reportar primero." },
  ];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center",
      WebkitBackdropFilter: "blur(4px)", backdropFilter: "blur(4px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: SURFACE_2, width: "100%", maxWidth: 430,
        borderRadius: "20px 20px 0 0", maxHeight: "90vh", overflowY: "auto",
        animation: "slideUp 280ms cubic-bezier(.2,0,0,1)",
        paddingBottom: "max(20px, env(safe-area-inset-bottom))",
      }}>
        <div style={{ position: "sticky", top: 0, background: "rgba(242,242,247,0.92)", WebkitBackdropFilter: "blur(20px)", backdropFilter: "blur(20px)", padding: "12px 18px 14px", borderBottom: `1px solid ${HAIRLINE}` }}>
          <div style={{ width: 36, height: 5, background: "rgba(60,60,67,0.25)", borderRadius: 3, margin: "0 auto 12px" }} />
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: INK, letterSpacing: -0.3 }}>Cómo usar la app</div>
              <div style={{ fontSize: 12, color: INK_3, marginTop: 2 }}>En menos de un minuto</div>
            </div>
            <button onClick={onClose} className="tap" style={{ background: "rgba(60,60,67,0.1)", border: "none", borderRadius: "50%", width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer", color: INK_2 }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: "18px 18px 8px" }}>
          {STEPS.map((s) => (
            <div key={s.num} style={{ background: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, display: "flex", gap: 12, border: `1px solid ${HAIRLINE}` }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: B, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{s.num}</div>
              <div>
                <div style={{ fontWeight: 700, color: INK, fontSize: 14 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: INK_2, marginTop: 3, lineHeight: 1.4 }}>{s.text}</div>
              </div>
            </div>
          ))}

          <h3 style={{ color: INK, marginTop: 22, marginBottom: 10, fontSize: 16, fontWeight: 700, letterSpacing: -0.2 }}>Casos de uso</h3>
          {USES.map((u) => (
            <div key={u.title} style={{ background: B_TINT, borderRadius: 14, padding: 13, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, color: B, fontSize: 14 }}>{u.icon} {u.title}</div>
              <div style={{ fontSize: 13, color: INK_2, marginTop: 3 }}>{u.text}</div>
            </div>
          ))}

          <button onClick={onClose} className="tap" style={{ ...primaryBtn(true), marginTop: 16 }}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN PANEL ────────────────────────────────────────────────────────────
function AdminPanel({ reports, setReports, onExit }) {
  const [layout, setLayout] = useState("desktop");
  const [view, setView] = useState("dashboard");

  const seed = () => {
    if (!confirm("Cargar 60 reportes de demo en Tijuana? (Se mezclan con los reales)")) return;
    setReports((prev) => [...seedDemoReports(), ...prev]);
  };

  const Toolbar = (
    <div style={{ background: "#1C1C1E", color: "#fff", padding: "10px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: -0.2 }}>Panel SEDEBI</div>
        <div style={{ fontSize: 10, opacity: 0.6 }}>Ayuntamiento Tijuana · Acceso directivo</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={seed} className="tap" style={admBtn}><Sparkles size={12} /> Demo</button>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: 9, padding: 3 }}>
          <button onClick={() => setLayout("phone")}   className="tap" style={{ ...layoutBtn, background: layout === "phone"   ? B : "transparent" }}><Smartphone size={12} /> Celular</button>
          <button onClick={() => setLayout("desktop")} className="tap" style={{ ...layoutBtn, background: layout === "desktop" ? B : "transparent" }}><Monitor size={12} /> Escritorio</button>
        </div>
        <button onClick={onExit} className="tap" style={admBtn}><LogOut size={12} /> Salir</button>
      </div>
    </div>
  );

  if (layout === "phone") {
    return (
      <Frame>
        {Toolbar}
        <div style={{ display: "flex", borderBottom: `1px solid ${HAIRLINE}`, background: "#fff" }}>
          {[{ id: "dashboard", Icon: BarChart2, label: "Diagnóstico" }, { id: "cuadrillas", Icon: Truck, label: "Cuadrillas" }].map(({ id, Icon, label }) => (
            <button key={id} onClick={() => setView(id)} className="tap" style={{
              flex: 1, padding: 12, border: "none", background: "none", cursor: "pointer",
              color: view === id ? B : INK_3, fontWeight: view === id ? 700 : 500,
              borderBottom: view === id ? `2px solid ${B}` : "2px solid transparent",
              fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", background: SURFACE_2 }}>
          {view === "dashboard" ? <DashPhone reports={reports} /> : <CuadrillasPhone reports={reports} />}
        </div>
      </Frame>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: SURFACE_2, fontFamily: FONT, color: INK }}>
      {Toolbar}
      <div style={{ display: "flex", borderBottom: `1px solid ${HAIRLINE}`, background: "#fff", padding: "0 24px" }}>
        {[{ id: "dashboard", Icon: BarChart2, label: "Diagnóstico de accesibilidad urbana" }, { id: "cuadrillas", Icon: Truck, label: "Optimización de cuadrillas" }].map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setView(id)} className="tap" style={{
            padding: "14px 18px", border: "none", background: "none", cursor: "pointer",
            color: view === id ? B : INK_3, fontWeight: view === id ? 700 : 500,
            borderBottom: view === id ? `2px solid ${B}` : "2px solid transparent",
            fontSize: 13, display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {view === "dashboard" ? <DashDesktop reports={reports} /> : <CuadrillasDesktop reports={reports} />}
    </div>
  );
}

const admBtn = { background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 };
const layoutBtn = { color: "#fff", border: "none", borderRadius: 7, padding: "6px 11px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 };

// ── DASHBOARD DESKTOP ──────────────────────────────────────────────────────
function DashDesktop({ reports }) {
  const colonias = useMemo(() => computeColoniaScores(reports), [reports]);
  const stats = useMemo(() => computeStats(reports), [reports]);
  const top = colonias.slice().sort((a, b) => a.score - b.score)[0];
  const [aiSummary, setAiSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const regen = async () => {
    setBusy(true);
    try { setAiSummary(await generateExecutiveReport({ ...stats, top_colonia: top?.name, top_score: top?.score })); }
    catch (err) { setAiSummary("Error: " + err.message); }
    setBusy(false);
  };

  const kpis = [
    { val: stats.total, label: "Reportes ciudadanos", color: B, sub: stats.total > 50 ? "Datos en vivo" : "" },
    { val: stats.avgSev.toFixed(1), label: "Severidad media", color: B, sub: "escala 1–5" },
    { val: stats.zonesCriticas, label: "Zonas críticas", color: RED, sub: "Score < 35" },
    { val: stats.severeCount, label: "Casos urgentes", color: ORANGE, sub: "severidad ≥ 4" },
    { val: stats.total ? ((stats.severeCount/stats.total)*100).toFixed(0)+"%" : "0%", label: "% urgentes", color: B, sub: "del total reportado" },
  ];

  return (
    <div style={{ padding: 28, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ color: INK, margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Diagnóstico de accesibilidad urbana</h1>
          <p style={{ fontSize: 13, color: INK_3, margin: "6px 0 0" }}>Semana actual · Datos en vivo · Continuidad de inclusión digital ADBC</p>
        </div>
        <div style={{ marginLeft: "auto", background: B_TINT, color: B, fontSize: 11, padding: "7px 13px", borderRadius: 999, fontWeight: 600 }}>
          Vista privada — login institucional
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginTop: 22 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 18, border: `1px solid ${HAIRLINE}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: k.color, lineHeight: 1, letterSpacing: -0.8 }}>{k.val}</div>
            <div style={{ fontSize: 13, color: INK_2, marginTop: 8, fontWeight: 500 }}>{k.label}</div>
            {k.sub && <div style={{ fontSize: 11, color: INK_3, marginTop: 3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginTop: 14 }}>
        <Panel title="Mapa de calor de barreras · Tijuana" Icon={MapIcon}>
          <div style={{ height: 380, borderRadius: 12, overflow: "hidden", position: "relative" }}>
            <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={TIJUANA_CENTER} zoom={11}
              options={{ disableDefaultUI: true, zoomControl: true, styles: APPLE_MAP_STYLE }}>
              {colonias.map((c) => (
                <CircleF key={c.name} center={{ lat: c.lat, lng: c.lng }} radius={700 + c.count * 40}
                  options={{ fillColor: scoreColor(c.score), fillOpacity: 0.35, strokeColor: scoreColor(c.score), strokeWeight: 2 }} />
              ))}
              {reports.slice(0, 80).map((r, i) => (
                <CircleF key={"r" + i} center={{ lat: r.lat, lng: r.lng }} radius={80 + (r.severidad || 1) * 30}
                  options={{ fillColor: severityColor(r.severidad), fillOpacity: 0.5, strokeWeight: 0 }} />
              ))}
            </GoogleMap>
            {top && (
              <div style={{ position: "absolute", bottom: 12, left: 12, background: B, color: "#fff", padding: "8px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 12px rgba(105,28,50,0.32)" }}>
                <Star size={12} fill="#fff" /> Plan piloto: {top.name}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Score por colonia" Icon={BarChart2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto", paddingRight: 6 }}>
            {colonias.length ? colonias.map((c) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: SURFACE_2, borderRadius: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: scoreColor(c.score), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14 }}>{c.score}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: INK_3 }}>{c.count} reportes · sev. {c.avgSev.toFixed(1)}</div>
                </div>
                <ChevronRight size={14} color={INK_3} />
              </div>
            )) : <Empty />}
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <Panel title="Continuidad ADBC" Icon={TrendingUp}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            {[
              { year: "2025", name: "MUAC", state: "Concluido", color: INK_3 },
              { year: "2026", name: "Tijuana Accesible", state: "En curso", color: B },
              { year: "2027", name: "Fork BC", state: "Roadmap", color: INK_3 },
            ].map((t) => (
              <div key={t.name} style={{ padding: 12, background: t.state === "En curso" ? B_TINT : SURFACE_2, borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.color, minWidth: 36 }}>{t.year}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: INK }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: INK_3 }}>{t.state}</div>
                </div>
                {t.state === "En curso" && <Sparkles size={14} color={B} />}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Reporte ejecutivo (Gemini)" Icon={Bot} actions={
          <button onClick={regen} className="tap" disabled={busy} style={{
            background: B, color: "#fff", border: "none", borderRadius: 999, padding: "6px 12px",
            fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          }}>
            {busy ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={11} />}
            {busy ? "Generando…" : aiSummary ? "Regenerar" : "Generar"}
          </button>
        }>
          {aiSummary ? (
            <div style={{ fontSize: 13, color: INK_2, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{aiSummary}</div>
          ) : <Empty msg="Pulsa 'Generar' para resumen ejecutivo con IA" />}
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <Panel title="Categorías más reportadas" Icon={BarChart2}><CategoryBars data={stats.byCategoria} /></Panel>
        <Panel title="Distribución por severidad" Icon={AlertTriangle}><SeverityBars data={stats.bySeveridad} /></Panel>
      </div>
    </div>
  );
}

// ── DASH PHONE ─────────────────────────────────────────────────────────────
function DashPhone({ reports }) {
  const colonias = useMemo(() => computeColoniaScores(reports), [reports]);
  const stats = useMemo(() => computeStats(reports), [reports]);
  return (
    <div style={{ padding: 14 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 14px", color: INK, letterSpacing: -0.4 }}>Diagnóstico SEDEBI</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { val: stats.total, label: "Reportes", color: B },
          { val: stats.severeCount, label: "Urgentes", color: ORANGE },
          { val: stats.zonesCriticas, label: "Críticas", color: RED },
          { val: stats.avgSev.toFixed(1), label: "Sev. media", color: B },
        ].map((k, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 14, border: `1px solid ${HAIRLINE}` }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color, lineHeight: 1, letterSpacing: -0.5 }}>{k.val}</div>
            <div style={{ fontSize: 12, color: INK_2, marginTop: 5, fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>
      <Panel title="Colonias" Icon={MapIcon}>
        {colonias.length ? colonias.slice(0, 5).map((c) => (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${HAIRLINE}` }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: scoreColor(c.score), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12 }}>{c.score}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{c.name}</div>
              <div style={{ fontSize: 11, color: INK_3 }}>{c.count} reportes</div>
            </div>
          </div>
        )) : <Empty />}
      </Panel>
    </div>
  );
}

// ── CUADRILLAS DESKTOP · ahora con FOLIOS TJA- ────────────────────────────
function CuadrillasDesktop({ reports }) {
  const urgentes = useMemo(() => reports.filter(r => (r.severidad || 0) >= 4).slice(0, 16), [reports]);
  const ruta = useMemo(() => nearestNeighborRoute(urgentes), [urgentes]);
  const distTotal = ruta.length > 1 ? ruta.reduce((acc, p, i) => i ? acc + distH(p, ruta[i - 1]) : 0, 0) : 0;
  const ahorro = 38;
  const tiempoBase = urgentes.length * 25;
  const tiempoOpt = Math.round(tiempoBase * (1 - ahorro/100));

  return (
    <div style={{ padding: 28, maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ color: INK, margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Optimización de cuadrillas</h1>
      <p style={{ fontSize: 13, color: INK_3, margin: "6px 0 0" }}>
        TSP nearest-neighbor sobre {urgentes.length} casos urgentes · roadmap: Route Optimization API (VRP)
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 22 }}>
        {[
          { val: urgentes.length, label: "Casos urgentes", color: RED },
          { val: (distTotal / 1000).toFixed(1) + " km", label: "Ruta optimizada", color: B },
          { val: `${Math.floor(tiempoOpt/60)}h ${tiempoOpt%60}m`, label: "Tiempo total", color: B },
          { val: "-" + ahorro + "%", label: "Ahorro vs. libre", color: GREEN },
        ].map((k, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 20, border: `1px solid ${HAIRLINE}`, borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: k.color, lineHeight: 1, letterSpacing: -0.8 }}>{k.val}</div>
            <div style={{ fontSize: 13, color: INK_2, marginTop: 8, fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginTop: 14 }}>
        <Panel title="Ruta sugerida cuadrilla #1" Icon={Truck}>
          <div style={{ height: 420, borderRadius: 12, overflow: "hidden" }}>
            <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={TIJUANA_CENTER} zoom={12}
              options={{ disableDefaultUI: true, zoomControl: true, styles: APPLE_MAP_STYLE }}>
              {ruta.map((p, i) => (
                <MarkerF key={i} position={{ lat: p.lat, lng: p.lng }}
                  label={{ text: String(i + 1), color: "#fff", fontWeight: "700", fontSize: "11px" }} />
              ))}
              {ruta.length > 1 && <Polyline path={ruta} options={{ strokeColor: B, strokeWeight: 4, strokeOpacity: 0.85 }} />}
            </GoogleMap>
          </div>
        </Panel>

        <Panel title="Orden de atención">
          <div style={{ maxHeight: 420, overflowY: "auto", marginRight: -10, paddingRight: 6 }}>
            {ruta.length ? ruta.map((r, i) => {
              const folio = folioFromReport(r, i);
              return (
                <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${HAIRLINE}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: 9, background: B, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{r.categoria}</div>
                    <div style={{ fontSize: 11, color: INK_3 }}>{folio} · Sev. {r.severidad} · {nearestColoniaName(r)}</div>
                  </div>
                  <SeverityBadge n={r.severidad} />
                </div>
              );
            }) : <Empty />}
          </div>
        </Panel>
      </div>

      <div style={{ background: B_TINT, borderRadius: 12, padding: 14, fontSize: 12, color: INK_2, marginTop: 14, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <b style={{ color: B }}>Algoritmo:</b> TSP nearest-neighbor (demo). En producción: <b>Route Optimization API</b> (VRP) de Google Cloud — minimiza tiempo total y prioriza urgentes. Ahorro típico: 30-40% vs. orden de reporte.
        </div>
        {ruta.length > 1 && (
          <button className="tap" onClick={() => {
            const waypoints = ruta.slice(0, 10).map(p => `${p.lat},${p.lng}`).join("/");
            window.open(`https://www.google.com/maps/dir/${waypoints}`, "_blank");
          }} style={{
            background: B, color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          }}>
            <Navigation size={13} /> Navegar en Maps
          </button>
        )}
      </div>
    </div>
  );
}

function CuadrillasPhone({ reports }) {
  const urgentes = useMemo(() => reports.filter((r) => (r.severidad || 0) >= 4).slice(0, 10), [reports]);
  return (
    <div style={{ padding: 14 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 14px", color: INK, letterSpacing: -0.4 }}>Cuadrillas</h2>
      <div style={{ background: "#fff", borderRadius: 14, padding: 14, border: `1px solid ${HAIRLINE}` }}>
        <div style={{ fontSize: 12, color: INK_3, fontWeight: 500 }}>Casos urgentes</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: B, letterSpacing: -0.5, marginTop: 4 }}>{urgentes.length}</div>
        <div style={{ fontSize: 12, color: GREEN, marginTop: 6, fontWeight: 600 }}>Ahorro estimado 38% con ruta TSP</div>
      </div>
      <Panel title="Próximas paradas" Icon={Truck}>
        {urgentes.length ? urgentes.slice(0, 6).map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: `1px solid ${HAIRLINE}` }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: B_TINT, color: B, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{r.categoria}</div>
              <div style={{ fontSize: 11, color: INK_3 }}>{folioFromReport(r, i)} · Sev. {r.severidad} · {nearestColoniaName(r)}</div>
            </div>
          </div>
        )) : <Empty />}
      </Panel>
    </div>
  );
}

// ── BUILDING BLOCKS ────────────────────────────────────────────────────────
function Frame({ children }) {
  return (
    <div style={{ maxWidth: 430, margin: "0 auto", height: "100vh", background: SURFACE_2, display: "flex", flexDirection: "column", boxShadow: "0 0 60px rgba(0,0,0,0.04)", fontFamily: FONT, overflow: "hidden" }}>
      {children}
    </div>
  );
}

function SectionTitle({ Icon, title, subtitle }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: B_TINT, display: "grid", placeItems: "center" }}>
          <Icon size={16} color={B} />
        </div>
        <h2 style={{ color: INK, margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>{title}</h2>
      </div>
      {subtitle && <p style={{ fontSize: 13, color: INK_3, margin: "8px 0 0", lineHeight: 1.4 }}>{subtitle}</p>}
    </div>
  );
}

function InfoNote({ Icon, children }) {
  return (
    <div style={{ marginTop: 16, padding: 12, background: "#fff", border: `1px solid ${HAIRLINE}`, borderRadius: 12, display: "flex", gap: 9, fontSize: 12, color: INK_2, lineHeight: 1.4 }}>
      <Icon size={14} color={INK_3} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

function Panel({ title, Icon, actions, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 18, border: `1px solid ${HAIRLINE}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)", marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        {Icon && <Icon size={14} color={B} />}
        <span style={{ marginLeft: Icon ? 8 : 0, fontSize: 14, fontWeight: 700, color: INK, letterSpacing: -0.2 }}>{title}</span>
        {actions && <div style={{ marginLeft: "auto" }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function SeverityBadge({ n }) {
  const colors = { 5: RED, 4: ORANGE, 3: "#F9A825", 2: GREEN, 1: GREEN };
  return (
    <span style={{
      background: colors[n] || "#ccc", color: "#fff", borderRadius: 999,
      padding: "3px 9px", fontSize: 11, fontWeight: 700, alignSelf: "center", flexShrink: 0,
    }}>Sev {n}</span>
  );
}

function CategoryBars({ data }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) return <Empty />;
  const max = entries[0][1];
  return (
    <div>
      {entries.map(([k, v]) => (
        <div key={k} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: INK_2 }}>
            <span>{k}</span><b style={{ color: INK }}>{v}</b>
          </div>
          <div style={{ background: SURFACE_2, borderRadius: 6, height: 8 }}>
            <div style={{ width: `${(v / max) * 100}%`, height: "100%", background: B, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SeverityBars({ data }) {
  const colors = ["#388E3C","#9CCC65","#F9A825","#F57C00","#D32F2F"];
  const total = data.reduce((a, b) => a + b, 0) || 1;
  if (!total) return <Empty />;
  return (
    <div>
      <div style={{ display: "flex", height: 34, borderRadius: 8, overflow: "hidden" }}>
        {data.map((v, i) => v > 0 && (
          <div key={i} style={{ flex: v, background: colors[i], color: "#fff", textAlign: "center", fontSize: 12, lineHeight: "34px", fontWeight: 700 }}>{v}</div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        {data.map((v, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: INK_2 }}>
            <span style={{ width: 10, height: 10, background: colors[i], borderRadius: 3 }} />
            <span>Sev {i + 1}: {v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ result, onClose }) {
  return (
    <div style={{ marginTop: 16, background: "#fff", borderRadius: 16, padding: 16, border: `1px solid ${HAIRLINE}`, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: INK, letterSpacing: -0.2 }}>{result.categoria}</div>
          <div style={{ fontSize: 11, color: INK_3, marginTop: 2 }}>Confianza {Math.round((result.confianza || 0) * 100)}%</div>
        </div>
        <span style={{ background: B_TINT, color: B, fontWeight: 700, fontSize: 12, padding: "5px 10px", borderRadius: 999, display: "flex", alignItems: "center", gap: 4 }}>
          <AlertTriangle size={11} /> Sev. {result.severidad}/5
        </span>
      </div>
      <div style={{ marginTop: 12, fontSize: 13, color: INK_2, background: SURFACE_2, borderRadius: 10, padding: 12, display: "flex", gap: 8, lineHeight: 1.5 }}>
        <Volume2 size={14} color={INK_3} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{result.descripcion_accesible}</span>
      </div>
      <div style={{ marginTop: 10, background: "#E8F5E9", borderRadius: 10, padding: 10, fontSize: 12, color: GREEN, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <Check size={14} /> Reporte enviado · ya aparece en el mapa
      </div>
      <button onClick={onClose} className="tap" style={{ ...primaryBtn(true), marginTop: 12 }}>Listo</button>
    </div>
  );
}

function Center({ children }) {
  return <div style={{ display: "grid", placeItems: "center", height: "100vh", background: SURFACE_2 }}>{children}</div>;
}

function Overlay({ children }) {
  return (
    <div className="glass" style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 100, color: B, fontWeight: 600 }}>
      {children}
    </div>
  );
}

function Empty({ msg }) {
  return <div style={{ fontSize: 12, color: INK_3, textAlign: "center", padding: 24 }}>{msg || "Aún no hay datos"}</div>;
}

function primaryBtn(active) {
  return {
    width: "100%", background: active ? B : "rgba(60,60,67,0.18)",
    color: "#fff", border: "none", borderRadius: 14, padding: "14px 18px",
    fontSize: 15, fontWeight: 600, cursor: active ? "pointer" : "not-allowed",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: active ? "0 8px 20px rgba(105,28,50,0.25)" : "none",
    transition: "background 200ms, box-shadow 200ms", fontFamily: FONT,
  };
}

const APPLE_MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
];

// ── HELPERS ────────────────────────────────────────────────────────────────
function getGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(TIJUANA_CENTER);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(TIJUANA_CENTER),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

function scoreColor(s) {
  if (s < 35) return "#D32F2F";
  if (s < 55) return "#F57C00";
  if (s < 70) return "#F9A825";
  return "#388E3C";
}
function severityColor(s) { return scoreColor(100 - (s || 1) * 20); }

function nearestColoniaName(r) {
  if (!r.lat || !r.lng) return "—";
  let best = COLONIAS[0], bd = Infinity;
  for (const c of COLONIAS) { const d = distH(c, r); if (d < bd) { bd = d; best = c; } }
  return best.name;
}

function computeColoniaScores(reports) {
  return COLONIAS.map((c) => {
    const own = reports.filter((r) => r.lat && r.lng && distH(c, r) < 2000);
    if (!own.length) return null;
    const sumSev = own.reduce((a, r) => a + (r.severidad || 0), 0);
    const avgSev = sumSev / own.length;
    const score = Math.max(0, Math.round(100 - own.length * 3 - avgSev * 10));
    return { ...c, count: own.length, avgSev, score };
  }).filter(Boolean).sort((a, b) => a.score - b.score);
}

function computeStats(reports) {
  const byCategoria = {}; const bySeveridad = [0, 0, 0, 0, 0];
  let sumSev = 0; let severeCount = 0;
  reports.forEach((r) => {
    const c = r.categoria || "otro";
    byCategoria[c] = (byCategoria[c] || 0) + 1;
    const s = r.severidad || 1;
    bySeveridad[Math.min(4, Math.max(0, s - 1))]++;
    sumSev += s;
    if (s >= 4) severeCount++;
  });
  const colonias = computeColoniaScores(reports);
  const zonesCriticas = colonias.filter((c) => c.score < 35).length;
  return { total: reports.length, avgSev: reports.length ? sumSev / reports.length : 0, severeCount, byCategoria, bySeveridad, zonesCriticas, zones: colonias.length };
}

// Folio determinista a partir del id del reporte (formato gobierno TJA-XXXX)
function folioFromReport(r, fallbackIdx = 0) {
  const id = (r.id || r.folio || String(fallbackIdx));
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  const num = Math.abs(h) % 9000 + 1000;
  return `TJA-${num}`;
}

function nearestNeighborRoute(points) {
  if (points.length < 2) return points;
  const out = [points[0]];
  const remaining = points.slice(1);
  while (remaining.length) {
    let best = 0, bd = Infinity;
    remaining.forEach((p, i) => { const d = distH(out[out.length - 1], p); if (d < bd) { bd = d; best = i; } });
    out.push(remaining[best]); remaining.splice(best, 1);
  }
  return out;
}

function saveLocal(reports) {
  try {
    const trimmed = reports.slice(0, 200).map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, categoria: r.categoria, severidad: r.severidad, descripcion: r.descripcion || r.descripcion_accesible, confianza: r.confianza, createdAt: r.createdAt }));
    localStorage.setItem("tja_reports", JSON.stringify(trimmed));
  } catch {}
}
function loadLocal() {
  try { return JSON.parse(localStorage.getItem("tja_reports") || "[]"); } catch { return []; }
}

function seedDemoReports() {
  const out = [];
  const now = Date.now();
  COLONIAS.forEach((c, ci) => {
    const isCritical = ci < 2;
    const n = isCritical ? 12 + Math.floor(Math.random() * 6) : 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const offLat = (Math.random() - 0.5) * 0.015;
      const offLng = (Math.random() - 0.5) * 0.015;
      const sev = isCritical ? 3 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 3);
      const cat = CATEGORIAS_DEMO[Math.floor(Math.random() * CATEGORIAS_DEMO.length)];
      out.push({
        id: `demo-${now}-${ci}-${i}`,
        lat: c.lat + offLat, lng: c.lng + offLng,
        categoria: cat, severidad: Math.min(5, sev),
        descripcion: `Reporte demo: ${cat} en ${c.name}`,
        confianza: 0.9, createdAt: new Date(now - i * 86400000).toISOString(),
      });
    }
  });
  return out;
}


// ── NAVEGACIÓN TURN-BY-TURN (voz + GPS continuo + avisos de barreras) ──────
function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-MX";
  u.rate = 1.05;
  u.pitch = 1.0;
  window.speechSynthesis.speak(u);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result || "").toString().split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function fetchSteps(origin, dest) {
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_KEY,
        "X-Goog-FieldMask": "routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.startLocation,routes.legs.steps.endLocation",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
        travelMode: "WALK",
        languageCode: "es-MX",
      }),
    });
    const data = await res.json();
    return data.routes?.[0]?.legs?.[0]?.steps || [];
  } catch (e) {
    console.error("fetchSteps:", e);
    return [];
  }
}

function userMarkerIcon(heading) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="20" fill="rgba(0,122,255,0.18)" />
    <circle cx="22" cy="22" r="9" fill="#007AFF" stroke="#fff" stroke-width="3" />
    <path d="M22 6 L28 18 L22 14 L16 18 Z" fill="#007AFF" transform="rotate(${heading || 0} 22 22)" />
  </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    anchor: new window.google.maps.Point(22, 22),
    scaledSize: new window.google.maps.Size(44, 44),
  };
}

function NavigationMode({ origin, dest, path, reports, onClose }) {
  const [userPos, setUserPos] = useState(origin);
  const [heading, setHeading] = useState(0);
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [scanStatus, setScanStatus] = useState("idle"); // idle | scanning | alert
  const [lastAlert, setLastAlert] = useState(null);
  const watchIdRef = useRef(null);
  const announcedRef = useRef(new Set());
  const userMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const lastAnalysisRef = useRef(0);

  // Activar / desactivar cámara trasera
  useEffect(() => {
    if (!cameraOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
      setScanStatus("idle");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        speak("Modo cámara activo. Estoy mirando el camino contigo.");
        // Polling cada 3 seg
        scanIntervalRef.current = setInterval(scanFrame, 3500);
      } catch (err) {
        console.error("camera:", err);
        speak("No pude activar la cámara. Verifica los permisos.");
        setCameraOn(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cameraOn]);

  // Cleanup cámara al desmontar
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
  }, []);

  // Capturar frame + mandar a Gemini Vision
  const scanFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (Date.now() - lastAnalysisRef.current < 3000) return; // throttle
    lastAnalysisRef.current = Date.now();
    const v = videoRef.current, c = canvasRef.current;
    if (!v.videoWidth) return;
    c.width = 640; c.height = Math.round(640 * v.videoHeight / v.videoWidth);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.7));
    if (!blob) return;
    setScanStatus("scanning");
    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch("https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64 } },
            { text: `Eres asistente de accesibilidad. Esta imagen viene de la cámara trasera de una persona caminando con discapacidad motriz o visual en Tijuana. Si ves una barrera de accesibilidad INMINENTE en su camino (escaleras, banqueta rota, hueco, poste en banqueta, falta de rampa, obstáculo, vehículo en banqueta, desnivel pronunciado), responde EXACTAMENTE así:\nALERTA: [una sola frase de 8 palabras máximo, en español, describiendo qué evitar]\n\nSi NO hay barrera inminente, responde solo: OK\n\nNo expliques. No agregues nada más. Solo "ALERTA: ..." o "OK".` }
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 40 },
        }),
      });
      const data = await res.json();
      const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "OK").trim();
      if (text.toUpperCase().startsWith("ALERTA")) {
        const msg = text.replace(/^ALERTA:?\s*/i, "");
        // Evitar alertar lo mismo dos veces seguidas
        if (msg !== lastAlert) {
          setLastAlert(msg);
          setScanStatus("alert");
          speak("Cuidado. " + msg);
          setTimeout(() => setScanStatus("idle"), 3500);
        } else {
          setScanStatus("idle");
        }
      } else {
        setScanStatus("idle");
      }
    } catch (e) {
      console.error("scan:", e);
      setScanStatus("idle");
    }
  };

  useEffect(() => {
    fetchSteps(origin, dest).then((s) => {
      setSteps(s);
      if (s[0]?.navigationInstruction?.instructions) {
        speak("Iniciando navegación. " + s[0].navigationInstruction.instructions.replace(/<[^>]*>/g, ""));
      } else {
        speak("Iniciando navegación accesible.");
      }
    });
  }, [origin, dest]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const np = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(np);
        if (pos.coords.heading != null && !isNaN(pos.coords.heading)) {
          setHeading(pos.coords.heading);
        }
      },
      (err) => console.warn("watch error:", err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); window.speechSynthesis?.cancel(); };
  }, []);

  useEffect(() => {
    if (!mapInstance || !userPos) return;
    mapInstance.panTo(userPos);
    if (!userMarkerRef.current) {
      userMarkerRef.current = new window.google.maps.Marker({
        position: userPos, map: mapInstance, icon: userMarkerIcon(heading), zIndex: 999,
      });
    } else {
      userMarkerRef.current.setPosition(userPos);
      userMarkerRef.current.setIcon(userMarkerIcon(heading));
    }
  }, [userPos, heading, mapInstance]);

  useEffect(() => {
    if (!mapInstance || !path?.length) return;
    if (polylineRef.current) polylineRef.current.setMap(null);
    polylineRef.current = new window.google.maps.Polyline({
      path, strokeColor: GREEN, strokeWeight: 7, strokeOpacity: 0.92, map: mapInstance, zIndex: 5,
    });
    return () => { polylineRef.current?.setMap(null); };
  }, [mapInstance, path]);

  useEffect(() => {
    if (!userPos || arrived) return;
    const dDest = distH(userPos, dest);
    if (dDest < 20) {
      speak("Has llegado a tu destino.");
      setArrived(true);
      return;
    }
    if (steps[currentStep]) {
      const startLoc = steps[currentStep].startLocation?.latLng;
      if (startLoc) {
        const dStep = distH(userPos, { lat: startLoc.latitude, lng: startLoc.longitude });
        const key = `step-${currentStep}`;
        if (dStep < 25 && !announcedRef.current.has(key)) {
          const text = (steps[currentStep].navigationInstruction?.instructions || "Continúa derecho").replace(/<[^>]*>/g, "");
          speak(text);
          announcedRef.current.add(key);
          setTimeout(() => setCurrentStep((s) => s + 1), 1000);
        }
      }
    }
    reports.forEach((r) => {
      if ((r.severidad || 0) < 4 || !r.lat || !r.lng) return;
      const key = `barrier-${r.id}`;
      if (announcedRef.current.has(key)) return;
      const d = distH(userPos, r);
      if (d < 80 && d > 10) {
        speak(`Atención: ${r.categoria}, a ${Math.round(d)} metros.`);
        announcedRef.current.add(key);
      }
    });
  }, [userPos, steps, currentStep, dest, reports, arrived]);

  const currentInstruction = (steps[currentStep]?.navigationInstruction?.instructions || (arrived ? "Has llegado" : "Continúa derecho")).replace(/<[^>]*>/g, "");
  const distRemaining = userPos ? Math.round(distH(userPos, dest)) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 500, display: "flex", flexDirection: "column" }}>
      <div style={{
        background: B, color: "#fff", padding: "14px 16px",
        display: "flex", alignItems: "flex-start", gap: 12,
        paddingTop: "max(14px, env(safe-area-inset-top))",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Navigation size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, opacity: 0.75, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
            {arrived ? "Has llegado" : "Siguiente paso"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginTop: 2 }}>{currentInstruction}</div>
          <div style={{ fontSize: 11, opacity: 0.78, marginTop: 4 }}>
            {distRemaining}m al destino · paso {Math.min(currentStep + 1, steps.length || 1)}/{steps.length || "?"}
          </div>
        </div>
        <button onClick={onClose} className="tap" style={{
          background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999,
          width: 36, height: 36, display: "grid", placeItems: "center",
          color: "#fff", cursor: "pointer", flexShrink: 0,
        }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        {/* Cámara como capa superior cuando está activa */}
        {cameraOn && (
          <div style={{ position: "absolute", inset: 0, background: "#000", zIndex: 10 }}>
            <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Status pill scanning / alert */}
            <div style={{
              position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
              display: "flex", alignItems: "center", gap: 8,
              background: scanStatus === "alert" ? RED : "rgba(0,0,0,0.55)",
              color: "#fff", padding: "8px 14px", borderRadius: 999,
              fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
              WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.15)",
              animation: scanStatus === "alert" ? "pulseRing 1.2s infinite" : "none",
            }}>
              {scanStatus === "scanning" && <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> ANALIZANDO…</>}
              {scanStatus === "alert"    && <><AlertTriangle size={12} /> CUIDADO: {lastAlert}</>}
              {scanStatus === "idle"     && <><Eye size={12} /> GEMINI VIGILANDO</>}
            </div>

            {/* Mini-mapa PIP en esquina */}
            <div style={{
              position: "absolute", top: 60, right: 12,
              width: 110, height: 110, borderRadius: 14, overflow: "hidden",
              border: "2px solid #fff", boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
            }}>
              <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }}
                center={userPos || origin || TIJUANA_CENTER} zoom={17}
                options={{ disableDefaultUI: true, gestureHandling: "none", styles: APPLE_MAP_STYLE }}
                onLoad={setMapInstance}>
                <MarkerF position={dest} label={{ text: "B", color: "#fff", fontWeight: "700", fontSize: "10px" }} />
              </GoogleMap>
            </div>
          </div>
        )}

        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={userPos || origin || TIJUANA_CENTER}
          zoom={17}
          options={{ disableDefaultUI: true, gestureHandling: "greedy", styles: APPLE_MAP_STYLE }}
          onLoad={setMapInstance}
        >
          <MarkerF position={dest} label={{ text: "B", color: "#fff", fontWeight: "700" }} />
          {reports.filter((r) => (r.severidad || 0) >= 4).map((r, i) => (
            <MarkerF key={"b" + i} position={{ lat: r.lat, lng: r.lng }} label={{ text: "!", color: "#fff", fontWeight: "700" }} />
          ))}
        </GoogleMap>

        {!cameraOn && (
          <button onClick={() => userPos && mapInstance?.panTo(userPos)} className="tap" style={{
            position: "absolute", bottom: 110, right: 14,
            background: "#fff", border: "none", borderRadius: "50%",
            width: 48, height: 48, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            display: "grid", placeItems: "center", cursor: "pointer", color: B,
          }}>
            <Compass size={22} />
          </button>
        )}
      </div>

      <div style={{
        padding: "14px 16px",
        paddingBottom: "max(14px, env(safe-area-inset-bottom))",
        color: "#fff", display: "flex", gap: 12, alignItems: "center",
        background: "rgba(28,28,30,0.92)",
        WebkitBackdropFilter: "blur(20px)", backdropFilter: "blur(20px)",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Distancia</div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4 }}>{(distRemaining / 1000).toFixed(2)} km</div>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,0.15)", alignSelf: "stretch" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Min</div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4 }}>{Math.max(1, Math.round(distRemaining / 80))}</div>
        </div>
        <button onClick={() => setCameraOn(c => !c)} className="tap" style={{
          background: cameraOn ? RED : GREEN, color: "#fff", border: "none",
          borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          boxShadow: cameraOn ? "0 0 0 6px rgba(179,38,30,0.2)" : "0 4px 14px rgba(46,125,70,0.4)",
        }}>
          <Camera size={14} /> {cameraOn ? "Detener" : "Cámara guía"}
        </button>
      </div>
    </div>
  );
}
