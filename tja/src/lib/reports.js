import { db, storage, auth } from "./firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const COL = "reportes";

export async function createReport({ file, gps, classification, valid }) {
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
    descripcion: classification.descripcion_accesible || "",
    colonia: gps.colonia || "",
    lat: gps.lat, lng: gps.lng,
    photoUrl,
    valido: valid !== false,
    folio: "TJA-" + Math.floor(1000 + Math.random() * 9000),
    uidAnon: auth.currentUser?.uid || null,
    createdAt: serverTimestamp(),
  });
}

export function subscribeReports(callback) {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}
