const KEY = import.meta.env.VITE_GEMINI_API_KEY;
const BASE = "https://aiplatform.googleapis.com/v1/publishers/google/models";

const TAXONOMIA = ["poste CFE en banqueta","cableado informal expuesto","banqueta rota o levantada","ausencia de rampa","desnivel banqueta-calle","obstáculo comercial (puesto, mercancía)","coladera sin tapa","escalera sin alternativa","obra sin señalización","vehículo bloqueando paso","otro"];

async function callGemini(model, parts) {
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts }] }),
  });
  if (!res.ok) throw new Error(`Vertex ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function fileToInlinePart(file) {
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return { inlineData: { mimeType: file.type || "image/jpeg", data: base64 } };
}

const PROMPT = `Clasifica esta barrera de accesibilidad urbana en Tijuana. Responde SOLO JSON sin markdown:
{"categoria":"<${TAXONOMIA.join("|")}>","severidad":<1-5>,"perfiles_afectados":["<silla manual|silla electrica|muletas|baja vision>"],"descripcion_accesible":"<frase corta>","confianza":<0-1>}`;

export async function classifyBarrierPhoto(file) {
  const imagePart = await fileToInlinePart(file);
  const text = await callGemini("gemini-2.5-flash", [{ text: PROMPT }, imagePart]);
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export async function extractBarrierFromText(transcript) {
  const prompt = `Barrera descrita por voz en Tijuana: "${transcript}". SOLO JSON: {"categoria":"...","severidad":<1-5>,"perfiles_afectados":[...],"resumen":"..."}`;
  const text = await callGemini("gemini-2.5-flash", [{ text: prompt }]);
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

export function reportLooksValid(geminiCategoria, userText) {
  if (!userText) return true;
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const a = new Set(norm(geminiCategoria).split(/\s+/));
  const b = new Set(norm(userText).split(/\s+/));
  return [...a].filter((w) => b.has(w)).length > 0;
}

export async function generateExecutiveReport(stats) {
  return callGemini("gemini-2.5-pro", [{ text: `Reporte ejecutivo SEDEBI Tijuana, máx 4 frases, con números: ${JSON.stringify(stats)}` }]);
}
