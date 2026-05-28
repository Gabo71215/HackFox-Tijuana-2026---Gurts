// src/screens/CrewOptimizationView.jsx

const B = "#691C32";

const barriers = [
  { id: 1, name: "Camino Verde · banqueta rota", severity: 5, eta: "0 min" },
  { id: 2, name: "Las Brisas · poste CFE", severity: 4, eta: "18 min" },
  { id: 3, name: "Zona Río · rampa bloqueada", severity: 4, eta: "31 min" },
  { id: 4, name: "Otay · cruce sin rampa", severity: 3, eta: "47 min" },
];

export default function CrewOptimizationView({ goTo }) {
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "system-ui" }}>
      <header style={{ background: B, color: "#fff", padding: "14px 18px" }}>
        <b>TIJUANA ACCESIBLE</b>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Optimización de cuadrillas</div>
      </header>

      <main style={{ padding: 16 }}>
        <h2 style={{ marginBottom: 4 }}>Ruta óptima de reparación</h2>
        <p style={{ color: "#666", marginTop: 0 }}>
          Priorización automática de barreras por severidad, zona y tiempo estimado.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Card title="Reportes urgentes" value="12" />
          <Card title="Ahorro estimado" value="-38%" />
          <Card title="Tiempo total" value="4h 20m" />
          <Card title="Cuadrilla asignada" value="1" />
        </div>

        <section style={box}>
          <h3>Mapa de ruta optimizada</h3>
          <div style={mapMock}>
            <div style={{ ...dot, left: "12%", top: "75%" }}>1</div>
            <div style={{ ...dot, left: "30%", top: "58%" }}>2</div>
            <div style={{ ...dot, left: "52%", top: "40%" }}>3</div>
            <div style={{ ...dot, left: "76%", top: "25%" }}>4</div>
            <div style={line}></div>
          </div>
        </section>

        <section style={box}>
          <h3>Orden sugerido de atención</h3>
          {barriers.map((b) => (
            <div key={b.id} style={row}>
              <strong>{b.id}. {b.name}</strong>
              <span>Sev. {b.severity} · {b.eta}</span>
            </div>
          ))}
        </section>

        <button onClick={() => goTo("dashboard")} style={button}>
          Volver al dashboard
        </button>
      </main>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={box}>
      <div style={{ fontSize: 12, color: "#777" }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: B }}>{value}</div>
    </div>
  );
}

const box = {
  background: "#fff",
  borderRadius: 14,
  padding: 14,
  marginTop: 12,
  boxShadow: "0 4px 14px rgba(0,0,0,.06)",
};

const mapMock = {
  position: "relative",
  height: 230,
  background: "#f1eeee",
  borderRadius: 12,
  overflow: "hidden",
};

const dot = {
  position: "absolute",
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: B,
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  zIndex: 2,
};

const line = {
  position: "absolute",
  left: "18%",
  top: "32%",
  width: "58%",
  height: "45%",
  borderLeft: `4px solid ${B}`,
  borderTop: `4px solid ${B}`,
  transform: "skew(-25deg)",
  opacity: 0.7,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #eee",
  fontSize: 13,
};

const button = {
  width: "100%",
  marginTop: 16,
  background: B,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: 13,
  fontWeight: 700,
  cursor: "pointer",
};