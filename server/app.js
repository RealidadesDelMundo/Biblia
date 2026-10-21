import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUser, originCheck } from './auth.js';
import { createAI } from './services/ai.js';
import { createBilling } from './services/stripe.js';
import { createMailer } from './services/mail.js';
import { metaRoutes } from './routes/meta.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { prayerRoutes } from './routes/prayers.js';
import { candleRoutes } from './routes/candles.js';
import { companionRoutes } from './routes/companion.js';
import { billingRoutes } from './routes/billing.js';
import { adminRoutes } from './routes/admin.js';
import { reminderRoutes } from './routes/reminders.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ config, db, ai, stripe, mailer, billing, push = null, clientDir } = {}) {
  ai ??= createAI(config);
  stripe ??= config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
  mailer ??= createMailer(config);
  billing ??= stripe ? createBilling({ db, config, stripe, ai }) : null;

  const app = express();
  app.set('trust proxy', 1); // Railway y otros PaaS ponen un proxy delante
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'], connectSrc: ["'self'"], manifestSrc: ["'self'"], workerSrc: ["'self'"],
        objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"], formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: config.secureCookies,
  }));
  app.use(compression());
  app.use(cookieParser());

  const off = process.env.RATE_LIMIT_DISABLED === '1';
  const common = { standardHeaders: true, legacyHeaders: false, skip: () => off, message: { error: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.', code: 'RATE_LIMITED' } };
  const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 600 });
  const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 30 });
  const aiLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: 40, keyGenerator: (req) => `u${req.user?.id ?? req.ip}`, validate: { keyGeneratorIpFallback: false } });

  // El webhook necesita el cuerpo sin procesar para verificar la firma de Stripe
  app.use('/api/billing/webhook', express.raw({ type: '*/*', limit: '1mb' }));
  app.use(express.json({ limit: '50kb' }));
  app.use('/api', originCheck(config), apiLimiter, loadUser({ db, config }));

  app.use('/api', metaRoutes({ db, config, ai, push }));
  app.use('/api/auth', authLimiter, authRoutes({ db, config, mailer }));
  app.use('/api/me', meRoutes({ db, config, stripe }));
  app.use('/api', prayerRoutes({ db, config, ai, aiLimiter }));
  app.use('/api/candles', candleRoutes({ db, config, ai, billing }));
  app.use('/api/companion', companionRoutes({ db, config, ai, aiLimiter }));
  app.use('/api/billing', billingRoutes({ db, config, stripe, billing }));
  app.use('/api/admin', adminRoutes({ db, config, stripe }));
  app.use('/api/reminders', reminderRoutes({ db, push }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'No encontrado.' }));

  // Frontend (React compilado)
  const dist = clientDir ?? path.join(here, '..', 'client', 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, {
      index: false,
      setHeaders(res, file) {
        if (/[\\/]assets[\\/]/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache');
      },
    }));
    app.get(/^\/(?!api\/).*/, (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
  } else {
    app.get('/', (_req, res) => res.type('text').send('API en marcha. El frontend no está compilado: ejecuta "npm run build".'));
  }

  // Errores
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Petición no válida.' });
    const status = err.status && err.status < 600 ? err.status : 500;
    if (status >= 500) console.error('[error]', err);
    res.status(status).json({ error: status >= 500 && config.isProd && !err.expose ? 'Ha ocurrido un error. Inténtalo de nuevo.' : err.message, code: err.code });
  });

  return app;
}
