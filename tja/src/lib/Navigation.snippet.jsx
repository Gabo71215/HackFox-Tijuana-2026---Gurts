// ════════════════════════════════════════════════════════════════════════════
// PARCHE — MODO NAVEGACIÓN TURN-BY-TURN
//
// Tres cambios al App.jsx en este orden exacto:
//   ① Agregar 2 íconos al import de lucide-react
//   ② Reemplazar la función RouteView (botón "Iniciar navegación" cuando hay ruta)
//   ③ Pegar el nuevo componente NavigationMode al final del archivo
// ════════════════════════════════════════════════════════════════════════════


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ① BUSCA esta línea al inicio del archivo:
//
//   import {
//     Map as MapIcon, Camera, ..., HelpCircle, Crosshair, Layers, X,
//   } from "lucide-react";
//
// AGRÉGALE Play y Compass para que quede:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// (ya lo tienes con: Play, Compass añadidos así)
// import {
//   Map as MapIcon, Camera, Mic, MicOff, Navigation, MessageCircle,
//   Accessibility, Zap, Activity, Eye, Lock, Check, AlertTriangle, Star,
//   Truck, BarChart2, Bot, RefreshCw, Send, LogOut, Monitor, Smartphone,
//   MapPin, Loader2, Volume2, ArrowRight, TrendingUp, Sparkles,
//   ChevronRight, HelpCircle, Crosshair, Layers, X, Play, Compass,
// } from "lucide-react";


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ② REEMPLAZA COMPLETA la función RouteView con esta versión.
//    Busca: function RouteView({ profile, reports }) {
//    Reemplaza desde ahí hasta su cierre (línea con } cerrando RouteView).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function RouteView({ profile, reports }) {
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
  const [navigating, setNavigating] = useState(false); // 🆕 modo navegación

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

  // 🆕 Si está en modo navegación, renderiza overlay completo
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

                {/* 🆕 Botón "Iniciar navegación" */}
                <button onClick={() => setNavigating(true)} className="tap" style={{
                  width: "100%", marginTop: 14, padding: "12px 16px",
                  background: color, color: "#fff", border: "none", borderRadius: 12,
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: `0 8px 20px ${color}40`,
                }}>
                  <Play size={16} fill="#fff" /> Iniciar navegación
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ③ PEGA estos 3 helpers + el componente NavigationMode al FINAL del archivo
//    (después de la última función, antes del cierre del módulo)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Habla en español-MX, cancelando lo anterior para no traslapar
function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-MX";
  u.rate = 1.05;
  u.pitch = 1.0;
  window.speechSynthesis.speak(u);
}

// Trae los steps con maneuvers desde Routes API v2
async function fetchSteps(origin, dest) {
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAPS_KEY,
        "X-Goog-FieldMask": "routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.steps.polyline",
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

// Ícono SVG del marcador "tu posición" con dirección (flecha rotada)
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
  const watchIdRef = useRef(null);
  const announcedRef = useRef(new Set());
  const userMarkerRef = useRef(null);
  const polylineRef = useRef(null);

  // Cargar steps
  useEffect(() => {
    fetchSteps(origin, dest).then((s) => {
      setSteps(s);
      if (s[0]?.navigationInstruction?.instructions) {
        speak("Iniciando navegación. " + s[0].navigationInstruction.instructions);
      } else {
        speak("Iniciando navegación accesible.");
      }
    });
  }, [origin, dest]);

  // watchPosition continuo
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

  // Centrar mapa en usuario + actualizar marker
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

  // Dibujar la ruta
  useEffect(() => {
    if (!mapInstance || !path?.length) return;
    if (polylineRef.current) polylineRef.current.setMap(null);
    polylineRef.current = new window.google.maps.Polyline({
      path, strokeColor: GREEN, strokeWeight: 7, strokeOpacity: 0.92, map: mapInstance, zIndex: 5,
    });
    return () => { polylineRef.current?.setMap(null); };
  }, [mapInstance, path]);

  // Avisos: próximo paso + barreras cercanas + llegada
  useEffect(() => {
    if (!userPos || arrived) return;

    // ¿Llegamos?
    const dDest = distH(userPos, dest);
    if (dDest < 20) {
      speak("Has llegado a tu destino.");
      setArrived(true);
      return;
    }

    // Avisar próximo paso cuando estás cerca de su inicio
    if (steps[currentStep]) {
      const startLoc = steps[currentStep].startLocation?.latLng;
      if (startLoc) {
        const dStep = distH(userPos, { lat: startLoc.latitude, lng: startLoc.longitude });
        const key = `step-${currentStep}`;
        if (dStep < 25 && !announcedRef.current.has(key)) {
          const text = steps[currentStep].navigationInstruction?.instructions || "Continúa derecho";
          speak(text);
          announcedRef.current.add(key);
          setTimeout(() => setCurrentStep((s) => s + 1), 1000);
        }
      }
    }

    // Avisar barreras severas en ~80m
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

  const currentInstruction = steps[currentStep]?.navigationInstruction?.instructions || (arrived ? "Has llegado" : "Continúa derecho");
  const distRemaining = userPos ? Math.round(distH(userPos, dest)) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 500, display: "flex", flexDirection: "column" }}>
      {/* Banner superior con instrucción actual */}
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
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginTop: 2 }}
            dangerouslySetInnerHTML={{ __html: currentInstruction }} />
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

      {/* Mapa fullscreen */}
      <div style={{ flex: 1, position: "relative" }}>
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

        {/* Recenter button */}
        <button onClick={() => userPos && mapInstance?.panTo(userPos)} className="tap" style={{
          position: "absolute", bottom: 110, right: 14,
          background: "#fff", border: "none", borderRadius: "50%",
          width: 48, height: 48, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          display: "grid", placeItems: "center", cursor: "pointer", color: B,
        }}>
          <Compass size={22} />
        </button>
      </div>

      {/* Footer con stats */}
      <div className="glass-dark" style={{
        padding: "14px 16px",
        paddingBottom: "max(14px, env(safe-area-inset-bottom))",
        color: "#fff", display: "flex", gap: 14,
        background: "rgba(28,28,30,0.88)",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Distancia</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>{(distRemaining / 1000).toFixed(2)} km</div>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,0.15)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Aproximado</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>{Math.max(1, Math.round(distRemaining / 80))} min</div>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,0.15)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Avisos</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: GREEN, letterSpacing: -0.4 }}>{announcedRef.current.size}</div>
        </div>
      </div>
    </div>
  );
}
