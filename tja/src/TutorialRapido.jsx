
      const B = "#691C32";
      export default function TutorialRapido({ goTo }) {

      return (
        <div style={{ minHeight: "100vh", background: "#f7f4f4", fontFamily: "system-ui" }}>
          <div style={{ background: B, color: "#fff", padding: "16px" }}>
            <div style={{ fontWeight: 800 }}>♿ TIJUANA ACCESIBLE</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>Tutorial rápido · App ciudadana</div>
          </div>

          <div style={{ padding: 18 }}>
            <h2 style={{ color: "#2a0b14", marginBottom: 6 }}>¿Cómo usar la app?</h2>
            <p style={{ color: "#666", fontSize: 13, marginTop: 0 }}>
              En menos de un minuto puedes revisar zonas accesibles y reportar barreras.
            </p>

            {[
              ["1", "Elige tu perfil", "Selecciona si usas silla manual, silla eléctrica, muletas o baja visión."],
              ["2", "Revisa el mapa", "Los círculos muestran el Accessibility Score por colonia. Rojo es crítico, naranja es medio y verde es mejor."],
              ["3", "Reporta una barrera", "Toma una foto de una banqueta rota, poste, rampa bloqueada u otro obstáculo."],
              ["4", "Confirma el resultado", "Gemini clasifica la barrera y el reporte aparece en el mapa de forma anónima."],
            ].map(([num, title, text]) => (
              <div key={num} style={{
                background: "#fff",
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
                boxShadow: "0 4px 14px rgba(0,0,0,.06)",
                display: "flex",
                gap: 12
              }}>
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: B,
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  flexShrink: 0
                }}>
                  {num}
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: "#2a0b14" }}>{title}</div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 3 }}>{text}</div>
                </div>
              </div>
            ))}

            <h3 style={{ color: "#2a0b14", marginTop: 18 }}>Casos de uso</h3>

            {[
              ["🏥", "Voy al IMSS", "Reviso qué ruta evita banquetas rotas y zonas críticas."],
              ["📸", "Vi una barrera", "Tomo foto y la app genera un reporte anónimo."],
              ["🗺️", "Quiero entender mi colonia", "Uso el score para ver qué tan accesible es mi zona."],
            ].map(([icon, title, text]) => (
              <div key={title} style={{
                background: "#F5E6EA",
                borderRadius: 14,
                padding: 13,
                marginBottom: 10
              }}>
                <div style={{ fontWeight: 800, color: B }}>{icon} {title}</div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 3 }}>{text}</div>
              </div>
            ))}

            <button onClick={() => setScreen("map")}
              style={{
                width: "100%",
                marginTop: 14,
                background: B,
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: 14,
                fontWeight: 800,
                cursor: "pointer"
              }}>
              Volver al mapa
            </button>
          </div>
        </div>
      )}