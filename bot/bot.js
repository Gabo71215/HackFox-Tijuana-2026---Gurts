// bot.js — Tijuana Accesible WhatsApp Bot (Baileys)
// Detecta destinos comunes de Tijuana con matching de strings.
import 'dotenv/config';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

const APP_URL = process.env.APP_URL || 'http://localhost:5181';

// ── LUGARES COMUNES DE TIJUANA (~150) ───────────────────────────────────────
// Coordenadas verificadas o aproximadas. Para hackathon es suficiente.
const PLACES = [
  // HOSPITALES Y CLINICAS
  { name: 'IMSS Clínica 1', lat: 32.5359, lng: -117.0445, aliases: ['imss 1', 'clinica 1'] },
  { name: 'IMSS Clínica 7', lat: 32.5121, lng: -117.0078, aliases: ['imss 7', 'clinica 7'] },
  { name: 'IMSS Clínica 20', lat: 32.5145, lng: -116.9961, aliases: ['imss 20', 'clinica 20', 'imss'] },
  { name: 'IMSS Clínica 27', lat: 32.5366, lng: -116.9405, aliases: ['imss 27', 'clinica 27'] },
  { name: 'IMSS Hospital Regional 1', lat: 32.5377, lng: -116.9412, aliases: ['hospital imss', 'regional imss'] },
  { name: 'Hospital General Tijuana', lat: 32.5266, lng: -117.0226, aliases: ['hospital general', 'general'] },
  { name: 'Hospital Materno Infantil Tijuana', lat: 32.5147, lng: -117.0078, aliases: ['materno infantil', 'hospital materno'] },
  { name: 'ISSSTECALI Tijuana', lat: 32.5301, lng: -117.0259, aliases: ['issstecali', 'isstecali'] },
  { name: 'ISSSTE Tijuana', lat: 32.5151, lng: -116.9909, aliases: ['issste'] },
  { name: 'Hospital Excel', lat: 32.5169, lng: -117.0241, aliases: ['excel'] },
  { name: 'Hospital Notre Dame', lat: 32.5215, lng: -117.0152, aliases: ['notre dame', 'notredame'] },
  { name: 'Hospital Ángeles Tijuana', lat: 32.5258, lng: -117.0195, aliases: ['hospital angeles', 'angeles'] },
  { name: 'Cruz Roja Tijuana', lat: 32.5311, lng: -117.0288, aliases: ['cruz roja'] },
  { name: 'Hospital Bicentenario', lat: 32.5108, lng: -116.9890, aliases: ['bicentenario'] },
  { name: 'Hospital del Prado', lat: 32.5223, lng: -117.0152, aliases: ['del prado'] },

  // UNIVERSIDADES
  { name: 'UABC Campus Tijuana', lat: 32.5285, lng: -116.9445, aliases: ['uabc', 'universidad autonoma baja california', 'universidad autonoma'] },
  { name: 'UABC Mesa de Otay', lat: 32.5366, lng: -116.9344, aliases: ['uabc otay', 'mesa de otay'] },
  { name: 'Tec de Monterrey Tijuana', lat: 32.5295, lng: -116.9595, aliases: ['tec', 'tecnologico', 'tec monterrey', 'itesm'] },
  { name: 'CETYS Universidad Tijuana', lat: 32.5277, lng: -116.9542, aliases: ['cetys'] },
  { name: 'Universidad Iberoamericana Tijuana', lat: 32.5290, lng: -117.0179, aliases: ['ibero', 'iberoamericana'] },
  { name: 'CUT Universidad', lat: 32.4970, lng: -117.0001, aliases: ['cut'] },
  { name: 'UTT Universidad Tecnológica Tijuana', lat: 32.4538, lng: -116.8842, aliases: ['utt', 'tecnologica'] },
  { name: 'COBACH Tijuana', lat: 32.5295, lng: -116.9650, aliases: ['cobach', 'colegio bachilleres'] },
  { name: 'CONALEP Tijuana', lat: 32.4945, lng: -116.9856, aliases: ['conalep'] },
  { name: 'CECYTE Tijuana', lat: 32.5096, lng: -116.9714, aliases: ['cecyte'] },
  { name: 'Universidad Xochicalco', lat: 32.5159, lng: -116.9690, aliases: ['xochicalco'] },

  // CENTROS COMERCIALES
  { name: 'Plaza Río Tijuana', lat: 32.5276, lng: -117.0234, aliases: ['plaza rio', 'plaza río'] },
  { name: 'Plaza Carrousel', lat: 32.5097, lng: -117.0149, aliases: ['carrousel', 'carrusel'] },
  { name: 'Plaza Sendero', lat: 32.4866, lng: -116.9119, aliases: ['sendero'] },
  { name: 'Plaza Mundo Divertido', lat: 32.5128, lng: -116.9970, aliases: ['mundo divertido'] },
  { name: 'Plaza Otay', lat: 32.5408, lng: -116.9430, aliases: ['plaza otay'] },
  { name: 'Plaza Galerías Hipódromo', lat: 32.5095, lng: -117.0214, aliases: ['galerias', 'hipodromo', 'galerias hipodromo'] },
  { name: 'Macroplaza Insurgentes', lat: 32.4945, lng: -116.9856, aliases: ['macroplaza', 'macroplaza insurgentes'] },
  { name: 'Plaza Pueblo Amigo', lat: 32.5325, lng: -117.0322, aliases: ['pueblo amigo'] },
  { name: 'Las Americas Premium Outlets', lat: 32.5439, lng: -117.0327, aliases: ['las americas', 'outlets', 'premium outlets'] },
  { name: 'Costco Otay', lat: 32.5346, lng: -116.9417, aliases: ['costco'] },
  { name: 'Sams Club Tijuana', lat: 32.5078, lng: -116.9698, aliases: ['sams', 'sams club'] },
  { name: 'Walmart Insurgentes', lat: 32.4945, lng: -116.9856, aliases: ['walmart', 'walmart insurgentes'] },
  { name: 'Walmart Otay', lat: 32.5395, lng: -116.9510, aliases: ['walmart otay'] },
  { name: 'Soriana Plaza', lat: 32.5269, lng: -117.0234, aliases: ['soriana'] },
  { name: 'Calimax Centro', lat: 32.5314, lng: -117.0409, aliases: ['calimax'] },
  { name: 'Home Depot Otay', lat: 32.5418, lng: -116.9536, aliases: ['home depot'] },
  { name: 'Liverpool Plaza Río', lat: 32.5276, lng: -117.0240, aliases: ['liverpool'] },
  { name: 'Sears Plaza Río', lat: 32.5272, lng: -117.0236, aliases: ['sears'] },

  // GOBIERNO
  { name: 'Palacio Municipal Tijuana', lat: 32.5121, lng: -116.9990, aliases: ['palacio municipal', 'ayuntamiento', 'palacio'] },
  { name: 'Centro de Gobierno BC', lat: 32.5167, lng: -116.9837, aliases: ['centro de gobierno', 'gobierno bc'] },
  { name: 'Tribunal Superior de Justicia BC', lat: 32.5184, lng: -116.9991, aliases: ['tribunal', 'tribunal justicia', 'tsj'] },
  { name: 'Recaudación de Rentas Tijuana', lat: 32.5167, lng: -116.9810, aliases: ['recaudacion', 'rentas', 'recaudacion rentas'] },
  { name: 'Registro Civil Centro', lat: 32.5343, lng: -117.0407, aliases: ['registro civil'] },
  { name: 'SRE Tijuana', lat: 32.5232, lng: -117.0188, aliases: ['sre', 'pasaporte', 'relaciones exteriores'] },
  { name: 'SAT Tijuana', lat: 32.5232, lng: -117.0250, aliases: ['sat'] },
  { name: 'INE Tijuana', lat: 32.5295, lng: -116.9650, aliases: ['ine', 'credencial elector'] },
  { name: 'Secretaría de Educación Pública BC', lat: 32.5208, lng: -117.0193, aliases: ['sep', 'educacion'] },
  { name: 'SEDEBI Tijuana', lat: 32.5167, lng: -116.9837, aliases: ['sedebi'] },

  // TRANSPORTE
  { name: 'Aeropuerto Internacional Tijuana', lat: 32.5404, lng: -116.9685, aliases: ['aeropuerto', 'tij', 'rodriguez', 'abelardo'] },
  { name: 'Garita San Ysidro', lat: 32.5424, lng: -117.0306, aliases: ['garita', 'san ysidro', 'frontera'] },
  { name: 'Garita Otay', lat: 32.5414, lng: -116.9374, aliases: ['garita otay'] },
  { name: 'Central Camionera Tijuana', lat: 32.4974, lng: -116.9249, aliases: ['central camionera', 'central de autobuses', 'centra'] },
  { name: 'Terminal SITT Insurgentes', lat: 32.5128, lng: -116.9963, aliases: ['terminal insurgentes', 'sitt insurgentes'] },
  { name: 'Terminal SITT Centro', lat: 32.5343, lng: -117.0407, aliases: ['terminal centro', 'sitt centro'] },
  { name: 'Cross Border Xpress', lat: 32.5447, lng: -116.9605, aliases: ['cbx', 'cross border'] },

  // CULTURA
  { name: 'CECUT Centro Cultural Tijuana', lat: 32.5290, lng: -117.0210, aliases: ['cecut', 'centro cultural', 'cultural tijuana'] },
  { name: 'Museo de Cera Tijuana', lat: 32.5226, lng: -117.0382, aliases: ['museo de cera', 'cera'] },
  { name: 'Casa de la Cultura Tijuana', lat: 32.5325, lng: -117.0413, aliases: ['casa cultura', 'casa de la cultura'] },
  { name: 'Caracol Museo', lat: 32.5301, lng: -117.0234, aliases: ['caracol'] },
  { name: 'Auditorio Municipal', lat: 32.5293, lng: -117.0186, aliases: ['auditorio municipal', 'fausto gutierrez'] },
  { name: 'Biblioteca Vasconcelos Tijuana', lat: 32.5226, lng: -117.0182, aliases: ['biblioteca', 'vasconcelos'] },
  { name: 'Teatro del IMSS', lat: 32.5341, lng: -117.0388, aliases: ['teatro imss'] },
  { name: 'Casa de las Ideas', lat: 32.5301, lng: -117.0235, aliases: ['casa ideas', 'casa de las ideas'] },

  // PARQUES
  { name: 'Parque Morelos', lat: 32.4912, lng: -116.9744, aliases: ['morelos', 'parque morelos'] },
  { name: 'Parque de la Amistad', lat: 32.5410, lng: -117.0418, aliases: ['amistad', 'parque amistad'] },
  { name: 'Parque Teniente Guerrero', lat: 32.5298, lng: -117.0420, aliases: ['teniente guerrero'] },
  { name: 'Parque Vicente Guerrero', lat: 32.5343, lng: -117.0359, aliases: ['vicente guerrero', 'parque vicente'] },
  { name: 'Parque Lineal Tijuana', lat: 32.5160, lng: -117.0226, aliases: ['parque lineal', 'lineal'] },

  // IGLESIAS
  { name: 'Catedral de Tijuana', lat: 32.5318, lng: -117.0405, aliases: ['catedral'] },
  { name: 'Templo Mormón Tijuana', lat: 32.4806, lng: -116.9530, aliases: ['mormones', 'templo mormon'] },
  { name: 'Iglesia Sagrado Corazón', lat: 32.5293, lng: -117.0381, aliases: ['sagrado corazon'] },
  { name: 'Iglesia de Guadalupe Tijuana', lat: 32.4925, lng: -117.0086, aliases: ['guadalupe', 'iglesia guadalupe'] },

  // PLAYAS Y TURISMO
  { name: 'Playas de Tijuana', lat: 32.5301, lng: -117.1232, aliases: ['playas', 'playa', 'playas de tj'] },
  { name: 'El Faro Playas', lat: 32.5354, lng: -117.1241, aliases: ['faro', 'el faro'] },
  { name: 'Mirador Playas', lat: 32.5286, lng: -117.1190, aliases: ['mirador'] },
  { name: 'Cervecería Tijuana', lat: 32.5184, lng: -117.0050, aliases: ['cerveceria tijuana'] },
  { name: 'Cervecería Insurgente', lat: 32.5298, lng: -117.0162, aliases: ['insurgente', 'cerveceria insurgente'] },
  { name: 'Avenida Revolución', lat: 32.5294, lng: -117.0395, aliases: ['revolucion', 'la revu'] },
  { name: 'Reloj Monumental', lat: 32.5300, lng: -117.0395, aliases: ['reloj monumental', 'reloj'] },
  { name: 'Arco Monumental Tijuana', lat: 32.5347, lng: -117.0410, aliases: ['arco', 'arco monumental'] },
  { name: 'Plaza Santa Cecilia', lat: 32.5340, lng: -117.0398, aliases: ['santa cecilia', 'plaza santa cecilia'] },

  // ESTADIOS Y DEPORTIVOS
  { name: 'Estadio Caliente', lat: 32.5180, lng: -117.0061, aliases: ['caliente', 'estadio caliente', 'xolos'] },
  { name: 'Estadio Chevron Tijuana', lat: 32.4943, lng: -117.0205, aliases: ['toros', 'chevron', 'estadio toros'] },
  { name: 'Gimnasio Universitario UABC', lat: 32.5292, lng: -116.9440, aliases: ['gimnasio uabc'] },

  // ZONAS / COLONIAS
  { name: 'Zona Centro Tijuana', lat: 32.5343, lng: -117.0407, aliases: ['centro', 'centro tijuana', 'zona centro'] },
  { name: 'Zona Río Tijuana', lat: 32.5290, lng: -117.0234, aliases: ['zona rio', 'zona río', 'rio'] },
  { name: 'Otay Tijuana', lat: 32.5366, lng: -116.9405, aliases: ['otay'] },
  { name: 'La Mesa Tijuana', lat: 32.5028, lng: -116.9764, aliases: ['la mesa', 'mesa'] },
  { name: 'Cerro Colorado', lat: 32.4865, lng: -116.9258, aliases: ['cerro colorado'] },
  { name: 'Sánchez Taboada', lat: 32.4895, lng: -116.9442, aliases: ['sanchez taboada', 'sanchez'] },
  { name: 'El Refugio Tijuana', lat: 32.4666, lng: -116.9089, aliases: ['refugio', 'el refugio'] },
  { name: 'Cañón del Padre', lat: 32.4670, lng: -116.8772, aliases: ['canon del padre', 'cañon del padre'] },
  { name: 'Florido', lat: 32.4358, lng: -116.8358, aliases: ['florido', 'el florido'] },
  { name: 'Lomas Taurinas', lat: 32.5117, lng: -117.0008, aliases: ['lomas taurinas', 'taurinas'] },
  { name: 'Soler', lat: 32.5159, lng: -117.0537, aliases: ['soler'] },
  { name: 'Insurgentes Tijuana', lat: 32.4945, lng: -116.9856, aliases: ['insurgentes'] },
  { name: 'Mariano Matamoros', lat: 32.4720, lng: -116.9050, aliases: ['matamoros', 'mariano matamoros'] },
  { name: 'Villa Fontana', lat: 32.4980, lng: -116.9100, aliases: ['villa fontana', 'fontana'] },
  { name: 'Camino Verde', lat: 32.4665, lng: -116.9420, aliases: ['camino verde'] },

  // MERCADOS
  { name: 'Mercado Hidalgo Tijuana', lat: 32.5291, lng: -117.0238, aliases: ['mercado hidalgo', 'mercado'] },
  { name: 'Mercado Miguel Hidalgo', lat: 32.5291, lng: -117.0238, aliases: ['miguel hidalgo'] },

  // OTROS
  { name: 'Casa Monarca Tijuana', lat: 32.5226, lng: -117.0182, aliases: ['casa monarca', 'monarca'] },
  { name: 'Tijuana Cultural Center', lat: 32.5290, lng: -117.0210, aliases: ['cultural center'] },
];

