# Oración — app de oración y versículos con IA

Una oración escrita para ti y un versículo de la Biblia, cada día. Incluye diario, capilla de velas (de pago por tamaño), un acompañante conversacional con créditos, suscripción Premium y una red de seguridad ante crisis.

**Pila:** Node 22 + Express · React (Vite) instalable como PWA · PostgreSQL (SQLite en local) · Anthropic API · Stripe Checkout · Resend.
El navegador **nunca** habla con la IA ni con Stripe directamente: todo pasa por el servidor, que es quien aplica los límites de cada plan.

---

## 1. Estado real (léelo antes de lanzar)

**Probado automáticamente (`npm test`, ~76 pruebas de API + 9 de interfaz):** cuentas y sesiones, límites mensuales aplicados en servidor, detección de riesgo, aislamiento entre usuarios, exportar/borrar datos, velas y caducidad, acompañante y créditos, webhooks de Stripe con firma real, idempotencia de pagos, recuperación de contraseña, límite de intentos, y el recorrido completo de la interfaz.

**NO probado con servicios reales (no había claves ni navegador):**
- Llamadas reales a Anthropic: se probó con un cliente simulado. Los parámetros (`thinking`, `output_config.effort`) siguen la documentación; si la API los rechazara con un 400, el código reintenta con los valores por defecto.
- Stripe real: se probó con un cliente simulado y la verificación de firma real. Pruébalo en **modo test** antes de cobrar nada.
- PostgreSQL: solo se probó SQLite (`better-sqlite3` es una dependencia opcional solo para local y pruebas; en producción usa PostgreSQL). El acceso a datos usa Knex, pensado para ser portable, pero compruébalo en el primer despliegue.
- Aspecto visual en navegadores reales y en móvil: revísalo tú.

**Pendiente de decisión o revisión humana:**
1. **Textos legales** (`client/src/screens/Legal.jsx`): son un borrador. Los debe revisar un abogado. Los datos de religión y de salud emocional son categoría especial del RGPD.
2. **Detección de riesgo** (`server/services/crisis.js`): es heurística, no clínica. Debe revisarla un profesional de salud mental.
3. **Teléfonos de ayuda** (`server/data/helplines.json`): verificados el 2026-10-20. Revisa al menos una vez al año. Para Andorra solo consta el 112.
4. **Versículos** (`server/data/verses.json`): ~1.000 versículos en 91 temas. El texto es el real de la Reina-Valera 1909, tomado del repositorio `scrollmapper/bible_databases` (declarado como dominio público): confirma tú su situación legal. Las referencias y los resúmenes en lenguaje actual los elegí yo y se validaron automáticamente (que cada referencia exista y el texto sea el correcto), pero **conviene que una persona con formación bíblica revise que cada versículo encaje con su tema**. Para añadir o cambiar versículos edita `scripts/verses-source.json` y ejecuta `node scripts/build-verses.mjs <SpaRV.json>` (descarga `formats/json/SpaRV.json` del repositorio anterior). El script también marca cuáles se leen bien hoy (`readable`), que son los únicos que usa el versículo del día.
   - **Licencias de traducciones modernas** (RVR1960, NVI…): requieren licencia. Biblica (NVI) permite citar hasta 500 versículos sin permiso, con aviso de copyright y sin superar el 25 % de la obra; este catálogo ya pasa de 500, así que haría falta permiso escrito. API.Bible (American Bible Society) ofrece licencias comerciales por traducción con cuota mensual según el número de usuarios (el precio sale en su proceso de compra), pero cuenta como comercial cualquier app con suscripción o plan gratis con venta, exige renovar la caché cada 30 días y no todas las traducciones están disponibles. Antes de usarlas hay que cambiar cómo se guardan los versículos en el diario (hoy se guarda el texto).
