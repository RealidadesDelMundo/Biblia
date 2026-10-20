import { Router } from 'express';
import crypto from 'node:crypto';
import { wrap, httpError } from '../util.js';
import { hashPassword, checkPassword, signSession, setSessionCookie, clearSessionCookie, sha256, randomToken, validatePassword, EMAIL_RE, requireAuth } from '../auth.js';
import { publicUser, usage } from '../plans.js';


export function authRoutes({ db, config, mailer }) {
  const r = Router();
  const wantsToken = (req) => req.headers['x-client'] === 'native';
  let dummyHash; // para igualar tiempos de respuesta si el correo no existe
  const getDummy = async () => (dummyHash ??= await hashPassword(config, 'contraseña-ficticia'));

  async function session(req, res, user) {
    const token = signSession(config, user);
    setSessionCookie(config, res, token);
    const body = { user: publicUser(user, Date.now(), config.adminEmails), usage: await usage(db, config, user) };
    if (wantsToken(req)) body.token = token;
    return body;
  }

  r.post('/register', wrap(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!EMAIL_RE.test(email)) throw httpError(400, 'Escribe un correo válido.', 'BAD_EMAIL');
    const pwErr = validatePassword(password, email);
    if (pwErr) throw httpError(400, pwErr, 'BAD_PASSWORD');
    if (config.inviteCode) {
      const a = Buffer.from(String(req.body?.inviteCode || '').trim().toLowerCase());
      const b = Buffer.from(config.inviteCode.toLowerCase());
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw httpError(403, 'Necesitas un código de invitación válido para crear una cuenta.', 'INVITE_REQUIRED');
    }
    if (req.body?.consent !== true) throw httpError(400, 'Necesitamos tu consentimiento expreso para tratar tus oraciones y confirmar que eres mayor de edad.', 'CONSENT_REQUIRED');
    if (await db('users').where({ email }).first()) throw httpError(409, 'Ya existe una cuenta con ese correo. Prueba a iniciar sesión.', 'EMAIL_TAKEN');
    const now = Date.now();
    const [row] = await db('users').insert({
      email, password_hash: await hashPassword(config, password), created_at: now, consent_at: now, consent_version: config.privacyVersion, last_login_at: now,
    }).returning('id');
    const user = await db('users').where({ id: typeof row === 'object' ? row.id : row }).first();
    res.status(201).json(await session(req, res, user));
  }));

  r.post('/login', wrap(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = email ? await db('users').where({ email }).first() : null;
    const ok = await checkPassword(password, user ? user.password_hash : await getDummy());
    if (!user || !ok) throw httpError(401, 'Correo o contraseña incorrectos.', 'BAD_CREDENTIALS');
    await db('users').where({ id: user.id }).update({ last_login_at: Date.now() });
    res.json(await session(req, res, user));
  }));

  r.post('/logout', (_req, res) => { clearSessionCookie(config, res); res.json({ ok: true }); });

  r.post('/forgot', wrap(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const user = email ? await db('users').where({ email }).first() : null;
    if (user) {
      const token = randomToken();
      await db('password_resets').insert({ user_id: user.id, token_hash: sha256(token), expires_at: Date.now() + 3600000 });
      await mailer.send({
        to: user.email,
        subject: 'Restablece tu contraseña',
        text: `Hola,\n\nPara elegir una contraseña nueva abre este enlace (caduca en 1 hora):\n${config.appUrl}/restablecer?token=${token}\n\nSi no lo has pedido tú, ignora este mensaje.`,
      });
    }
    res.json({ ok: true }); // misma respuesta exista o no la cuenta
  }));

  r.post('/reset', wrap(async (req, res) => {
    const token = String(req.body?.token || '');
    const row = token ? await db('password_resets').where({ token_hash: sha256(token) }).first() : null;
    if (!row || row.used_at || row.expires_at < Date.now()) throw httpError(400, 'El enlace no es válido o ha caducado. Pide uno nuevo.', 'BAD_TOKEN');
    const user = await db('users').where({ id: row.user_id }).first();
    const pwErr = validatePassword(req.body?.password, user.email);
    if (pwErr) throw httpError(400, pwErr, 'BAD_PASSWORD');
    await db('users').where({ id: user.id }).update({ password_hash: await hashPassword(config, req.body.password), token_version: user.token_version + 1 });
    await db('password_resets').where({ id: row.id }).update({ used_at: Date.now() });
    clearSessionCookie(config, res);
    res.json({ ok: true });
  }));

  r.get('/session', requireAuth, wrap(async (req, res) => res.json({ user: publicUser(req.user, Date.now(), config.adminEmails), usage: await usage(db, config, req.user) })));

  return r;
}
