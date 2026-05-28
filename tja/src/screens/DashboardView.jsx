// src/screens/DashboardView.jsx
export default function DashboardView({ goTo }) {
  return (
    <div>
      <h2>Panel SEDEBI</h2>

      <iframe
        title="Dashboard Looker Studio"
        src="AQUI_VA_EL_LINK_EMBED_DE_LOOKER"
        width="100%"
        height="700"
        style={{ border: "0" }}
      />

      <button onClick={() => goTo("crews")}>
        Ver optimización de cuadrillas
      </button>

      <button onClick={() => goTo("map")}>
        Volver a app ciudadana
      </button>
    </div>
  );
}