5. **Condiciones de Anthropic sobre datos de la API:** verifica las vigentes y actualiza la política de privacidad.
6. **IVA e impuestos:** pregunta a tu gestor cómo facturar servicios digitales a consumidores de la UE (y de Andorra). Stripe Tax está soportado (`STRIPE_AUTOMATIC_TAX=true`) pero hay que configurarlo en Stripe.
7. **Precios y límites:** son propuestas (ver `.env.example`).

---

## 2. Arrancar en local

```bash
npm install
npm --prefix client install
npm run build          # compila el frontend
npm start              # http://localhost:3000
```

> **Requisito local:** `better-sqlite3` compila código nativo. Si `npm install` no la instala (npm la omite en silencio si falla), instala Python y un compilador de C++ y repite, o apunta `DATABASE_URL` a un PostgreSQL local. En producción no hace falta.

Sin `ANTHROPIC_API_KEY` funciona en **modo demostración** (oraciones de ejemplo, sin IA). Sin `STRIPE_SECRET_KEY` los **pagos están desactivados**: Premium, las velas medianas/grandes y los créditos aparecen como «próximamente». Para probar esas pantallas en tu ordenador puedes simular compras sin cobrar con `PAYMENTS_MODE=demo` (se ignora en producción, para que un despliegue público nunca regale Premium).

Para desarrollar con recarga: `npm run dev` (API) y `npm run dev:client` (Vite en :5173, con proxy a la API).

Para usar la IA real en local, crea un `.env` o exporta `ANTHROPIC_API_KEY`. **No subas nunca claves al repositorio.**

## 3. Desplegar con GitHub + Railway

1. Sube esta carpeta a un repositorio de GitHub (el `.gitignore` ya excluye claves y datos).
2. En Railway: **New Project → Deploy from GitHub repo** y elige el repositorio. `railway.json` ya indica el compilador, el comando de arranque y la comprobación de salud (`/api/health`).
3. En el mismo proyecto añade una base de datos: **New → Database → PostgreSQL**.
4. En el servicio de la app, pestaña **Variables**, define (ver `.env.example`):
   - `NODE_ENV=production`
   - `JWT_SECRET` (genera uno: `openssl rand -hex 32`)
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}` (referencia al servicio de base de datos)
   - `ANTHROPIC_API_KEY`
   - `APP_URL` con la URL pública definitiva, con `https://`
   - `SUPPORT_EMAIL`, `LEGAL_ENTITY`, `LEGAL_ADDRESS`
5. Genera un dominio público del servicio (Settings → Networking) o conecta el tuyo, y actualiza `APP_URL` con él.
6. Las tablas se crean solas al arrancar. Al arrancar, el servidor imprime avisos si falta algo importante (IA, pagos, correo, https).

> Los nombres exactos de los menús de Railway pueden cambiar; la lógica (repositorio → PostgreSQL → variables → dominio) es la misma.

### Versión para enseñar a amigos (sin pagos, sin Resend)
Con solo estas variables funciona: `NODE_ENV=production`, `JWT_SECRET`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `APP_URL` y, opcionalmente, `ANTHROPIC_API_KEY`. No pongas Stripe ni Resend: los pagos salen como «próximamente» y nadie puede activarse Premium. Sin Resend, quien olvide su contraseña no podrá recuperarla.

### Quién puede registrarse y cómo ver a las personas
- **Registro cerrado:** define `INVITE_CODE` y solo podrá crear cuenta quien tenga ese código. Sin la variable, cualquiera con el enlace puede registrarse.
- **No hay verificación de correo** (necesitaría Resend): cualquiera podría registrarse con un correo ajeno. El código de invitación lo evita mientras sea una prueba.
- **Panel de administración:** define `ADMIN_EMAILS` con tu correo y **regístrate tú primero**. Verás en Cuenta una sección «Administración» con la lista de personas (alta, último acceso, plan y cuántas oraciones, velas y mensajes tienen) y podrás borrar cuentas. Nunca muestra lo que escriben.
- Además, en Railway puedes ver las tablas en el servicio PostgreSQL → pestaña Database. Ahí sí se ve el contenido que escribe la gente: evítalo, y menciona en la política de privacidad quién tiene acceso.

