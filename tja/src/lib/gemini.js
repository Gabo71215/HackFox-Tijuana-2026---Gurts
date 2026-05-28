// src/lib/gemini.js
// Capa de IA. Gemini CLASIFICA, DESCRIBE e INTERPRETA. Nunca DECIDE accesibilidad
// (eso lo hace accessibilityScore.js / routing.js de forma determinista).
//
// NOTA DE SEGURIDAD: para el hackathon llamamos Gemini desde el cliente con la key
// de AI Studio. En producción esto va en una Cloud Function (functions/index.js)
// para no exponer la key. Aquí está el camino rápido para el demo.

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Taxonomía de barreras CONTEXTUALIZADA a Tijuana (no un template genérico).
const TAXONOMIA = [
  "poste CFE en banqueta", "cableado informal expuesto", "banqueta rota o levantada",
  "ausencia de rampa", "desnivel banqueta-calle", "obstáculo comercial (puesto, mercancía)",
  "coladera sin tapa", "transición banqueta-calle peligrosa", "escalera sin alternativa",
  "obra sin señalización", "vehículo bloqueando paso", "otro",
];

const PROMPT_CLASIFICACION = `Eres un clasificador de barreras de accesibilidad urbana en Tijuana, México.
Analiza la imagen y responde SOLO con JSON válido, sin markdown ni texto extra, con esta forma exacta:
{
  "categoria": "<una de: ${TAXONOMIA.join(" | ")}>",
  "severidad": <entero 1-5, donde 5 es bloqueo total>,
  "perfiles_afectados": ["<silla manual|silla electrica|muletas|baja vision|andador>", ...],
  "descripcion_accesible": "<una frase corta describiendo el obstáculo y, si aplica, cómo rodearlo, para una persona con baja visión>",
  "confianza": <numero 0-1>
}
No inventes. Si la imagen no muestra una barrera clara, usa categoria "otro" y confianza baja.`;

// Convierte un File/Blob a la parte inline que espera Gemini.
async function fileToInlinePart(file) {
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return { inlineData: { data: base64, mimeType: file.type || "image/jpeg" } };
}

// 1) CLASIFICACIÓN DE FOTO (Gemini Vision, modelo Flash = rápido y barato)
export async function classifyBarrierPhoto(file) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const imagePart = await fileToInlinePart(file);
  const result = await model.generateContent([PROMPT_CLASIFICACION, imagePart]);
  const text = result.response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(text); // {categoria, severidad, perfiles_afectados, descripcion_accesible, confianza}
}

// 2) EXTRACCIÓN NLP DESDE VOZ (texto ya transcrito por Speech-to-Text)
//    Para quien no puede o no sabe escribir: hablan y Gemini estructura.
export async function extractBarrierFromText(transcript) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `El usuario describió una barrera de accesibilidad por voz en Tijuana.
Texto: "${transcript}"
Responde SOLO JSON: {"categoria":"<${TAXONOMIA.join(" | ")}>","severidad":<1-5>,"perfiles_afectados":[...],"resumen":"<frase corta>"}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

// 3) VALIDACIÓN ANTI-MALICIOSOS (idea del equipo).
//    Compara lo que Gemini ve en la foto vs lo que el usuario escribió.
//    Si son muy distintos, el reporte se marca dudoso. (Versión simple por
//    similitud léxica; la versión ML con embeddings va en el roadmap de Steff.)
export function reportLooksValid(geminiCategoria, userText) {
  if (!userText) return true; // si no escribió nada, no penalizamos
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const a = new Set(norm(geminiCategoria).split(/\s+/));
  const b = new Set(norm(userText).split(/\s+/));
  const inter = [...a].filter((w) => b.has(w)).length;
  // si comparten al menos una palabra clave, lo damos por consistente
  return inter > 0;
}

// 4) REPORTE EJECUTIVO SEMANAL (Gemini Pro, para el dashboard SEDEBI)
export async function generateExecutiveReport(stats) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  const prompt = `Eres analista de movilidad urbana. Con estos datos agregados de la semana, escribe un
reporte ejecutivo de máximo 4 frases para un director de SEDEBI (Ayuntamiento de Tijuana). Sé concreto,
prioriza acciones, menciona números. Datos: ${JSON.stringify(stats)}`;
  const result = await model.generateContent(prompt);
  return result.response.text();
}
