import { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import { ensureAnonymousAuth } from "./lib/firebase";
import { subscribeReports, createReport } from "./lib/reports";
import { classifyBarrierPhoto } from "./lib/gemini";
import RouteView from "./screens/RouteView";
import DashboardView from "./screens/DashboardView";
import CrewOptimizationView from "./screens/CrewOptimizationView";


const B = "#691C32";
const TIJUANA_CENTER = { lat: 32.5149, lng: -117.0382 };
const PROFILES = [
  { id: "silla_manual", label: "Silla manual", icon: "♿" },
  { id: "silla_electrica", label: "Silla eléctrica", icon: "⚡" },
  { id: "muletas", label: "Muletas", icon: "🦯" },
  { id: "baja_vision", label: "Baja visión", icon: "👁️" },
];

export default function App() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });
  const [screen, setScreen] = useState("home");
  const [profile, setProfile] = useState(null);
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    ensureAnonymousAuth().then(() => subscribeReports(setReports));
  }, []);

  const handlePhoto = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setResult(null);
    try {
      const gps = await getGps();
      const classification = await classifyBarrierPhoto(file);
      setResult({ ...classification, gps });
      setBusy(false);
      createReport({ file, gps, classification, valid: true }).catch(err => console.error("Save:", err));
    } catch (err) {
      alert("Error: " + err.message);
      setBusy(false);
    }
  }, []);

  if (!isLoaded) return <div style={{display:"grid",placeItems:"center",height:"100vh",color:B}}>Cargando…</div>;

  return (
    <div style={{maxWidth:430,margin:"0 auto",minHeight:"100vh",fontFamily:"system-ui",background:"#fff"}}>
      {screen==="home" && (
        <div style={{background:B,minHeight:"100vh",color:"#fff",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"40px 24px 24px",textAlign:"center"}}>
            <div style={{fontSize:48}}>♿</div>
            <h1 style={{fontSize:24,margin:"8px 0 4px"}}>TIJUANA ACCESIBLE</h1>
            <p style={{opacity:0.7,fontSize:12}}>FITD 2026 · ADBC · Google Cloud</p>
          </div>
          <div style={{flex:1,background:"#fff",borderRadius:"24px 24px 0 0",padding:22,color:"#222"}}>
            <h3 style={{color:"#3a0f1a"}}>¿Cómo te mueves hoy?</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,margin:"14px 0"}}>
              {PROFILES.map(p => (
                <button key={p.id} onClick={()=>setProfile(p.id)}
                  style={{padding:16,borderRadius:12,cursor:"pointer",
                    border:profile===p.id?`2px solid ${B}`:"2px solid #eee",
                    background:profile===p.id?"#F5E6EA":"#fafafa"}}>
                  <div style={{fontSize:26}}>{p.icon}</div>
                  <div style={{fontSize:12,marginTop:6}}>{p.label}</div>
                </button>
              ))}
            </div>
            <button disabled={!profile} onClick={()=>setScreen("map")}
              style={{width:"100%",background:profile?B:"#ccc",color:"#fff",border:"none",borderRadius:10,padding:13,fontSize:14,fontWeight:600,cursor:"pointer"}}>
              🔒 Continuar sin registro →
            </button>
          </div>
        </div>
      )}
      {screen === "route" && (
        <RouteView profile={profile} goTo={setScreen} />
      )}

      {screen === "dashboard" && (
        <DashboardView goTo={setScreen} />
      )}

      {screen === "crews" && (
        <CrewOptimizationView goTo={setScreen} />
      )}

      {screen==="map" && (
        <div style={{display:"flex",flexDirection:"column",height:"100vh"}}>
          <div style={{background:B,color:"#fff",padding:"12px 16px",display:"flex",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:13}}>TIJUANA ACCESIBLE</div>
              <div style={{fontSize:9,opacity:0.7}}>FITD 2026 · ADBC · Google Cloud</div>
            </div>
            <span style={{marginLeft:"auto",background:"rgba(255,255,255,.15)",borderRadius:12,padding:"3px 10px",fontSize:11}}>
              {PROFILES.find(p=>p.id===profile)?.icon} {PROFILES.find(p=>p.id===profile)?.label}
            </span>
          </div>
          <GoogleMap mapContainerStyle={{flex:1,width:"100%"}} center={TIJUANA_CENTER} zoom={13}
            options={{disableDefaultUI:true,zoomControl:true}}>
            {reports.map(r => (
              <MarkerF key={r.id} position={{lat:r.lat,lng:r.lng}} label={{text:"!",color:"#fff",fontWeight:"700"}}/>
            ))}
          </GoogleMap>
          <div style={{padding:12,borderTop:"1px solid #F5E6EA"}}>
            <button onClick={()=>fileRef.current?.click()}
              style={{width:"100%",background:B,color:"#fff",border:"none",borderRadius:10,padding:13,fontSize:14,fontWeight:600,cursor:"pointer"}}>
              📸 Reportar barrera
            </button>
              <button onClick={() => setScreen("route")}>Ruta accesible</button>
              <button onClick={() => setScreen("dashboard")}>Panel SEDEBI</button>
              <button onClick={() => setScreen("crews")}>Cuadrillas</button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhoto} style={{display:"none"}}/>
          </div>
          {busy && (
            <div style={{position:"fixed",inset:0,background:"rgba(255,255,255,.9)",display:"grid",placeItems:"center",color:B,fontWeight:600}}>
              Analizando con Gemini Vision…
            </div>
          )}
          {result && (
            <div style={{position:"fixed",left:0,right:0,bottom:0,maxWidth:430,margin:"0 auto",
              background:"#fff",borderRadius:"16px 16px 0 0",boxShadow:"0 -8px 30px rgba(0,0,0,.2)",padding:16}}>
              <div style={{fontWeight:700,fontSize:16}}>{result.categoria}</div>
              <div style={{fontSize:11,color:"#888"}}>confianza {Math.round((result.confianza||0)*100)}%</div>
              <div style={{margin:"8px 0",color:B,fontWeight:600}}>Severidad {result.severidad}/5</div>
              <div style={{fontSize:12,color:"#555",background:"#f4f4f4",borderRadius:8,padding:10}}>
                🔊 {result.descripcion_accesible}
              </div>
              <div style={{marginTop:10,background:"#E8F5E9",borderRadius:8,padding:10,fontSize:12,color:"#2E7D46"}}>
                ✓ Reporte enviado · ya aparece en el mapa
              </div>
              <button onClick={()=>setResult(null)}
                style={{width:"100%",background:B,color:"#fff",border:"none",borderRadius:10,padding:13,fontSize:14,fontWeight:600,cursor:"pointer",marginTop:10}}>
                Listo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getGps() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(TIJUANA_CENTER);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({lat:pos.coords.latitude,lng:pos.coords.longitude}),
      () => resolve(TIJUANA_CENTER),
      {enableHighAccuracy:true,timeout:5000}
    );
  });
}
