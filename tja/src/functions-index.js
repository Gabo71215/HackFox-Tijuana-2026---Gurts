// functions/index.js
// Bot de WhatsApp para Tijuana Accesible.
// Flujo: Meta manda mensaje → Gemini extrae destino → Places API geocodea →
//        bot responde con link a la app pre-llenado.

const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// ── Variables de entorno (configurar con `firebase functions:secrets:set`) ──
const WHATSAPP_TOKEN     = process.env.WHATSAPP_TOKEN;       // Meta Cloud API access token
const WHATSAPP_PHONE_ID  = process.env.WHATSAPP_PHONE_ID;    // Phone number ID de Meta
const WHATSAPP_VERIFY    = process.env.WHATSAPP_VERIFY;      // Token verificación webhook (lo inventas tú)
const GEMINI_KEY         = process.env.GEMINI_KEY;           // Misma que VITE_GEMINI_API_KEY
const MAPS_KEY           = process.env.MAPS_KEY;             // Misma que VITE_GOOGLE_MAPS_API_KEY
const APP_URL            = process.env.APP_URL || "https://hackfox-tijuana.web.app";

// ── Webhook handler ────────────────────────────────────────────────────────
exports.whatsapp = onRequest({ cors: true }, async (req, res) => {
  // VERIFICACIÓN del webhook (Meta hace GET cuando configuras la URL)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === WHATSAPP_VERIFY) {
      console.log("✅ Webhook verificado");
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  // MENSAJES entrantes
  if (req.method === "POST") {
    try {
      const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
      const msg = entry?.messages?.[0];
      if (!msg || msg.type !== "text") return res.status(200).send("ok"); // ignorar audio/imagen por ahora

      const from = msg.from;                  // número del usuario
      const text = msg.text.body;             // lo que escribió
      console.log(`📩 de ${from}: ${text}`);

      // 1. Extraer destino con Gemini
      const parsed = await extractDestination(text);
      console.log("🤖 parsed:", parsed);

      // Si no se entendió un destino, pedir aclaración
      if (!parsed?.destino) {
        await sendMessage(from,
          "Hola 👋 Soy *Tijuana Accesible*. Dime *a dónde quieres ir* y te genero una ruta accesible.\n\nEjemplo:\n_quiero ir al IMSS Clínica 20_\n_cómo llego al CECUT en silla de ruedas_"
        );
        return res.status(200).send("ok");
      }

      // 2. Buscar coordenadas con Places Text Search
      const place = await geocodePlace(parsed.destino);
      if (!place) {
        await sendMessage(from, `No pude encontrar "${parsed.destino}" en Tijuana 😕. ¿Puedes ser más específico? Ej: _Hospital General de Tijuana_`);
        return res.status(200).send("ok");
      }

      // 3. Construir link a la app con destino pre-cargado
      const perfil = parsed.perfil || "silla_manual";
      const params = new URLSearchParams({
        to_lat: place.lat.toFixed(5),
        to_lng: place.lng.toFixed(5),
        to_name: place.name,
        perfil,
      });
      const link = `${APP_URL}/?${params.toString()}`;

      // 4. Responder
      const reply =
        `✅ Listo. Te llevo a *${place.name}*.\n\n` +
        `📍 Dirección: ${place.address}\n` +
        `♿ Perfil: ${perfilLabel(perfil)}\n\n` +
        `Abre tu ruta accesible aquí:\n${link}\n\n` +
        `Te calcula pendientes, evita barreras reportadas y te guía paso a paso con voz.`;

      await sendMessage(from, reply);
      return res.status(200).send("ok");
    } catch (err) {
      console.error("❌ webhook error:", err);
      return res.status(200).send("ok"); // siempre 200 a Meta o reintenta
    }
  }

  res.status(405).send("Method not allowed");
});

// ── Gemini: extraer destino + perfil del mensaje ───────────────────────────
async function extractDestination(text) {
  const prompt = `Eres el asistente de WhatsApp de Tijuana Accesible, una app de accesibilidad urbana del Ayuntamiento de Tijuana, BC, México.

El usuario te escribió: "${text}"

Tu trabajo es extraer:
1. El LUGAR DE DESTINO en Tijuana al que quiere ir (puede ser un hospital, escuela, plaza, dirección, colonia, parada, etc.)
2. El PERFIL DE ACCESIBILIDAD si lo menciona (silla manual, silla eléctrica, muletas, baja visión)

Responde SOLO con JSON válido, sin markdown, sin explicaciones. Formato:
{
  "destino": "nombre del lugar lo más específico posible, o null si no se entiende",
  "perfil": "silla_manual" | "silla_electrica" | "muletas" | "baja_vision" | null
}

Si el usuario solo saluda o pregunta cómo funciona el bot, regresa destino: null.
Si el usuario menciona un lugar fuera de Tijuana, regresa destino: null.

JSON:`;

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 200, responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) {
    console.error("Gemini error:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (e) {
    console.error("JSON parse fail:", raw);
    return null;
  }
}

// ── Places Text Search: buscar el lugar en Tijuana ─────────────────────────
async function geocodePlace(query) {
  const fullQuery = `${query}, Tijuana, Baja California, México`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": MAPS_KEY,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: fullQuery,
      languageCode: "es-MX",
      regionCode: "MX",
      locationBias: {
        circle: {
          center: { latitude: 32.5149, longitude: -117.0382 },
          radius: 25000.0,
        },
      },
      maxResultCount: 1,
    }),
  });
  if (!res.ok) {
    console.error("Places error:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const place = data.places?.[0];
  if (!place?.location) return null;
  return {
    name: place.displayName?.text || query,
    address: place.formattedAddress || "",
    lat: place.location.latitude,
    lng: place.location.longitude,
  };
}

// ── WhatsApp Cloud API: enviar mensaje ──────────────────────────────────────
async function sendMessage(to, body) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: true },
    }),
  });
  if (!res.ok) {
    console.error("WhatsApp send error:", res.status, await res.text());
  }
  return res.ok;
}

// ── helpers ────────────────────────────────────────────────────────────────
function perfilLabel(p) {
  return {
    silla_manual: "Silla manual",
    silla_electrica: "Silla eléctrica",
    muletas: "Muletas",
    baja_vision: "Baja visión",
  }[p] || "Silla manual (predeterminado)";
}
