# WhatsApp Bot — Tijuana Accesible

Bot local. Corre en tu laptop, usa TU WhatsApp como cuenta del bot.

## Setup (5 min, una sola vez)

### 1. Crear carpeta `bot/` en la raíz del repo

```bash
cd ~/Documents/GitHub/HackFox-Tijuana-2026---Gurts
mkdir bot
cd bot
```

### 2. Suelta los 3 archivos dentro de `bot/`

- `bot.js`
- `package.json` (lo descargas como `bot-package.json`, renómbralo a `package.json`)
- `.env` (lo creas tú, ver paso 4)

### 3. Instalar dependencias

```bash
npm install
```

⚠️ Esto tarda 1-2 min porque descarga Puppeteer (~200 MB). Es normal.

### 4. Crear archivo `.env` en la carpeta `bot/`

```bash
nano .env
```

Pega esto (mismas keys que usa la app):

```
GEMINI_API_KEY=AQ.Ab8RN6JX8P3UP9oFwupArCqhDZJ6FnJ5be544JVisf5cZa-LrQ
GOOGLE_MAPS_API_KEY=AIzaSyANQ8T7F0Hzbpjbc-cmbyh6jFPbvAYmGI0
APP_URL=http://localhost:5181
```

Guarda con `Ctrl+O` → `Enter` → `Ctrl+X`.

> Si ya hiciste deploy a Firebase, cambia `APP_URL` a `https://hackfox-tijuana.web.app`

## Correr

```bash
npm start
```

Te aparecerá un **QR enorme en la terminal**. Ahora:

1. Abre WhatsApp en tu cel
2. Configuración (engranaje) → **Dispositivos vinculados**
3. **Vincular un dispositivo**
4. Apunta a la terminal y escanea el QR

Cuando veas `✅ Bot listo. Escuchando mensajes...`, ya está activo.

## Cómo se usa

Cualquier persona que te escriba a TU WhatsApp recibe respuesta del bot. Ejemplos:

| Persona escribe | Bot responde |
|---|---|
| `hola` | Menú con ejemplos |
| `quiero ir al IMSS Clínica 20` | Ruta con destino resuelto, link a la app + Google Maps |
| `cómo llego de Plaza Río al CECUT` | Ruta de A a B con ambos links |
| `ruta del Centro a la UABC` | Ruta de A a B |

## En el pitch (lo más importante)

**Tienes 2 opciones para demostrarlo:**

### Opción A: el juez te escribe a TU número
Pones un slide con tu QR de WhatsApp (genera uno en `qr.me-qr.com` con tu link `wa.me/52[tu-numero]`). El juez escanea, le abre WhatsApp con conversación contigo, te escribe "quiero ir al IMSS Clínica 20". Le respondes desde el bot.

### Opción B: tú mandas el mensaje desde otro cel
Otro miembro del equipo tiene su WhatsApp en otro cel. Te escribe en vivo "quiero ir al CECUT" y el demo se ve en pantalla compartida en tu Mac (con WhatsApp Web abierto en Chrome para que se vea la conversación en vivo).

**Opción B es más confiable** porque no dependes de que el juez configure nada.

## Cómo lo vendes en el pitch

> "Una persona en silla de ruedas que no quiere descargar otra app — ya tiene WhatsApp, 96% de penetración en México. Le escribe a nuestro bot 'quiero ir al IMSS' y en 3 segundos recibe la ruta accesible certificada, sin instalar nada. Para el ayuntamiento esto es el canal de atención más universal posible."

## Si algo sale mal

| Problema | Solución |
|---|---|
| El QR no aparece | Espera 30 seg más, Puppeteer tarda en arrancar |
| `Error: Cannot find module 'whatsapp-web.js'` | Falta `npm install` |
| QR escaneado pero no dice "Bot listo" | Cierra todo, borra la carpeta `.wwebjs_auth`, vuelve a `npm start` |
| El bot no responde | Verifica que la terminal siga corriendo. Si la cierras, se desconecta. |
| Mensajes con error de Gemini | Verifica que `GEMINI_API_KEY` esté bien en `.env` |

## Riesgos honestos

- **WhatsApp puede detectar automation y banear tu cuenta.** Para uso ligero de demo es muy raro, pero existe. Considera usar un número alternativo si te preocupa.
- **Si cierras la laptop o la terminal, el bot deja de responder.** Mantén la terminal abierta durante todo el pitch.
- **Es una solución de hackathon.** Para producción real se usa WhatsApp Business Cloud API de Meta (lo cual sí es legal y oficial), pero requiere registro, número verificado, y servidor público — todo lo que no se puede hacer en horas.

## En el roadmap del pitch

> "En producción migramos a WhatsApp Business Cloud API con número verificado por SEDEBI, soporte para múltiples idiomas (mixteco, zapoteco, inglés frontera), y handoff humano cuando el usuario lo requiere."
