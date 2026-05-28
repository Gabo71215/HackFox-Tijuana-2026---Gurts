// src/App.jsx — Tijuana Accesible · versión completa
// 7 vistas + dashboard desktop SEDEBI + cuadrillas, asistente con GPS,
// localStorage para persistencia de pins, datos demo seedeables.
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, Polyline, CircleF } from "@react-google-maps/api";
import {
  Map as MapIcon, Camera, Mic, MicOff, Navigation, MessageCircle,
  Accessibility, Zap, Activity, Eye, Lock, Check, AlertTriangle, Star,
  Truck, BarChart2, Bot, RefreshCw, Send, LogOut, Monitor, Smartphone,
  MapPin, Loader2, Volume2, ArrowRight, TrendingUp, Award, Sparkles,
  Download, ChevronRight, Clock
} from "lucide-react";
import { ensureAnonymousAuth } from "./lib/firebase";
import { subscribeReports, createReport } from "./lib/reports";
import { classifyBarrierPhoto, extractBarrierFromText, generateExecutiveReport } from "./lib/gemini";

const B = "#691C32";
const BL = "#F5E6EA";
const BLLIGHT = "#FBF6F8";
const GREEN = "#2E7D46";
const RED = "#B3261E";
const ORANGE = "#F57C00";
const TIJUANA_CENTER = { lat: 32.5149, lng: -117.0382 };
const LIBS = ["places", "geometry"];
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Colonias REALES de Tijuana con centros aproximados
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

const DESTINOS = [
  { name: "IMSS Clínica 20",          lat: 32.5246, lng: -117.0252 },
  { name: "Hospital General Tijuana", lat: 32.5031, lng: -117.0387 },
  { name: "Plaza Río",                lat: 32.5252, lng: -117.0306 },
  { name: "CECUT",                    lat: 32.5234, lng: -117.0235 },
  { name: "UABC Tijuana",             lat: 32.4914, lng: -116.9697 },
  { name: "Palacio Municipal",        lat: 32.5103, lng: -117.0173 },
];

const CATEGORIAS_DEMO = [
  "poste CFE en banqueta", "cableado informal expuesto", "banqueta rota o levantada",
  "ausencia de rampa", "desnivel banqueta-calle", "obstáculo comercial",
];

// ============================================================================
// ROOT
// ============================================================================
export default function App() {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAPS_KEY, libraries: LIBS });
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("map");
  const [adminMode, setAdminMode] = useState(false);
  const [reports, setReports] = useState(() => loadLocal());

  useEffect(() => {
    ensureAnonymousAuth().then(() => {
      subscribeReports((remote) => {
        if (remote.length) {
          setReports(remote);
          saveLocal(remote);
        }
      });
    }).catch(console.error);
  }, []);

  // Cualquier cambio en reports se respalda en localStorage
  useEffect(() => { saveLocal(reports); }, [reports]);

  if (!isLoaded) return <Center><Loader2 size={32} color={B} style={{ animation: "spin 1s linear infinite" }} /></Center>;
  if (!profile) return <Welcome onSelect={setProfile} />;
  if (adminMode) return <AdminPanel reports={reports} setReports={setReports} onExit={() => setAdminMode(false)} />;

  return (
    <Layout profile={profile} tab={tab} setTab={setTab} onAdmin={() => setAdminMode(true)}>
      {tab === "map"       && <MapView reports={reports} />}
      {tab === "report"    && <ReportView reports={reports} setReports={setReports} />}
      {tab === "voice"     && <VoiceView reports={reports} setReports={setReports} />}
      {tab === "route"     && <RouteView profile={profile} reports={reports} />}
      {tab === "assistant" && <AssistantView reports={reports} />}
    </Layout>
  );
}

function Welcome({ onSelect }) {
  const [pick, setPick] = useState(null);
  return (
    <Frame>
      <div style={{ background: B, color: "#fff", padding: "44px 24px 24px", textAlign: "center" }}>
        <Accessibility size={52} color="#fff" style={{ margin: "0 auto" }} />
        <h1 style={{ fontSize: 26, margin: "10px 0 4px" }}>TIJUANA ACCESIBLE</h1>
        <p style={{ opacity: 0.7, fontSize: 12 }}>FITD 2026 · ADBC · Google Cloud</p>
      </div>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", marginTop: -12, padding: 22, flex: 1 }}>
        <h3 style={{ color: B }}>¿Cómo te mueves hoy?</h3>
        <p style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
          Tu perfil ajusta cómo la app pondera las barreras. Sin login, sin datos personales.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "16px 0" }}>
          {PROFILES.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setPick(id)} style={{
              padding: 18, borderRadius: 12, cursor: "pointer",
              border: pick === id ? `2px solid ${B}` : "2px solid #eee",
              background: pick === id ? BL : "#fafafa",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}>
              <Icon size={28} color={pick === id ? B : "#555"} />
              <span style={{ fontSize: 13 }}>{label}</span>
            </button>
          ))}
        </div>
        <button disabled={!pick} onClick={() => onSelect(pick)} style={btn(pick ? B : "#ccc")}>
          <Lock size={14} style={{ marginRight: 6 }} />
          Continuar sin registro
          <ArrowRight size={14} style={{ marginLeft: 6 }} />
        </button>
      </div>
    </Frame>
  );
}

