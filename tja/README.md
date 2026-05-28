# Tijuana Accesible — Guía de integración

Este repo trae el código listo. Lo que sigue es **lo que tú tienes que conectar**
(las cosas que requieren tus llaves, tu billing y tu deploy). Sigue el orden.

---

## 0. Prerrequisitos
- Node 18+ y npm
- Una cuenta de Google con acceso a los créditos de Google Cloud del hackathon
- `npm install -g firebase-tools`

```bash
npm install            # instala dependencias del frontend
cp .env.example .env   # luego rellena .env con tus llaves (pasos de abajo)
```

---

## 1. Proyecto de Google Cloud + Firebase  (5 min)
1. Crea un proyecto en https://console.firebase.google.com (ej. `tijuana-accesible`).
   Esto crea automáticamente el proyecto de Google Cloud asociado.
2. En **Project settings → General → Your apps → Web**, copia la config y pégala
   en `.env` (las variables `VITE_FIREBASE_*`).
3. Activa con los créditos del hackathon el plan **Blaze** (necesario para Cloud
   Functions y para las APIs de Maps). Con los créditos no pagas de tu bolsa.

## 2. Firebase: Auth, Firestore, Storage  (5 min)
- **Authentication → Sign-in method →** activa **Anonymous**.
- **Firestore Database →** crea la base en modo producción.
- **Storage →** habilítalo.
- Publica las reglas:
  ```bash
  firebase deploy --only firestore:rules
  ```
  (usa el archivo `firestore.rules` de este repo)

## 3. Google Maps Platform — habilita las APIs  (5 min)
En https://console.cloud.google.com/google/maps-apis, en TU proyecto, habilita:
- Maps JavaScript API
- Routes API
- Elevation API
- Places API (New)
- Roads API        (opcional — ajusta reportes a la banqueta)
- Weather API      (opcional — re-ruteo por lluvia)

Crea una **API key** (Credentials → Create credentials → API key).
- Pégala en `.env` → `VITE_GOOGLE_MAPS_API_KEY`.
- **Restríngela**: por referente HTTP a `localhost` y a tu dominio `*.web.app`.

## 4. Gemini  (2 min)
1. Ve a https://aistudio.google.com/apikey y crea una API key.
2. Pégala en `.env` → `VITE_GEMINI_API_KEY`.

> Para el hackathon, Gemini se llama desde el cliente (`src/lib/gemini.js`).
> Para producción, mueve la llamada a la Cloud Function `clasificarBarrera`
> (`functions/index.js`) para no exponer la key. Ver paso 6.

## 5. Corre la app  (1 min)
```bash
npm run dev
```
Abre la URL local en el **celular** (mismo wifi) o con `ngrok` para probar cámara y GPS.
La cámara y el GPS requieren HTTPS — al desplegar en Firebase Hosting ya es HTTPS.

## 6. Cloud Functions — reporte al 072 y Gemini server-side  (10 min)
```bash
cd functions
npm install firebase-functions firebase-admin nodemailer @google/generative-ai
# secrets (no se exponen en el cliente):
firebase functions:secrets:set GEMINI_KEY     # pega tu key de Gemini
firebase functions:secrets:set SMTP_USER      # un correo gmail emisor
firebase functions:secrets:set SMTP_PASS      # app password de ese gmail
cd ..
firebase deploy --only functions
```
- Cambia `REPORT_EMAIL_TO` en `functions/index.js` por el canal real del 072/SEDEBI.
- Para Gmail necesitas un **App Password** (cuenta con 2FA): https://myaccount.google.com/apppasswords

## 7. Deploy  (2 min)
```bash
npm run build
firebase deploy            # despliega hosting + functions + rules
```
Te queda una URL pública tipo `https://tijuana-accesible.web.app` con HTTPS,
lista para el demo en celular.

---

## Resumen: qué integras TÚ (checklist)
- [ ] Proyecto Firebase + plan Blaze con créditos del hackathon
- [ ] Anonymous Auth activado
- [ ] Firestore + Storage creados, reglas publicadas
- [ ] APIs de Maps habilitadas + API key en `.env` (restringida)
- [ ] Gemini API key en `.env`
- [ ] Secrets de Cloud Functions (GEMINI_KEY, SMTP_USER, SMTP_PASS)
- [ ] `REPORT_EMAIL_TO` con el canal real del municipio
- [ ] `firebase deploy`

Lo que YO (el código) ya dejé hecho: toda la lógica — auth anónima, subida de
foto, clasificación Gemini, score determinista, ruteo accesible, reglas de
seguridad por rol, y las Cloud Functions. Tú solo conectas llaves y despliegas.