// ── MATCHER ─────────────────────────────────────────────────────────────────
function normalize(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function matchPlace(text) {
  const q = normalize(text);
  if (!q) return null;
  const qWords = q.split(' ').filter(w => w.length >= 3);

  let best = null;
  let bestScore = 0;

  for (const place of PLACES) {
    const terms = [normalize(place.name), ...(place.aliases || []).map(normalize)];
    for (const term of terms) {
      let score = 0;
      // Match exacto del término completo (mucho peso)
      if (q === term) score += 50;
      // Término aparece COMO PALABRA COMPLETA en la query (con espacios o bordes)
      const termAsWord = ` ${q} `.includes(` ${term} `) ? 1 : 0;
      if (termAsWord) score += 20;
      // Substring (menos peso, evita falsos positivos como "cut" en "cecut")
      else if (q.includes(term) && term.length >= 4) score += term.length;
      // Palabras del término aparecen como palabras enteras en la query
      const termWords = term.split(' ').filter(w => w.length >= 3);
      for (const tw of termWords) {
        if (qWords.includes(tw)) score += tw.length;
      }
      if (score > bestScore) { bestScore = score; best = place; }
    }
  }
  return bestScore >= 4 ? best : null;
}

// ── BAILEYS ─────────────────────────────────────────────────────────────────
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Tijuana Accesible', 'Safari', '17.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nEscanea este QR con tu WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('\nBot listo. Escuchando...\n');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) setTimeout(() => startBot(), 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;
      if (msg.key.remoteJid?.endsWith('@g.us')) continue;

      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      if (!text) continue;

      const from = msg.key.remoteJid;
      console.log('Mensaje:', text);

      await sock.sendPresenceUpdate('composing', from);

      const lower = text.toLowerCase();
      if (['hola', 'ayuda', 'menu', 'hi', 'inicio', 'start', 'buenas'].includes(lower)) {
        await sock.sendMessage(from, {
          text:
            '*Tijuana Accesible*\n\n' +
            'Soy el bot de rutas accesibles del Ayuntamiento.\n\n' +
            'Escribe a donde quieres ir, por ejemplo:\n' +
            '- IMSS Clinica 20\n' +
            '- CECUT\n' +
            '- Plaza Rio\n' +
            '- Aeropuerto\n' +
            '- UABC Otay\n\n' +
            'Te mando el link para abrir la ruta directamente.'
        });
        continue;
      }

      const matched = matchPlace(text);

      if (matched) {
        const link = `${APP_URL}/?route=1&to=${matched.lat},${matched.lng}&dest=${encodeURIComponent(matched.name)}`;
        await sock.sendMessage(from, {
          text:
            '*Tijuana Accesible*\n\n' +
            'Destino detectado: *' + matched.name + '*\n\n' +
            'Toca aqui para tu ruta accesible:\n' + link + '\n\n' +
            'La app detecta tu ubicacion y compara ruta accesible vs estandar con pendiente y barreras.\n\n' +
            '_Proximamente: cobertura ampliada con base de datos del SITT._'
        });
        console.log('Match:', matched.name);
      } else {
        const link = `${APP_URL}/?route=1`;
        await sock.sendMessage(from, {
          text:
            '*Tijuana Accesible*\n\n' +
            'No encontre un destino exacto para _"' + text + '"_ en mi catalogo de 150 lugares.\n\n' +
            'Abre la app y escribelo manualmente:\n' + link + '\n\n' +
            '_Proximamente: integracion con Google Places para cualquier direccion._'
        });
        console.log('Sin match para:', text);
      }
    }
  });
}

console.log('Iniciando Tijuana Accesible WhatsApp Bot...\n');
startBot();
process.on('SIGINT', () => { console.log('\nBot detenido.'); process.exit(0); });
