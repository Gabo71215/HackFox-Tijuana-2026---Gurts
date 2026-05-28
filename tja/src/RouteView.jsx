// src/screens/RouteView.jsx
import { useState } from "react";
import { computeRoutes, rankAccessibleRoutes } from "./lib/routing";

export default function RouteView({ profile, goTo }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  async function handleRoute() {
    const routes = await computeRoutes({ origin, destination });
    const ranked = rankAccessibleRoutes(routes, profile);
    console.log(ranked);
  }

  return (
    <div>
      <h2>Ruta accesible</h2>

      <input
        placeholder="Origen"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
      />

      <input
        placeholder="Destino"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
      />

      <button onClick={handleRoute}>Comparar rutas</button>
      <button onClick={() => goTo("map")}>Volver al mapa</button>
    </div>
  );
}