### Stripe (primero en modo test)
1. Crea la cuenta de Stripe y copia la clave secreta **de test** en `STRIPE_SECRET_KEY`.
2. Developers → Webhooks → añade el endpoint `https://TU-DOMINIO/api/billing/webhook` con estos eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
3. Copia el secreto de firma (`whsec_…`) en `STRIPE_WEBHOOK_SECRET`.
4. Activa el **portal de clientes** (Settings → Billing → Customer portal) para que puedan cancelar.
5. Prueba con tarjetas de test. Cuando todo funcione, repite con las claves reales.

### Correo
Crea una cuenta en Resend, verifica tu dominio y pon `RESEND_API_KEY` y `MAIL_FROM`. Sin esto no se envían correos de recuperación de contraseña.

## 4. Cómo funciona (resumen para modificar)

| Qué | Dónde |
|---|---|
| Límites, precios, tamaños de vela | `server/config.js` (y variables de entorno) |
| Prompts de la IA (oración, clasificador, acompañante) | `server/services/ai.js` |
| Patrones de riesgo y teléfonos | `server/services/crisis.js`, `server/data/helplines.json` |
| Versículo del día y personalización | `server/services/verses.js` |
| Pagos y webhooks | `server/services/stripe.js`, `server/routes/billing.js` |
| Pantallas | `client/src/screens/` |
| Colores y tipografía | `client/src/styles.css` (variables al principio) |
| Nombre de la app | `client/src/brand.js`, `client/index.html`, `client/public/manifest.webmanifest`, `scripts/make-icons.mjs` |

Decisiones de diseño que conviene conocer:
- **Cómo se elige el versículo:** (1) una IA rápida detecta de 1 a 2 temas; (2) el servidor reúne los versículos de esos temas (sin los vistos hace poco); (3) la IA elige el que mejor encaja **solo entre esos candidatos**; si devuelve algo que no está en la lista, se ignora; (4) la oración se escribe a partir de ese versículo, sin citarlo. Sin IA (o si falla) se elige por coincidencia de palabras con lo escrito. Así nunca se inventa una cita. Con ~10 versículos por tema el ajuste tiene un techo: ampliar la base mejora la relevancia.
- Riesgo = máximo entre los patrones fijos y la IA. La IA puede subirlo, nunca bajarlo.
- Riesgo alto: no se genera oración, **no se guarda el texto** y no gasta cupo.
- Si la IA falla, se entrega una oración de respaldo y **no se gasta el cupo** del usuario.
- Al dejar de ser Premium no se borra nada: el diario sigue guardado, solo se ve parcialmente.
- Las compras de Stripe son idempotentes: el webhook y la confirmación al volver no duplican velas ni créditos.
- Los límites mensuales se cuentan por mes natural (UTC).

## 5. Convertirla en app para móvil (iOS / Android)

1. **Ahora:** ya es una PWA (manifest, service worker e iconos). Se instala desde el navegador.
2. **Después:** envolver este mismo frontend con [Capacitor](https://capacitorjs.com) y publicarlo en las tiendas. El servidor ya acepta un token `Bearer` para clientes nativos (cabecera `X-Client: native` en el login).
3. **Pagos:** en iOS, las suscripciones y compras digitales dentro de la app deben usar la compra integrada de Apple (Guideline 3.1.1), con comisión del 15–30 %; Google Play tiene normas parecidas. Habría que añadir un servicio de compras integradas (p. ej. RevenueCat) que informe al servidor. Las reglas cambian a menudo: verifica la documentación oficial de Apple y Google.
4. Apple puede rechazar apps que son solo una web envuelta: añade funciones nativas (notificaciones, etc.). Ya existe el borrado de cuenta desde la app, que Apple exige.

## 6. Pruebas

```bash
npm test                              # API (node:test)
cd client && npx vitest run           # interfaz (jsdom, contra la API real en memoria)
```
