import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';
import { createAI } from './services/ai.js';

const config = loadConfig();
const db = await createDb(config);
const ai = createAI(config);
const app = createApp({ config, db, ai });

const warn = [];
if (config.isProd && ai.mode === 'demo') warn.push('Sin ANTHROPIC_API_KEY: la app responde con oraciones de respaldo, sin IA.');
if (config.isProd && config.paymentsMode === 'off') warn.push('Sin STRIPE_SECRET_KEY: los pagos están desactivados (velas medianas/grandes, Premium y créditos).');
if (config.paymentsMode === 'stripe' && !config.stripe.webhookSecret) warn.push('Falta STRIPE_WEBHOOK_SECRET: no se procesarán renovaciones ni cancelaciones.');
if (config.isProd && !config.mail.resendKey) warn.push('Sin RESEND_API_KEY: no se enviarán correos de recuperación de contraseña.');
if (config.isProd && !config.secureCookies) warn.push('APP_URL no es https: las cookies de sesión no se marcarán como seguras.');

const server = app.listen(config.port, () => {
  console.log(`Oración escuchando en ${config.appUrl}  (IA: ${ai.mode}, pagos: ${config.paymentsMode}, BD: ${config.databaseUrl ? 'PostgreSQL' : 'SQLite'})`);
  warn.forEach((w) => console.warn('[aviso]', w));
});

const shutdown = async () => { server.close(); await db.destroy(); process.exit(0); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
