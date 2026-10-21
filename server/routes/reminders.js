import { Router } from 'express';
import { wrap, httpError } from '../util.js';
import { requireAuth } from '../auth.js';
import { sendToUser, validTz } from '../services/reminders.js';

const MAX_TIMES = 12;
const MAX_DEVICES = 5;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function reminderRoutes({ db, push }) {
  const r = Router();
  r.use(requireAuth);
  const lastTest = new Map(); // userId -> ms (evita pulsar "prueba" sin parar)

  const view = async (userId) => {
    const row = await db('reminder_settings').where({ user_id: userId }).first();
    const devices = Number((await db('push_subscriptions').where({ user_id: userId }).count({ n: '*' }).first()).n);
    let times = []; try { times = JSON.parse(row?.times || '[]'); } catch { /* vacío */ }
    return { enabled: !!row?.enabled, times, tz: row?.tz || null, devices };
  };

  r.get('/', wrap(async (req, res) => res.json({ ...(await view(req.user.id)), available: !!push })));

  r.post('/subscribe', wrap(async (req, res) => {
    if (!push) throw httpError(503, 'Los recordatorios no están disponibles ahora mismo.', 'PUSH_OFF');
    const s = req.body?.subscription;
    const ok = s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.endpoint.length <= 1000
      && typeof s.keys?.p256dh === 'string' && s.keys.p256dh.length >= 10 && s.keys.p256dh.length <= 200
      && typeof s.keys?.auth === 'string' && s.keys.auth.length >= 8 && s.keys.auth.length <= 100;
    if (!ok) throw httpError(400, 'No hemos podido registrar este dispositivo.', 'BAD_SUBSCRIPTION');
    const now = Date.now();
    const existing = await db('push_subscriptions').where({ endpoint: s.endpoint }).first();
    if (existing) await db('push_subscriptions').where({ id: existing.id }).update({ user_id: req.user.id, p256dh: s.keys.p256dh, auth: s.keys.auth });
    else {
      const mine = await db('push_subscriptions').where({ user_id: req.user.id }).orderBy('id');
      if (mine.length >= MAX_DEVICES) await db('push_subscriptions').where({ id: mine[0].id }).del(); // se descarta el más antiguo
      await db('push_subscriptions').insert({ user_id: req.user.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, created_at: now });
    }
    res.status(201).json(await view(req.user.id));
  }));

  r.post('/unsubscribe', wrap(async (req, res) => {
    const endpoint = String(req.body?.endpoint || '');
    await db('push_subscriptions').where({ user_id: req.user.id, endpoint }).del();
    const v = await view(req.user.id);
    if (!v.devices && v.enabled) await db('reminder_settings').where({ user_id: req.user.id }).update({ enabled: false });
    res.json(await view(req.user.id));
  }));

  r.put('/', wrap(async (req, res) => {
    const { enabled, times, tz } = req.body || {};
    if (typeof enabled !== 'boolean') throw httpError(400, 'Indica si quieres activar o desactivar los recordatorios.');
    if (!Array.isArray(times) || times.length > MAX_TIMES || !times.every((t) => typeof t === 'string' && TIME_RE.test(t))) throw httpError(400, `Elige hasta ${MAX_TIMES} horas válidas (HH:MM).`, 'BAD_TIMES');
    if (!validTz(tz)) throw httpError(400, 'Zona horaria no válida.', 'BAD_TZ');
    const clean = [...new Set(times)].sort();
    if (enabled && !clean.length) throw httpError(400, 'Elige al menos una hora.', 'NO_TIMES');
    const v = await view(req.user.id);
    if (enabled && !v.devices) throw httpError(400, 'Primero permite las notificaciones en este dispositivo.', 'NO_DEVICE');
    const row = { enabled, times: JSON.stringify(clean), tz, updated_at: Date.now() };
    const has = await db('reminder_settings').where({ user_id: req.user.id }).first();
    if (has) await db('reminder_settings').where({ user_id: req.user.id }).update(row);
    else await db('reminder_settings').insert({ user_id: req.user.id, ...row });
    res.json(await view(req.user.id));
  }));

  r.post('/test', wrap(async (req, res) => {
    if (!push) throw httpError(503, 'Los recordatorios no están disponibles ahora mismo.', 'PUSH_OFF');
    const last = lastTest.get(req.user.id) || 0;
    if (Date.now() - last < 15000) throw httpError(429, 'Espera unos segundos antes de enviar otra prueba.', 'TOO_SOON');
    lastTest.set(req.user.id, Date.now());
    const out = await sendToUser({ db, push, userId: req.user.id, payload: { title: 'Un momento para orar', body: 'Así te avisaremos. Los recordatorios funcionan.', url: '/' } });
    res.json(out);
  }));

  return r;
}
