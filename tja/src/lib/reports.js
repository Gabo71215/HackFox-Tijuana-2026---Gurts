// src/lib/reports.js
// Lectura/escritura de reportes en Firestore + subida de fotos a Storage.
import { db, storage, auth } from "./firebase";
import {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const COL = "reportes";

// Sube la foto (ya con caras/placas difuminadas idealmente) y crea el reporte.
export async function createReport({ file, gps, classification, userText, valid }) {
  let photoUrl = null;
  if (file) {
    const path = `reportes/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const snap = await uploadBytes(ref(storage, path), file);
    photoUrl = await getDownloadURL(snap.ref);
  }
  return addDoc(collection(db, COL), {
    categoria: classification.categoria,
    severidad: classification.severidad,
    perfilesAfectados: classification.perfiles_afectados || [],
    descripcion: classification.descripcion_accesible || classification.resumen || "",
    pendientePct: 0,            // se enriquece luego con Elevation API
    colonia: gps.colonia || "", // se enriquece con geocoding inverso
    lat: gps.lat, lng: gps.lng,
    photoUrl,
    valido: valid !== false,    // marca anti-maliciosos
    folio: "TJA-" + Math.floor(1000 + Math.random() * 9000),
    uidAnon: auth.currentUser?.uid || null, // anónimo, no es dato personal
    createdAt: serverTimestamp(),
  });
}

// Suscripción en tiempo real a todos los reportes (para el mapa).
export function subscribeReports(callback) {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
