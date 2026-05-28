# Dashboard SEDEBI con Looker Studio

Looker Studio **no se programa** — se arma en el navegador conectándolo a una
fuente de datos. Aquí están las dos rutas y cómo embeberlo. El dashboard vive
detrás de login institucional (es la vista privada, solo directivos).

---

## Por qué Looker Studio (y no solo el dashboard custom)
- Es gratis y es de Google (suma con el jurado de Google).
- Da un look gubernamental profesional sin escribir código de gráficas.
- Se comparte por link con permisos (solo directivos de SEDEBI) — privacidad por rol.
- Se actualiza solo cuando entran reportes nuevos.

Puedes tener **ambos**: el dashboard custom (Vista 6, React) para el demo en vivo,
y el reporte de Looker Studio como el entregable "oficial" que se queda en SEDEBI.

---

## Ruta A — rápida para el hackathon (Firestore → Google Sheet → Looker)
La más simple. No necesita BigQuery.

1. **Exporta los reportes a un Google Sheet** con una Cloud Function que escribe
   cada reporte nuevo en una hoja (usando la API de Google Sheets), o exporta una
   vez los datos del demo a un Sheet a mano.
2. En https://lookerstudio.google.com → **Create → Report**.
3. **Add data → Google Sheets →** elige tu hoja.
4. Arrastra los campos a gráficas:
   - **Scorecard**: total de reportes, severidad media, zonas críticas.
   - **Bar chart**: Accessibility Score por colonia (dimensión `colonia`, métrica `score`).
   - **Geo map / Google Maps**: usa `lat`/`lng` para el mapa de calor.
   - **Tabla**: top barreras por severidad.
5. Aplica colores: burgundy `#691C32` para que combine con la marca.

## Ruta B — producción (Firestore → BigQuery → Looker)
Más robusta, demuestra escala estatal.

1. Instala la extensión de Firebase **"Stream Firestore to BigQuery"**
   (Firebase Console → Extensions). Apunta a la colección `reportes`.
2. En BigQuery se crea una tabla que se llena en tiempo real.
3. (Opcional) Crea una **vista** en BigQuery que calcule el Accessibility Score
   por colonia con SQL/GIS, para que Looker solo lea el resultado.
4. En Looker Studio → **Add data → BigQuery →** elige la tabla/vista.
5. Mismas gráficas que en la Ruta A.

---

## Cómo dejarlo privado (solo directivos)
- En Looker Studio → **Share** → quita "anyone with the link".
- Agrega solo los correos institucionales de SEDEBI/ADBC con permiso de "Viewer".
- Así el panel cumple la separación de accesos: la app ciudadana es pública y
  anónima; el dashboard es privado y por invitación.

## Cómo embeberlo en tu app (opcional)
Looker Studio da un código de **iframe** (File → Embed report). Lo metes en una
ruta protegida de tu app (solo visible tras login con custom claim `directivo`):

```jsx
<iframe
  title="Dashboard SEDEBI"
  width="100%" height="800"
  src="https://lookerstudio.google.com/embed/reporting/XXXX/page/YYYY"
  frameBorder="0" allowFullScreen
/>
```

---

## Esquema de datos que Looker espera (colección `reportes`)
Cada reporte en Firestore (ver `src/lib/reports.js`) ya trae:
`categoria, severidad, perfilesAfectados, colonia, lat, lng, pendientePct,
folio, valido, createdAt`.

El **Accessibility Score por colonia** lo calcula `src/lib/accessibilityScore.js`
(determinista). Para Looker, súbelo precalculado por colonia, o reproduce la
fórmula en SQL/BigQuery:
`score = 100 - (densidad_km2*0.4 + severidad_prom*0.35 + pendiente_pct*0.15 + pct_rutas_severas*0.10)`
