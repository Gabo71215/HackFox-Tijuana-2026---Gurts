// functions/index.js
// Para syncToSheets necesitas:
//   1) cd functions && npm install googleapis
//   2) Crear una Service Account en Google Cloud Console
//   3) Darle acceso de Editor al Google Sheet
//   4) firebase functions:secrets:set SHEETS_SA_KEY  (pega el JSON de la service account)
//   5) firebase functions:secrets:set SHEET_ID       (el ID de tu Sheet, de la URL)
// Cloud Functions (2nd gen). Dos funciones:
//  1) reportarA072  -> envía un correo anónimo formal al 072 (sin datos personales)
//  2) clasificarBarrera -> clasificación con Gemini DEL LADO DEL SERVIDOR
//     (camino de producción: la API key de Gemini vive aquí, no en el cliente)
//
// Deploy:  firebase deploy --only functions
// Requiere:  cd functions && npm install firebase-functions firebase-admin nodemailer @google/generative-ai

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Secrets (se configuran con: firebase functions:secrets:set NOMBRE)
const GEMINI_KEY = defineSecret("GEMINI_KEY");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");

const REPORT_EMAIL_TO = "072@tijuana.gob.mx"; // TODO: confirmar canal real con el municipio

// 1) REPORTE ANÓNIMO AL 072 ---------------------------------------------------
exports.reportarA072 = onCall({ secrets: [SMTP_USER, SMTP_PASS] }, async (request) => {
  const { folio, categoria, severidad, lat, lng, colonia, photoUrl } = request.data || {};
  if (!categoria || !lat || !lng) throw new HttpsError("invalid-argument", "Faltan datos del reporte.");

  // NO se incluye ningún dato del usuario. Solo el hecho reportado.
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
  });

  const html = `
    <h2>Reporte ciudadano de barrera de accesibilidad</h2>
    <p><b>Folio:</b> ${folio}</p>
    <p><b>Categoría:</b> ${categoria}</p>
    <p><b>Severidad:</b> ${severidad}/5</p>
    <p><b>Colonia:</b> ${colonia || "(por geolocalización)"}</p>
    <p><b>Ubicación:</b> ${lat}, ${lng}
       (<a href="https://maps.google.com/?q=${lat},${lng}">ver en mapa</a>)</p>
    ${photoUrl ? `<p><b>Evidencia:</b> <a href="${photoUrl}">foto</a></p>` : ""}
    <hr><p>Reporte anónimo generado por Tijuana Accesible. No contiene datos personales del reportante.</p>`;

  await transporter.sendMail({
    from: `"Tijuana Accesible" <${SMTP_USER.value()}>`,
    to: REPORT_EMAIL_TO,
    subject: `Barrera reportada — ${categoria} — folio ${folio}`,
    html,
  });
  return { ok: true, folio };
});

// 2) CLASIFICACIÓN CON GEMINI (server-side, key protegida) ---------------------
exports.clasificarBarrera = onCall({ secrets: [GEMINI_KEY] }, async (request) => {
  const { imageBase64, mimeType } = request.data || {};
  if (!imageBase64) throw new HttpsError("invalid-argument", "Falta la imagen.");

  const genAI = new GoogleGenerativeAI(GEMINI_KEY.value());
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Clasifica esta barrera de accesibilidad urbana en Tijuana. Responde SOLO JSON:
{"categoria":"...","severidad":<1-5>,"perfiles_afectados":[...],"descripcion_accesible":"...","confianza":<0-1>}`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } },
  ]);
  const text = result.response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(text);
});

// 3) SYNC A GOOGLE SHEETS (para Looker Studio en tiempo real) -----------------
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { google } = require("googleapis");

const SHEETS_SA_KEY = defineSecret("SHEETS_SA_KEY");
const SHEET_ID = defineSecret("SHEET_ID");

exports.syncToSheets = onDocumentCreated(
  { document: "reportes/{reporteId}", secrets: [SHEETS_SA_KEY, SHEET_ID] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const sa = JSON.parse(SHEETS_SA_KEY.value());
    const auth = new google.auth.GoogleAuth({
      credentials: sa,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const fila = [
      data.folio || "",
      data.categoria || "",
      data.severidad || "",
      data.colonia || "",
      data.lat || "",
      data.lng || "",
      data.pendientePct || "",
      data.valido !== false ? "TRUE" : "FALSE",
      data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString("es-MX") : new Date().toLocaleDateString("es-MX"),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID.value(),
      range: "Sheet1!A:I",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [fila] },
    });
  }
);
