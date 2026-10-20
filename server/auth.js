import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export const COOKIE = 'oracion_session';
const DAYS = 30;

export const hashPassword = (config, pw) => bcrypt.hash(pw, config.bcryptRounds);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('base64url');

export function signSession(config, user) {
  return jwt.sign({ sub: user.id, tv: user.token_version }, config.jwtSecret, { expiresIn: `${DAYS}d` });
}

export function setSessionCookie(config, res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: DAYS * 86400000,
    path: '/',
  });
}
export const clearSessionCookie = (config, res) =>
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.secureCookies, path: '/' });

function readToken(req) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7); // clientes nativos (Capacitor): guardan el token en almacenamiento seguro
  return req.cookies?.[COOKIE];
}

/** Carga el usuario si hay sesión válida (sin exigirla). */
export function loadUser({ db, config }) {
  return async (req, _res, next) => {
    req.user = null;
    const token = readToken(req);
    if (!token) return next();
    try {
      const p = jwt.verify(token, config.jwtSecret);
      const user = await db('users').where({ id: p.sub }).first();
      if (user && user.token_version === p.tv) req.user = user;
    } catch { /* token inválido o caducado */ }
    next();
  };
}

export const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No has iniciado sesión.', code: 'AUTH_REQUIRED' });
  next();
};

/** Protección CSRF adicional: en peticiones que modifican datos, si hay cabecera Origin debe ser la de la app. */
export function originCheck(config) {
  const allowed = new Set([new URL(config.appUrl).origin, 'capacitor://localhost', 'https://localhost', 'http://localhost']);
  if (!config.isProd) { allowed.add('http://localhost:5173'); allowed.add('http://127.0.0.1:5173'); allowed.add(`http://localhost:${config.port}`); }
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.path === '/api/billing/webhook') return next(); // lo llama Stripe: se autentica por firma
    const origin = req.headers.origin;
    if (origin && !allowed.has(origin)) return res.status(403).json({ error: 'Origen no permitido.', code: 'BAD_ORIGIN' });
    next();
  };
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export function validatePassword(pw, email) {
  if (typeof pw !== 'string') return 'La contraseña no es válida.';
  if (pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (Buffer.byteLength(pw, 'utf8') > 72) return 'La contraseña es demasiado larga (máximo 72 caracteres).';
  if (email && pw.toLowerCase() === email.toLowerCase()) return 'La contraseña no puede ser tu correo.';
  if (/^(12345678|password|contraseña|qwertyui|11111111)/i.test(pw)) return 'Elige una contraseña menos común.';
  return null;
}
