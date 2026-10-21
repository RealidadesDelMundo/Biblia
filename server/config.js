// Configuración centralizada. Todo lo sensible viene de variables de entorno (nunca del código).
import crypto from 'node:crypto';

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'si'].includes(String(v).toLowerCase()));

export function loadConfig(overrides = {}) {
  const e = { ...env, ...overrides };
  const port = num(e.PORT, 3000);
  const appUrl = (e.APP_URL || `http://localhost:${port}`).replace(/\/$/, '');

  let jwtSecret = e.JWT_SECRET;
  if (!jwtSecret) {
    if (e.NODE_ENV === 'production') throw new Error('Falta JWT_SECRET (obligatorio en producción). Genera uno con: openssl rand -hex 32');
    jwtSecret = crypto.randomBytes(32).toString('hex'); // solo desarrollo: las sesiones se pierden al reiniciar
  }

  const stripeKey = e.STRIPE_SECRET_KEY || '';
  // Pagos: 'stripe' si hay clave; 'demo' (Premium y compras simuladas, SIN cobrar) solo si se pide expresamente con
  // PAYMENTS_MODE=demo y nunca en producción; en cualquier otro caso 'off'. Así un despliegue público no regala Premium.
  let paymentsMode = stripeKey ? 'stripe' : e.PAYMENTS_MODE === 'demo' ? 'demo' : 'off';
  if (paymentsMode === 'demo' && e.NODE_ENV === 'production') {
    console.warn('[config] PAYMENTS_MODE=demo se ignora en producción: los pagos quedan desactivados.');
    paymentsMode = 'off';
  }

  return {
    isProd: e.NODE_ENV === 'production',
    port,
    appUrl,
    secureCookies: appUrl.startsWith('https://'),
    jwtSecret,
    bcryptRounds: num(e.BCRYPT_ROUNDS, 12),
    databaseUrl: e.DATABASE_URL || '',
    sqlitePath: e.SQLITE_PATH || './data/oracion.sqlite',
    pgSsl: e.PGSSL, // 'true' | 'false' | undefined (auto)

    // Claves de notificaciones push (opcionales: si faltan se generan solas y se guardan en la base de datos)
    vapid: { publicKey: e.VAPID_PUBLIC_KEY || '', privateKey: e.VAPID_PRIVATE_KEY || '' },

    ai: {
      apiKey: e.ANTHROPIC_API_KEY || '',
      model: e.ANTHROPIC_MODEL || 'claude-sonnet-5-5', // oraciones y acompañante
      fastModel: e.ANTHROPIC_FAST_MODEL || 'claude-haiku-5-5', // clasificación de riesgo y tema
      mode: e.ANTHROPIC_API_KEY ? 'claude' : 'demo',
    },

    stripe: {
      secretKey: stripeKey,
      webhookSecret: e.STRIPE_WEBHOOK_SECRET || '',
      automaticTax: bool(e.STRIPE_AUTOMATIC_TAX, false),
    },
    paymentsMode, // 'stripe' | 'demo' (solo desarrollo, pagos simulados) | 'off'

    mail: {
      resendKey: e.RESEND_API_KEY || '',
      from: e.MAIL_FROM || 'Oración <no-reply@example.com>',
    },
    // Registro cerrado: si se define INVITE_CODE, solo se puede crear cuenta con ese código.
    inviteCode: (e.INVITE_CODE || '').trim(),
    // Administradores (correos separados por comas): ven el panel /admin.
    adminEmails: (e.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
    supportEmail: e.SUPPORT_EMAIL || 'soporte@example.com',
    legalDraftBanner: bool(e.LEGAL_DRAFT_BANNER, true),
    legalEntity: e.LEGAL_ENTITY || '[RAZÓN SOCIAL / TITULAR]',
    legalAddress: e.LEGAL_ADDRESS || '[DOMICILIO]',

    // Precios en céntimos de euro. Son propuestas: ajústalas aquí o por variable de entorno.
    currency: 'eur',
    prices: {
      monthly: num(e.PRICE_MONTHLY_CENTS, 599),
      yearly: num(e.PRICE_YEARLY_CENTS, 4900),
      candle: { mediana: num(e.PRICE_CANDLE_MEDIUM_CENTS, 249), grande: num(e.PRICE_CANDLE_LARGE_CENTS, 499) },
      creditPack: { credits: num(e.CREDIT_PACK_SIZE, 30), cents: num(e.PRICE_CREDIT_PACK_CENTS, 299) },
    },
    limits: {
      free: { prayers: num(e.FREE_PRAYERS_PER_MONTH, 3), smallCandles: num(e.FREE_CANDLES_PER_MONTH, 3), chat: num(e.FREE_CHAT_PER_MONTH, 3), diaryVisible: 3 },
      premium: { prayers: Infinity, smallCandles: num(e.PREMIUM_CANDLES_PER_MONTH, 10), chat: num(e.PREMIUM_CHAT_PER_MONTH, 40), diaryVisible: Infinity },
    },
    candle: {
      sizes: {
        pequena: { label: 'Pequeña', hours: 24 },
        mediana: { label: 'Mediana', hours: 24 * 7 },
        grande: { label: 'Grande', hours: 24 * 30 },
      },
      maxVisible: 12,
    },
    privacyVersion: '2026-10-20',
  };
}