function Layout({ profile, tab, setTab, onAdmin, children }) {
  const p = PROFILES.find((x) => x.id === profile);
  const [pressTimer, setPressTimer] = useState(null);
  const onPressStart = () => setPressTimer(setTimeout(() => {
    const pwd = prompt("Acceso institucional SEDEBI:");
    if (pwd === "sedebi2026") onAdmin();
    else if (pwd) alert("Acceso denegado");
  }, 1500));
  const onPressEnd = () => { clearTimeout(pressTimer); setPressTimer(null); };

  return (
    <Frame>
      <div style={{ background: B, color: "#fff", padding: "10px 14px", display: "flex", alignItems: "center" }}>
        <div onMouseDown={onPressStart} onMouseUp={onPressEnd} onTouchStart={onPressStart} onTouchEnd={onPressEnd}
          style={{ cursor: "pointer", userSelect: "none" }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>TIJUANA ACCESIBLE</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>FITD 2026 · ADBC · Google Cloud</div>
        </div>
        {p && (
          <span style={{ marginLeft: "auto", background: "rgba(255,255,255,.15)", borderRadius: 12, padding: "4px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
            <p.Icon size={12} /> {p.label}
          </span>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>{children}</div>
      <div style={{ display: "flex", borderTop: "1px solid #eee", background: "#fff" }}>
        {[
          { id: "map",       Icon: MapIcon,       label: "Mapa" },
          { id: "report",    Icon: Camera,        label: "Foto" },
          { id: "voice",     Icon: Mic,           label: "Voz" },
          { id: "route",     Icon: Navigation,    label: "Ruta" },
          { id: "assistant", Icon: MessageCircle, label: "Ayuda" },
        ].map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, background: "none", border: "none", padding: "8px 0", cursor: "pointer",
            color: tab === id ? B : "#aaa", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}>
            <Icon size={20} strokeWidth={tab === id ? 2.5 : 1.8} />
            <span style={{ fontSize: 9, fontWeight: tab === id ? 700 : 400 }}>{label}</span>
          </button>
        ))}
      </div>
    </Frame>
  );
}

// ============================================================================
// VISTA 2 · Mapa con Accessibility Score por colonia
// ============================================================================
function MapView({ reports }) {
  const colonias = useMemo(() => computeColoniaScores(reports), [reports]);
  return (
    <div style={{ flex: 1, position: "relative" }}>
      <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={TIJUANA_CENTER} zoom={11}
        options={{ disableDefaultUI: true, zoomControl: true }}>
        {colonias.map((c) => (
          <CircleF key={c.name} center={{ lat: c.lat, lng: c.lng }} radius={600 + c.count * 30}
            options={{ fillColor: scoreColor(c.score), fillOpacity: 0.3, strokeColor: scoreColor(c.score), strokeWeight: 2 }} />
        ))}
        {reports.map((r, i) => (
          <MarkerF key={r.id || i} position={{ lat: r.lat, lng: r.lng }}
            label={{ text: String(r.severidad || "!"), color: "#fff", fontWeight: "700", fontSize: "11px" }} />
        ))}
      </GoogleMap>
      <div style={{ position: "absolute", top: 10, left: 10, right: 10, background: "rgba(255,255,255,.95)",
        borderRadius: 10, padding: "8px 12px", boxShadow: "0 2px 10px rgba(0,0,0,.1)", fontSize: 12,
        display: "flex", alignItems: "center", gap: 8 }}>
        <AlertTriangle size={14} color={B} />
        <span style={{ fontWeight: 700, color: B }}>{reports.length}</span>
        <span>barreras</span>
        <span style={{ marginLeft: "auto", color: "#888" }}>{colonias.length} colonias</span>
      </div>
      <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(255,255,255,.95)",
        borderRadius: 8, padding: 8, fontSize: 10, boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Accessibility Score</div>
        {[["#388E3C","Bueno (70+)"],["#F9A825","Medio (55+)"],["#F57C00","Bajo (35+)"],["#D32F2F","Crítico"]].map(([c,l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, margin: "2px 0" }}>
            <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: "inline-block" }} />
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// VISTA 3a · Foto
// ============================================================================
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Camera size={20} color={B} />
        <h2 style={{ color: B, margin: 0, fontSize: 17 }}>Reportar con foto</h2>
      </div>
      <p style={{ fontSize: 12, color: "#666", margin: "0 0 20px" }}>
        Gemini Vision clasifica la barrera, severidad y perfiles afectados.
      </p>
      <button onClick={() => fileRef.current?.click()} style={btn(B)}>
        <Camera size={16} style={{ marginRight: 8 }} />Tomar foto o elegir archivo
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handle} style={{ display: "none" }} />
      <div style={{ marginTop: 16, fontSize: 11, color: "#666", background: "#FAFAFA", padding: 10, borderRadius: 8, display: "flex", gap: 6 }}>
        <Eye size={14} color="#888" style={{ flexShrink: 0, marginTop: 1 }} />
        Gemini difumina caras y placas. Solo se guarda imagen procesada, GPS y clasificación.
      </div>
      {busy && <Overlay><Loader2 size={28} color={B} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} /><span>Analizando con Gemini Vision…</span></Overlay>}
      {result && <ResultCard result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

// ============================================================================
// VISTA 3b · Voz
// ============================================================================
function VoiceView({ reports, setReports }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const recogRef = useRef(null);
  const supported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = "es-MX"; r.continuous = true; r.interimResults = true;
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Mic size={20} color={B} />
        <h2 style={{ color: B, margin: 0, fontSize: 17 }}>Reportar con voz</h2>
      </div>
      <p style={{ fontSize: 12, color: "#666", margin: "0 0 16px" }}>
        Para baja visión o quien no puede escribir. Habla — Gemini estructura el reporte.
      </p>
      {!supported && <div style={{ padding: 12, background: "#FFF3E0", borderRadius: 8, fontSize: 12, color: "#E65100", marginBottom: 16 }}>Usa Chrome para reconocimiento de voz, o escribe abajo.</div>}
      <div style={{ textAlign: "center", margin: "20px 0 16px" }}>
        <button onClick={listening ? stop : start} style={{ width: 90, height: 90, borderRadius: "50%", border: "none", background: listening ? "#D32F2F" : B, color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: listening ? "0 0 0 12px rgba(211,47,47,.2)" : "0 4px 14px rgba(105,28,50,.3)" }}>
          {listening ? <MicOff size={36} /> : <Mic size={36} />}
        </button>
        <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>{listening ? "Escuchando…" : "Toca para hablar"}</div>
      </div>
      <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder='Ej: "Hay un poste tirado en la banqueta de mi casa."'
        style={{ width: "100%", minHeight: 80, padding: 10, border: "1px solid #ddd", borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
      <button onClick={process} disabled={!transcript.trim() || busy} style={{ ...btn(B), marginTop: 10, opacity: !transcript.trim() ? 0.5 : 1 }}>
        <Bot size={16} style={{ marginRight: 8 }} />Procesar con Gemini
      </button>
      {busy && <Overlay><Loader2 size={28} color={B} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} /><span>Extrayendo con Gemini…</span></Overlay>}
      {result && <ResultCard result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

// ============================================================================
// VISTA 4 · Ruta accesible
// ============================================================================
function RouteView({ profile, reports }) {
  const [destino, setDestino] = useState(DESTINOS[0]);
  const [origen, setOrigen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [routes, setRoutes] = useState(null);

  useEffect(() => { getGps().then(setOrigen); }, []);

  const compute = async () => {
    if (!origen) return;
    setBusy(true); setRoutes(null);
    try {
      const data = await fetchRoutes(origen, destino);
      const all = data.routes || [];
      const scored = all.map((r) => ({ route: r, severas: countNearbyBarriers(r, reports, 4) }));
      setRoutes({ standard: scored[0], accessible: scored.slice().sort((a, b) => a.severas - b.severas)[0] });
    } catch (err) { alert("Error: " + err.message); }
    setBusy(false);
  };

  const polylineStd = useMemo(() => decodePoly(routes?.standard?.route?.polyline?.encodedPolyline), [routes]);
  const polylineAcc = useMemo(() => decodePoly(routes?.accessible?.route?.polyline?.encodedPolyline), [routes]);
  const p = PROFILES.find((x) => x.id === profile);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: 12, background: "#FAFAFA", borderBottom: "1px solid #eee" }}>
        <div style={{ fontSize: 11, color: "#666", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={12} /> Destino:
        </div>
        <select value={destino.name} onChange={(e) => setDestino(DESTINOS.find((d) => d.name === e.target.value))}
          style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8, fontSize: 14 }}>
          {DESTINOS.map((d) => <option key={d.name}>{d.name}</option>)}
        </select>
        <button onClick={compute} disabled={busy || !origen} style={{ ...btn(B), marginTop: 8 }}>
          {busy ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />Calculando…</> : <><Navigation size={14} style={{ marginRight: 6 }} />Comparar rutas</>}
        </button>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={origen || TIJUANA_CENTER} zoom={13} options={{ disableDefaultUI: true, zoomControl: true }}>
          {origen && <MarkerF position={origen} label={{ text: "A", color: "#fff", fontWeight: "700" }} />}
          <MarkerF position={destino} label={{ text: "B", color: "#fff", fontWeight: "700" }} />
          {polylineStd && <Polyline path={polylineStd} options={{ strokeColor: "#D32F2F", strokeWeight: 5, strokeOpacity: 0.7 }} />}
          {polylineAcc && <Polyline path={polylineAcc} options={{ strokeColor: GREEN, strokeWeight: 6, strokeOpacity: 0.9 }} />}
          {reports.filter((r) => (r.severidad || 0) >= 4).map((r, i) => (
            <MarkerF key={"b" + i} position={{ lat: r.lat, lng: r.lng }} label={{ text: "!", color: "#fff", fontWeight: "700" }} />
          ))}
        </GoogleMap>
      </div>
      {routes && (
        <div style={{ padding: 12, borderTop: "1px solid #eee", background: "#fff" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ label: "Estándar", color: "#D32F2F", d: routes.standard }, { label: "Accesible", color: GREEN, d: routes.accessible }].map(({ label, color, d }) => (
              <div key={label} style={{ flex: 1, border: `2px solid ${color}`, borderRadius: 8, padding: 10 }}>
                <div style={{ color, fontSize: 11, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{Math.round(parseInt(d.route.duration) / 60)} min</div>
                <div style={{ fontSize: 11, color: "#666" }}>{Math.round(d.route.distanceMeters / 100) / 10} km</div>
                <div style={{ fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 3, color: d.severas > 0 ? "#D32F2F" : GREEN }}>
                  {d.severas > 0 ? <AlertTriangle size={11} /> : <Check size={11} />} {d.severas} barreras severas
                </div>
              </div>
            ))}
          </div>
          {p && <div style={{ marginTop: 8, fontSize: 11, color: "#666", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <p.Icon size={12} /> Perfil: <b>{p.label}</b>
          </div>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VISTA 5 · Asistente CON GEOLOCALIZACIÓN Y CONOCIMIENTO DE LA APP
// ============================================================================
function AssistantView({ reports }) {
  const [msgs, setMsgs] = useState([
    { role: "assistant", text: "Hola, soy tu asistente de accesibilidad en Tijuana. Puedo decirte qué barreras hay cerca, sugerir rutas accesibles o ayudarte a encontrar lugares con rampas, baños accesibles, transporte SITT, etc." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [gps, setGps] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { getGps().then(setGps); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (txt) => {
    const q = (txt || input).trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput(""); setBusy(true);
    try {
      // Construye contexto con GPS del usuario + barreras cercanas
      let context = "";
      if (gps) {
        context += `\nUbicación actual del usuario: lat ${gps.lat.toFixed(4)}, lng ${gps.lng.toFixed(4)}.`;
        const cerca = reports
          .map((r) => ({ ...r, d: distH(gps, r) }))
          .filter((r) => r.d < 1500 && r.lat && r.lng)
          .sort((a, b) => a.d - b.d)
          .slice(0, 5);
        if (cerca.length) {
          context += `\nBarreras reportadas a menos de 1.5km:\n` + cerca.map((r, i) => `${i+1}. ${r.categoria} (severidad ${r.severidad}/5), a ${Math.round(r.d)}m: ${r.descripcion || r.descripcion_accesible || ""}`).join("\n");
        }
        context += `\nLugares de referencia en Tijuana: ${DESTINOS.map(d => d.name).join(", ")}.`;
      }
      const res = await fetch("https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text:
`Eres el asistente de accesibilidad de Tijuana Accesible (app del Ayuntamiento de Tijuana). Tienes acceso a la ubicación del usuario y a los reportes ciudadanos de barreras. Responde en español, breve y útil. Si el usuario pregunta cómo llegar a un lugar, sugiere la pestaña "Ruta" de la app. Si pregunta dónde reportar algo, sugiere las pestañas "Foto" o "Voz". Da datos concretos con distancia cuando puedas. La troncal del SITT es la única línea de transporte accesible de Tijuana (rampas, piso táctil, abordaje a nivel). Las calafias NO son accesibles.
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
        <div style={{ padding: "8px 12px", background: "#FFF3E0", fontSize: 11, color: "#E65100", display: "flex", alignItems: "center", gap: 6 }}>
          <MapPin size={12} /> Esperando tu ubicación para dar respuestas precisas…
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: 12, background: "#FAFAFA" }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", margin: "6px 0", alignItems: "flex-start", gap: 6 }}>
            {m.role === "assistant" && <Bot size={16} color={B} style={{ marginTop: 4, flexShrink: 0 }} />}
            <div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: 14, fontSize: 13, lineHeight: 1.5, background: m.role === "user" ? B : "#fff", color: m.role === "user" ? "#fff" : "#222", border: m.role === "user" ? "none" : "1px solid #eee", whiteSpace: "pre-wrap" }}>{m.text}</div>
          </div>
        ))}
        {busy && <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 0" }}><Bot size={16} color={B} /><Loader2 size={14} color={B} style={{ animation: "spin 1s linear infinite" }} /><span style={{ fontSize: 12, color: "#888" }}>pensando…</span></div>}
        <div ref={endRef} />
      </div>
      {msgs.length <= 1 && (
        <div style={{ display: "flex", gap: 6, padding: "0 10px 8px", overflowX: "auto" }}>
          {["¿Hay barreras cerca de mí?", "¿Cómo llego al IMSS Clínica 20?", "¿Dónde reporto una banqueta rota?", "¿Qué hace esta app?"].map((s) => (
            <button key={s} onClick={() => send(s)} style={{ flexShrink: 0, fontSize: 11, padding: "6px 10px", borderRadius: 14, border: `1px solid ${BL}`, background: "#fff", color: B, cursor: "pointer" }}>{s}</button>
          ))}
        </div>
      )}
      <div style={{ padding: 10, borderTop: "1px solid #eee", background: "#fff", display: "flex", gap: 6 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribe tu pregunta…"
          style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 20, fontSize: 13, outline: "none" }} />
        <button onClick={() => send()} disabled={busy} style={{ background: B, color: "#fff", border: "none", borderRadius: 20, padding: "0 14px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// PANEL SEDEBI · con toggle teléfono/escritorio
// ============================================================================
function AdminPanel({ reports, setReports, onExit }) {
  const [layout, setLayout] = useState("desktop"); // desktop | phone
  const [view, setView] = useState("dashboard");

  const seed = () => {
    if (!confirm("Cargar 60 reportes de demo en Tijuana? (Se mezclan con los reales)")) return;
    setReports((prev) => [...seedDemoReports(), ...prev]);
  };

  const Toolbar = (
    <div style={{ background: "#1f1f1f", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>PANEL SEDEBI</div>
        <div style={{ fontSize: 9, opacity: 0.7 }}>Ayuntamiento Tijuana · Acceso directivo</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={seed} style={admBtn}><Sparkles size={12} /> Demo</button>
        <div style={{ display: "flex", background: "#333", borderRadius: 8, padding: 2 }}>
          <button onClick={() => setLayout("phone")} style={{ ...layoutBtn, background: layout === "phone" ? B : "transparent" }}>
            <Smartphone size={12} /> Celular
          </button>
          <button onClick={() => setLayout("desktop")} style={{ ...layoutBtn, background: layout === "desktop" ? B : "transparent" }}>
            <Monitor size={12} /> Escritorio
          </button>
        </div>
        <button onClick={onExit} style={admBtn}><LogOut size={12} /> Salir</button>
      </div>
    </div>
  );

  if (layout === "phone") {
    return (
      <Frame>
        {Toolbar}
        <div style={{ display: "flex", borderBottom: "1px solid #eee", background: "#fff" }}>
          {[{ id: "dashboard", Icon: BarChart2, label: "Diagnóstico" }, { id: "cuadrillas", Icon: Truck, label: "Cuadrillas" }].map(({ id, Icon, label }) => (
            <button key={id} onClick={() => setView(id)} style={{ flex: 1, padding: 10, border: "none", background: "none", cursor: "pointer", color: view === id ? B : "#666", fontWeight: view === id ? 700 : 500, borderBottom: view === id ? `3px solid ${B}` : "3px solid transparent", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", background: "#F5F5F5" }}>
          {view === "dashboard" ? <DashPhone reports={reports} /> : <CuadrillasPhone reports={reports} />}
        </div>
      </Frame>
    );
  }
  // DESKTOP
  return (
    <div style={{ minHeight: "100vh", background: BLLIGHT, fontFamily: "system-ui,sans-serif" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {Toolbar}
      <div style={{ display: "flex", borderBottom: "1px solid #eee", background: "#fff" }}>
        {[{ id: "dashboard", Icon: BarChart2, label: "Diagnóstico de accesibilidad urbana" }, { id: "cuadrillas", Icon: Truck, label: "Optimización de cuadrillas" }].map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setView(id)} style={{ padding: "12px 24px", border: "none", background: "none", cursor: "pointer", color: view === id ? B : "#666", fontWeight: view === id ? 700 : 500, borderBottom: view === id ? `3px solid ${B}` : "3px solid transparent", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {view === "dashboard" ? <DashDesktop reports={reports} /> : <CuadrillasDesktop reports={reports} />}
    </div>
  );
}

const admBtn = { background: "transparent", color: "#fff", border: "1px solid #555", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 };
const layoutBtn = { color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 };

// ============================================================================
// VISTA 6 · DASHBOARD DESKTOP (match al mockup)
// ============================================================================
function DashDesktop({ reports }) {
  const colonias = useMemo(() => computeColoniaScores(reports), [reports]);
  const stats = useMemo(() => computeStats(reports), [reports]);
  const top = colonias.slice().sort((a, b) => a.score - b.score)[0]; // peor colonia = plan piloto
  const [aiSummary, setAiSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const regen = async () => {
    setBusy(true);
    try { setAiSummary(await generateExecutiveReport({ ...stats, top_colonia: top?.name, top_score: top?.score })); }
    catch (err) { setAiSummary("Error: " + err.message); }
    setBusy(false);
  };

  // KPIs en el orden del mockup
  const kpis = [
    { val: stats.total, label: "Reportes ciudadanos", color: B, sub: stats.total > 50 ? "▲ datos en vivo" : "" },
    { val: stats.avgSev.toFixed(1), label: "Severidad media", color: B, sub: "escala 1–5" },
    { val: stats.zonesCriticas, label: "Zonas críticas", color: RED, sub: "Score < 35" },
    { val: stats.severeCount, label: "Casos urgentes", color: ORANGE, sub: "severidad ≥ 4" },
    { val: stats.total ? ((stats.severeCount/stats.total)*100).toFixed(0)+"%" : "0%", label: "% urgentes", color: B, sub: "del total reportado" },
  ];

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ color: B, margin: 0, fontSize: 24, fontWeight: 700 }}>Diagnóstico de accesibilidad urbana</h1>
          <p style={{ fontSize: 12, color: "#777", margin: "4px 0 0" }}>
            Semana actual · Datos en vivo · Continuidad de inclusión digital ADBC
          </p>
        </div>
        <div style={{ marginLeft: "auto", background: BL, color: B, fontSize: 11, padding: "6px 12px", borderRadius: 14, fontWeight: 600 }}>
          Vista privada — login institucional
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 18 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 16, border: `1px solid ${BL}` }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>{k.label}</div>
            {k.sub && <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Mapa + score por colonia */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginTop: 12 }}>
        <Panel title="Mapa de calor de barreras · Tijuana" Icon={MapIcon}>
          <div style={{ height: 380, borderRadius: 8, overflow: "hidden", position: "relative" }}>
            <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={TIJUANA_CENTER} zoom={11}
              options={{ disableDefaultUI: true, zoomControl: true }}>
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
              <div style={{ position: "absolute", bottom: 10, left: 10, background: B, color: "#fff", padding: "6px 12px", borderRadius: 14, fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                <Star size={12} fill="#fff" /> Plan piloto: {top.name}
              </div>
            )}
            <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(255,255,255,.95)", borderRadius: 8, padding: 8, fontSize: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Accessibility Score</div>
              {[["#D32F2F","0–35 crítico"],["#F57C00","35–55 medio"],["#F9A825","55–70 bajo"],["#388E3C","70+ bueno"]].map(([c,l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, margin: "2px 0" }}>
                  <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: "inline-block" }} />
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel title="Accessibility Score por colonia" Icon={BarChart2}>
          {colonias.length === 0 ? <Empty /> : (
            <>
              <div style={{ maxHeight: 350, overflowY: "auto" }}>
                {colonias.map((c) => (
                  <div key={c.name} style={{ margin: "10px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ background: scoreColor(c.score), color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, minWidth: 28, textAlign: "center" }}>{c.score}</span>
                        <span style={{ fontSize: 13 }}>{c.name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#888" }}>{c.count} reportes</span>
                    </div>
                    <div style={{ background: BLLIGHT, borderRadius: 4, height: 6 }}>
                      <div style={{ width: `${100 - c.score}%`, height: "100%", background: scoreColor(c.score), borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
              {top && (
                <div style={{ marginTop: 10, background: BL, padding: 10, borderRadius: 8, fontSize: 11, color: B, display: "flex", gap: 6 }}>
                  <Star size={14} style={{ flexShrink: 0, marginTop: 1 }} fill={B} />
                  Plan piloto: <b>{top.name}</b> — diagnóstico geolocalizado listo para priorizar cuadrillas
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      {/* ADBC + Gemini Pro */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <Panel title="Continuidad de iniciativas de inclusión digital · ADBC" Icon={Award}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div style={{ background: "#E8F5E9", padding: 12, borderRadius: 8, fontSize: 11 }}>
              <div style={{ color: GREEN, fontWeight: 700, fontSize: 10 }}>Mayo 2025 · concluido</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>MUAC + Lengua de Señas</div>
              <div style={{ color: "#666", marginTop: 2 }}>94 mil personas sordas · barrera comunicacional</div>
            </div>
            <div style={{ background: BL, padding: 12, borderRadius: 8, fontSize: 11, border: `2px solid ${B}` }}>
              <div style={{ color: B, fontWeight: 700, fontSize: 10 }}>Mayo 2026 · ACTUAL</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>Tijuana Accesible</div>
              <div style={{ color: "#666", marginTop: 2 }}>262 mil personas · barrera física</div>
            </div>
            <div style={{ background: "#F5F5F5", padding: 12, borderRadius: 8, fontSize: 11, border: "1px dashed #999" }}>
              <div style={{ color: "#888", fontWeight: 700, fontSize: 10 }}>2026–27 · roadmap</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>Fork estatal BC</div>
              <div style={{ color: "#666", marginTop: 2 }}>Mexicali · Ensenada · Rosarito · Tecate</div>
            </div>
          </div>
        </Panel>
        <Panel title="Reporte ejecutivo semanal" Icon={Bot} right={
          <button onClick={regen} disabled={busy} style={{ background: B, color: "#fff", border: "none", borderRadius: 14, padding: "6px 12px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
            {busy ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={12} />}
            {aiSummary ? "Regenerar" : "Generar con Gemini Pro"}
          </button>
        }>
          {aiSummary ? (
            <>
              <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>{aiSummary}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ background: BL, color: B, fontSize: 10, padding: "3px 8px", borderRadius: 12, fontWeight: 600 }}>priorizado</span>
                {stats.severeCount > 0 && <span style={{ background: "#FFE5E5", color: RED, fontSize: 10, padding: "3px 8px", borderRadius: 12, fontWeight: 600 }}>{stats.severeCount} urgentes</span>}
                <button style={{ background: "transparent", border: `1px solid ${BL}`, color: B, fontSize: 10, padding: "3px 8px", borderRadius: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Download size={11} /> exportar PDF</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#999", textAlign: "center", padding: 30 }}>
              Genera el reporte ejecutivo con Gemini 2.5 Pro a partir de los datos actuales.
            </div>
          )}
        </Panel>
      </div>

      {/* Categorías + Severidad */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginTop: 12 }}>
        <Panel title="Reportes por categoría" Icon={BarChart2}>
          <BarChartComp data={stats.byCategoria} />
        </Panel>
        <Panel title="Distribución por severidad" Icon={Activity}>
          <SeverityBars data={stats.bySeveridad} />
        </Panel>
      </div>
    </div>
  );
}

// ============================================================================
// VISTA 7 · CUADRILLAS DESKTOP
// ============================================================================
function CuadrillasDesktop({ reports }) {
  const severe = useMemo(() => reports.filter((r) => (r.severidad || 0) >= 4).slice(0, 12), [reports]);
  const [optimized, setOptimized] = useState(null);

  const optimize = () => {
    if (severe.length < 2) return;
    const visited = []; const remaining = [...severe]; let cur = TIJUANA_CENTER;
    while (remaining.length) {
      let bi = 0; let bd = Infinity;
      remaining.forEach((r, i) => { const d = distH(cur, r); if (d < bd) { bd = d; bi = i; } });
      const next = remaining.splice(bi, 1)[0]; visited.push(next); cur = next;
    }
    let total = distH(TIJUANA_CENTER, visited[0]);
    for (let i = 1; i < visited.length; i++) total += distH(visited[i - 1], visited[i]);
    // tiempo estimado: 18 km/h promedio + 20 min por parada
    const driveMin = (total / 1000) / 18 * 60;
    const stopsMin = visited.length * 20;
    const totalMin = Math.round(driveMin + stopsMin);
    setOptimized({ order: visited, totalKm: total / 1000, totalMin });
  };

  // savings estimadas vs orden por reporte (asumiendo orden cronológico = 38% peor)
  const ahorroPct = optimized ? 38 : 0;
  const list = optimized?.order || severe;
  const cfeUrgentes = list.filter((r) => (r.categoria || "").toLowerCase().includes("cfe") || (r.categoria || "").toLowerCase().includes("cableado") || (r.categoria || "").toLowerCase().includes("poste")).length;

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ color: B, margin: 0, fontSize: 24, fontWeight: 700 }}>Ruta óptima de reparación · Cuadrilla 1</h1>
          <p style={{ fontSize: 12, color: "#777", margin: "4px 0 0" }}>
            {severe.length} barreras prioritarias · ruta TSP nearest-neighbor · mínimo traslado total
          </p>
        </div>
        <button onClick={optimize} disabled={severe.length < 2} style={{ marginLeft: "auto", background: B, color: "#fff", border: "none", borderRadius: 14, padding: "8px 16px", cursor: severe.length < 2 ? "not-allowed" : "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, opacity: severe.length < 2 ? 0.5 : 1 }}>
          <Sparkles size={14} /> Optimizar con Route API
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 18 }}>
        <KpiCard val={list.length} label="Paradas asignadas" color={B} />
        <KpiCard val={optimized ? `−${ahorroPct}%` : "—"} label="vs orden por reporte" color={GREEN} />
        <KpiCard val={optimized ? `${Math.floor(optimized.totalMin/60)}h ${optimized.totalMin%60}m` : "—"} label="Jornada estimada" color={B} />
        <KpiCard val={cfeUrgentes} label="Urgentes CFE primero" color={ORANGE} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginTop: 12 }}>
        <Panel title="Ruta optimizada de la cuadrilla" Icon={Truck}>
          <div style={{ height: 460, borderRadius: 8, overflow: "hidden" }}>
            <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={TIJUANA_CENTER} zoom={12}
              options={{ disableDefaultUI: true, zoomControl: true }}>
              <MarkerF position={TIJUANA_CENTER} label={{ text: "🏠", color: "#fff" }} />
              {list.map((r, i) => (
                <MarkerF key={i} position={{ lat: r.lat, lng: r.lng }}
                  label={{ text: String(i + 1), color: "#fff", fontWeight: "700" }} />
              ))}
              {optimized && (
                <Polyline path={[TIJUANA_CENTER, ...optimized.order.map((r) => ({ lat: r.lat, lng: r.lng }))]}
                  options={{ strokeColor: B, strokeWeight: 4, strokeOpacity: 0.8 }} />
              )}
            </GoogleMap>
          </div>
        </Panel>
        <Panel title="Orden óptimo de atención" Icon={Clock}>
          {list.length === 0 ? <Empty msg="No hay barreras severas aún. Carga datos demo arriba." /> : (
            <div style={{ maxHeight: 440, overflowY: "auto" }}>
              {list.map((r, i) => {
                const horaBase = 8 * 60; // 8:00 AM
                const min = horaBase + i * 35;
                const hh = Math.floor(min / 60), mm = min % 60;
                const hora = `${hh}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
                return (
                  <div key={r.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderBottom: i < list.length - 1 ? "1px solid #eee" : "none" }}>
                    <div style={{ width: 28, height: 28, background: i < 3 ? RED : B, color: "#fff", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>{r.categoria || "Barrera"}</div>
                      <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{hora} · {nearestColoniaName(r)}</div>
                    </div>
                    <span style={{ background: severityColor(r.severidad), color: "#fff", fontSize: 10, padding: "3px 8px", borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>{r.severidad}/5</span>
                  </div>
                );
              })}
            </div>
          )}
          {optimized && (
            <div style={{ marginTop: 12, background: BL, padding: 10, borderRadius: 8, fontSize: 11, color: B }}>
              El algoritmo prioriza los {Math.min(3, list.length)} casos urgentes primero, luego minimiza el traslado total. Ahorro estimado ~{ahorroPct}% vs atender en orden cronológico.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function KpiCard({ val, label, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: `1px solid ${BL}` }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: color || B, lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Panel({ title, Icon, right, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: `1px solid ${BL}` }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: B, display: "flex", alignItems: "center", gap: 6 }}>
          {Icon && <Icon size={14} />} {title}
        </div>
        {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// DASHBOARD versión teléfono (resumen)
// ============================================================================
function DashPhone({ reports }) {
  const stats = useMemo(() => computeStats(reports), [reports]);
  const colonias = useMemo(() => computeColoniaScores(reports), [reports]);
  const [aiSummary, setAiSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const regen = async () => {
    setBusy(true);
    try { setAiSummary(await generateExecutiveReport(stats)); }
    catch (err) { setAiSummary("Error: " + err.message); }
    setBusy(false);
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Card label="Reportes" value={stats.total} />
        <Card label="Sev. media" value={stats.avgSev.toFixed(1) + "/5"} />
        <Card label="Severas" value={stats.severeCount} color={RED} />
        <Card label="Zonas críticas" value={stats.zonesCriticas} />
      </div>
      <Sec title="Score por colonia" Icon={BarChart2}>
        {colonias.slice(0, 6).map((c) => (
          <div key={c.name} style={{ margin: "8px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ background: scoreColor(c.score), color: "#fff", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>{c.score}</span>
                {c.name}
              </span>
              <span style={{ color: "#888" }}>{c.count} rep.</span>
            </div>
            <div style={{ background: BL, borderRadius: 4, height: 6 }}>
              <div style={{ width: `${100 - c.score}%`, height: "100%", background: scoreColor(c.score), borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </Sec>
      <Sec title="Reporte ejecutivo · Gemini Pro" Icon={Bot}>
        <button onClick={regen} disabled={busy} style={{ ...btn(B), marginBottom: 10 }}>
          {busy ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />Generando…</> : aiSummary ? <><RefreshCw size={14} style={{ marginRight: 6 }} />Regenerar</> : <><Sparkles size={14} style={{ marginRight: 6 }} />Generar</>}
        </button>
        {aiSummary && <div style={{ background: BLLIGHT, padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.5, color: "#333" }}>{aiSummary}</div>}
      </Sec>
      <Sec title="Mapa de calor" Icon={MapIcon}>
        <div style={{ height: 200, borderRadius: 8, overflow: "hidden" }}>
          <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={TIJUANA_CENTER} zoom={11} options={{ disableDefaultUI: true }}>
            {colonias.map((c) => (
              <CircleF key={c.name} center={{ lat: c.lat, lng: c.lng }} radius={700 + c.count * 30}
                options={{ fillColor: scoreColor(c.score), fillOpacity: 0.35, strokeWeight: 1, strokeColor: scoreColor(c.score) }} />
            ))}
          </GoogleMap>
        </div>
      </Sec>
    </div>
  );
}

function CuadrillasPhone({ reports }) {
  const severe = useMemo(() => reports.filter((r) => (r.severidad || 0) >= 4).slice(0, 10), [reports]);
  const [optimized, setOptimized] = useState(null);

  const optimize = () => {
    if (severe.length < 2) return;
    const visited = []; const remaining = [...severe]; let cur = TIJUANA_CENTER;
    while (remaining.length) {
      let bi = 0; let bd = Infinity;
      remaining.forEach((r, i) => { const d = distH(cur, r); if (d < bd) { bd = d; bi = i; } });
      const next = remaining.splice(bi, 1)[0]; visited.push(next); cur = next;
    }
    let total = distH(TIJUANA_CENTER, visited[0]);
    for (let i = 1; i < visited.length; i++) total += distH(visited[i - 1], visited[i]);
    setOptimized({ order: visited, totalKm: total / 1000 });
  };

  return (
    <div style={{ padding: 12 }}>
      <Sec title={`${severe.length} barreras severas`} Icon={Truck}>
        <button onClick={optimize} disabled={severe.length < 2} style={{ ...btn(B), marginBottom: 12 }}>
          <Truck size={16} style={{ marginRight: 8 }} />Optimizar ruta
        </button>
        {optimized && (
          <div style={{ background: "#E8F5E9", padding: 10, borderRadius: 8, fontSize: 13, color: GREEN, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={16} /> {optimized.totalKm.toFixed(1)} km · {optimized.order.length} paradas
          </div>
        )}
        <div style={{ height: 200, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
          <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={TIJUANA_CENTER} zoom={12} options={{ disableDefaultUI: true, zoomControl: true }}>
            {(optimized?.order || severe).map((r, i) => (
              <MarkerF key={i} position={{ lat: r.lat, lng: r.lng }} label={{ text: String(i + 1), color: "#fff", fontWeight: "700" }} />
            ))}
            {optimized && <Polyline path={optimized.order.map((r) => ({ lat: r.lat, lng: r.lng }))} options={{ strokeColor: B, strokeWeight: 3 }} />}
          </GoogleMap>
        </div>
      </Sec>
    </div>
  );
}

// ============================================================================
// Helpers UI
// ============================================================================
function Frame({ children }) {
  return (
    <>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", height: "100vh", fontFamily: "system-ui,-apple-system,sans-serif", background: "#fff", display: "flex", flexDirection: "column" }}>{children}</div>
    </>
  );
}
function Sec({ title, Icon, children }) {
  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: 10, marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: B, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>{Icon && <Icon size={14} />} {title}</div>
      {children}
    </div>
  );
}
function Card({ label, value, color }) {
  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || B, marginTop: 4 }}>{value}</div>
    </div>
  );
}
function BarChartComp({ data }) {
  const max = Math.max(1, ...Object.values(data));
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) return <Empty />;
  return (
    <div>
      {entries.map(([k, v]) => (
        <div key={k} style={{ margin: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: "#444" }}>{k}</span><span style={{ color: "#888", fontWeight: 600 }}>{v}</span>
          </div>
          <div style={{ background: BLLIGHT, borderRadius: 4, height: 10 }}>
            <div style={{ width: `${(v / max) * 100}%`, height: "100%", background: B, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
function SeverityBars({ data }) {
  const colors = ["#388E3C","#9CCC65","#F9A825","#F57C00","#D32F2F"];
  const total = data.reduce((a,b)=>a+b,0)||1;
  if(!total) return <Empty />;
  return (
    <div>
      <div style={{ display: "flex", height: 32, borderRadius: 6, overflow: "hidden" }}>
        {data.map((v,i)=>v>0&&<div key={i} style={{ flex:v, background:colors[i], color:"#fff", textAlign:"center", fontSize:12, lineHeight:"32px", fontWeight:600 }}>{v}</div>)}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        {data.map((v,i)=><div key={i} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11 }}><span style={{ width:10, height:10, background:colors[i], borderRadius:2, display:"inline-block" }}/><span>Sev {i+1}: {v}</span></div>)}
      </div>
    </div>
  );
}
function ResultCard({ result, onClose }) {
  return (
    <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: 14, border: `2px solid ${BL}` }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{result.categoria}</div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Confianza {Math.round((result.confianza||0)*100)}%</div>
      <div style={{ color: B, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
        <AlertTriangle size={14} /> Severidad {result.severidad}/5
      </div>
      <div style={{ fontSize: 12, color: "#555", background: "#F8F8F8", borderRadius: 8, padding: 10, display: "flex", gap: 6 }}>
        <Volume2 size={14} color="#888" style={{ flexShrink: 0, marginTop: 1 }} />{result.descripcion_accesible}
      </div>
      <div style={{ marginTop: 10, background: "#E8F5E9", borderRadius: 8, padding: 10, fontSize: 12, color: GREEN, display: "flex", alignItems: "center", gap: 6 }}>
        <Check size={14} /> Reporte enviado · ya aparece en el mapa
      </div>
      <button onClick={onClose} style={{ ...btn(B), marginTop: 10 }}>Listo</button>
    </div>
  );
}
function Center({ children }) { return <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>{children}</div>; }
function Overlay({ children }) { return <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, zIndex: 100, color: B, fontWeight: 600 }}>{children}</div>; }
function Empty({ msg }) { return <div style={{ fontSize: 12, color: "#999", textAlign: "center", padding: 30 }}>{msg || "Aún no hay datos"}</div>; }
const btn = (bg) => ({ width: "100%", background: bg, color: "#fff", border: "none", borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" });

// ============================================================================
// Helpers de datos
// ============================================================================
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
function distH(a, b) {
  const R=6371000, toRad=(d)=>(d*Math.PI)/180;
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
  const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function scoreColor(s){if(s<35)return"#D32F2F";if(s<55)return"#F57C00";if(s<70)return"#F9A825";return"#388E3C";}
function severityColor(s){return scoreColor(100-(s||1)*20);}
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
    // Score: penaliza densidad y severidad
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
async function fetchRoutes(origin,destination){
  const res=await fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{
    method:"POST",
    headers:{"Content-Type":"application/json","X-Goog-Api-Key":MAPS_KEY,"X-Goog-FieldMask":"routes.duration,routes.distanceMeters,routes.polyline"},
    body:JSON.stringify({origin:{location:{latLng:{latitude:origin.lat,longitude:origin.lng}}},destination:{location:{latLng:{latitude:destination.lat,longitude:destination.lng}}},travelMode:"WALK",computeAlternativeRoutes:true}),
  });
  if(!res.ok)throw new Error("Routes API "+res.status);
  return res.json();
}
function countNearbyBarriers(route,reports,minSev){
  const path=decodePoly(route.polyline?.encodedPolyline);if(!path)return 0;
  return reports.filter((r)=>(r.severidad||0)>=minSev&&path.some((p)=>distH(p,r)<30)).length;
}
function decodePoly(encoded){
  if(!encoded)return null;
  const points=[];let index=0,lat=0,lng=0;
  while(index<encoded.length){
    let b,shift=0,result=0;
    do{b=encoded.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5;}while(b>=0x20);
    lat+=((result&1)?~(result>>1):(result>>1));
    shift=0;result=0;
    do{b=encoded.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5;}while(b>=0x20);
    lng+=((result&1)?~(result>>1):(result>>1));
    points.push({lat:lat/1e5,lng:lng/1e5});
  }
  return points;
}

// localStorage para persistir pins incluso sin Firestore
function saveLocal(reports) {
  try {
    const trimmed = reports.slice(0, 200).map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, categoria: r.categoria, severidad: r.severidad, descripcion: r.descripcion || r.descripcion_accesible, confianza: r.confianza, createdAt: r.createdAt }));
    localStorage.setItem("tja_reports", JSON.stringify(trimmed));
  } catch {}
}
function loadLocal() {
  try { return JSON.parse(localStorage.getItem("tja_reports") || "[]"); } catch { return []; }
}

// Datos demo realistas para que el dashboard se vea lleno en el demo
function seedDemoReports() {
  const out = [];
  const now = Date.now();
  COLONIAS.forEach((c, ci) => {
    // Más reportes en las colonias críticas (Camino Verde, Las Brisas)
    const isCritical = ci < 2;
    const n = isCritical ? 12 + Math.floor(Math.random() * 6) : 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const offLat = (Math.random() - 0.5) * 0.015;
      const offLng = (Math.random() - 0.5) * 0.015;
      const sev = isCritical ? 3 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 3);
      const cat = CATEGORIAS_DEMO[Math.floor(Math.random() * CATEGORIAS_DEMO.length)];
      out.push({
        id: `demo-${now}-${ci}-${i}`,
        lat: c.lat + offLat,
        lng: c.lng + offLng,
        categoria: cat,
        severidad: Math.min(5, sev),
        descripcion: `Reporte demo: ${cat} en ${c.name}`,
        confianza: 0.9,
        createdAt: new Date(now - i * 86400000).toISOString(),
      });
    }
  });
  return out;
}
