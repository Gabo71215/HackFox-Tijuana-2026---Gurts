# Setup del bot de WhatsApp · Tijuana Accesible

**Tiempo realista: 3-4 horas si nada se atora.**

## Pre-requisitos

- [x] Cuenta de Firebase con plan **Blaze** (ya lo tienes)
- [x] `firebase-tools` instalado (`firebase --version`)
- [ ] Un celular con WhatsApp donde harás pruebas (tu número personal sirve)
- [ ] Cuenta personal de Facebook (NO necesitas Meta Business verificado)

---

## PASO 1 · Estructura de carpetas (5 min)

En tu proyecto local, dentro de la raíz `HackFox-Tijuana-2026---Gurts/`, ya debe existir `functions/` (revisa el screenshot que me mandaste — sí está). Si no:

```bash
cd HackFox-Tijuana-2026---Gurts
firebase init functions
# - Cuando pregunte: Use existing project → hackfox-tijuana
# - Language: JavaScript
# - ESLint: No
# - Install dependencies: Yes
```

Pega los 2 archivos que te di:
- `functions-index.js` → renombra a `functions/index.js` (reemplaza el que firebase generó)
- `functions-package.json` → renombra a `functions/package.json` (reemplaza)

Luego:
```bash
cd functions
npm install
cd ..
```

---

## PASO 2 · Meta for Developers (45 min)

### 2.1 Crear app
1. Ve a https://developers.facebook.com/
2. Login con tu Facebook personal
3. Botón **"Mis apps"** → **"Crear app"**
4. Tipo: **"Other"** → siguiente
5. Use case: **"Business"** → siguiente
6. Nombre de app: `Tijuana Accesible Bot`
7. Email: el tuyo
8. **Sin** Business Account (omitir)
9. **Crear app**

### 2.2 Agregar producto WhatsApp
1. En el dashboard de la app que acabas de crear, busca **"WhatsApp"** en la lista de productos
2. Click **"Configurar"**
3. Te pone en el menú de WhatsApp → **"API Setup"**

### 2.3 Obtener credenciales (te las apunto, te las vas a necesitar)
En **API Setup** vas a ver 3 cosas críticas:

- **Test number** que Meta te regala (ej: `+1 555 123 4567`) — este es el número desde el que el bot va a responder
- **Phone number ID** (un número largo tipo `123456789012345`) — **anótalo, lo necesitas para `WHATSAPP_PHONE_ID`**
- **Temporary access token** (string largo que empieza con `EAA...`) — **anótalo, dura 24h, lo necesitas para `WHATSAPP_TOKEN`**

⚠️ **El token es temporal de 24h.** Si quieres uno permanente necesitas crear System User en Business Manager — complicado. Para el demo, regenera el token la mañana del pitch.

### 2.4 Agregar tu número como recipient verificado
1. En la misma página de API Setup, sección **"To"**
2. Click **"Manage phone number list"**
3. Agrega TU NÚMERO PERSONAL de WhatsApp con código de país (ej: `+5218112345678`)
4. Te llega un código a WhatsApp → lo confirmas

Ahora puedes mandarte mensajes desde el bot a tu propio cel.

### 2.5 Test que la API funciona
En API Setup hay un botón **"Send Message"** que te manda un mensaje de prueba. Si no llega a tu cel, revisa que verificaste el número correctamente.

---

## PASO 3 · Configurar variables de entorno (10 min)

En tu carpeta local del proyecto, en la raíz:

```bash
cd HackFox-Tijuana-2026---Gurts

# Invéntate un token de verificación cualquiera (lo usarás en paso 5)
# Por ejemplo: hackfox2026secret
firebase functions:secrets:set WHATSAPP_VERIFY
# Te pregunta el valor → escribe: hackfox2026secret

# Token de Meta (el EAA... que copiaste)
firebase functions:secrets:set WHATSAPP_TOKEN

# Phone number ID
firebase functions:secrets:set WHATSAPP_PHONE_ID

# Tu key de Gemini (la misma del .env)
firebase functions:secrets:set GEMINI_KEY

# Tu key de Google Maps
firebase functions:secrets:set MAPS_KEY
```

Cada uno te va a pedir el valor. Pégalos uno por uno.

Ahora edita `functions/index.js` y arriba del archivo, agrega esta línea al inicio:

```js
const { defineSecret } = require("firebase-functions/params");
const SECRETS = ["WHATSAPP_TOKEN","WHATSAPP_PHONE_ID","WHATSAPP_VERIFY","GEMINI_KEY","MAPS_KEY"];
```

Y en `exports.whatsapp = onRequest(...)` agrega secrets al config:

```js
exports.whatsapp = onRequest(
  { cors: true, secrets: SECRETS },
  async (req, res) => { ... }
);
```

---

## PASO 4 · Deploy de la function (15 min)

```bash
firebase deploy --only functions
```

Esto tarda 2-5 min la primera vez. Al final te da una URL tipo:

```
✔ Function URL (whatsapp): https://us-central1-hackfox-tijuana.cloudfunctions.net/whatsapp
```

**Cópiala. La necesitas para el siguiente paso.**

---

## PASO 5 · Conectar el webhook a Meta (10 min)

1. Vuelve a Meta Developers → tu app → WhatsApp → **Configuration**
2. Sección **"Webhook"** → click **"Edit"**
3. **Callback URL**: la URL que te dio Firebase (`https://us-central1-hackfox-tijuana.cloudfunctions.net/whatsapp`)
4. **Verify token**: `hackfox2026secret` (el que pusiste en el paso 3)
5. **Verify and save** → si todo está bien, te dice "✓ Webhook subscribed"

Si falla:
- Revisa que tu function esté desplegada (`firebase functions:log` para ver errores)
- El verify token tiene que ser EXACTAMENTE el mismo
- Espera 30 seg después del deploy, a veces tarda en propagar

### 5.1 Suscribirse a mensajes
Aún en la sección Webhook, abajo:
- **Webhook fields** → busca **"messages"** → toggle **ON**

Ahora cualquier mensaje que llegue al test number se va a enviar a tu function.

---

## PASO 6 · Probar el bot (10 min)

1. En tu cel, agrega a tus contactos el **test number** de Meta (el `+1 555 ...`)
2. Mándale un WhatsApp: `quiero ir al IMSS Clínica 20`
3. Deberías recibir respuesta con un link a `hackfox-tijuana.web.app/?to_lat=...&to_lng=...`
4. Tocas el link → se abre tu app con destino pre-cargado → calcula ruta sola → "Iniciar navegación"

Si **no responde**:
```bash
firebase functions:log
```

Te dice qué falló (probablemente token expirado, key mala, o algo en el JSON parsing).

---

## PASO 7 · Para el pitch · Generar QR code (2 min)

Para que los jueces escaneen y prueben en vivo:

1. Ve a https://web.whatsapp.com/send?phone=[NÚMERO_TEST]&text=Quiero%20ir%20al%20IMSS%20Cl%C3%ADnica%2020
2. Donde dice [NÚMERO_TEST] pones el test number SIN espacios, ej: `15551234567`
3. Acorta el URL con `bit.ly` o `tinyurl.com`
4. Genera QR de ese URL en https://www.qr-code-generator.com/
5. **Ese QR lo pegas en el slide del pitch**

El juez escanea → se le abre WhatsApp con el mensaje listo → manda → en 3-5 segundos le contesta el bot con link → toca el link → se abre la app con ruta pre-cargada en su cel. **Es un momento WOW si funciona.**

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| "Webhook verify failed" | Verify token diferente | Mismo string exacto en Meta y en `WHATSAPP_VERIFY` |
| Bot no contesta | Token EAA expirado (24h) | Regenera en Meta → `firebase functions:secrets:set WHATSAPP_TOKEN` → redeploy |
| "Recipient phone number not in allowed list" | No verificaste el número del cel | Vuelve a paso 2.4 |
| "Function timeout" | Gemini está lento | Aumenta `timeoutSeconds: 60` en `setGlobalOptions` |
| Link de la app no abre destino | App.jsx viejo | Asegúrate de tener el App.jsx v5 con la lectura de query params |

---

## Plan B si en 2h no jala

Si después de 2h estás atorada en Meta Developer o en el deploy:

**ABANDONA EL BOT.** Implementa esto en su lugar (15 min):

En la card de "Ruta accesible" después de calcular ruta, agrega un botón "📱 Compartir por WhatsApp" que abra:
```js
const txt = `Voy del Centro a ${dest.name} por ruta accesible. ETA ${stats.acc.time} min. ${stats.acc.severas} barreras severas. Ruta: ${appUrl}/?to_lat=${dest.lat}&to_lng=${dest.lng}&to_name=${encodeURIComponent(dest.name)}`;
window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`);
```

Cero servidor. Misma narrativa en el pitch. Y al menos lo presentas funcionando.

---

## Para vender en el pitch (slide nuevo)

> "Tenemos un **bot de WhatsApp** funcionando hoy en día con WhatsApp Cloud API. La persona manda un mensaje libre: *quiero ir al IMSS*. Gemini extrae el destino, Places API lo geocodifica, y el bot devuelve un link directo a la ruta accesible. WhatsApp tiene 96% de penetración en México — esto convierte Tijuana Accesible en un servicio sin fricción de instalación. Una persona con baja visión que no descarga apps nuevas YA tiene WhatsApp."

---

**Cuando hayas terminado paso 6 y el bot conteste, dime. Si te atoras en cualquier paso por más de 30 min, también dime — antes que perderte 3h en algo que no jala.**
