import { Router } from 'express';
import { wrap, httpError } from '../util.js';
import { requireAuth } from '../auth.js';
import { deleteUserData } from '../services/accounts.js';
import { monthStart } from '../plans.js';

// Panel de administración (solo para los correos de ADMIN_EMAILS). Muestra CUÁNTO usa cada persona, nunca QUÉ escribe.
export function adminRoutes({ db, config, stripe }) {
  const r = Router();
  r.use(requireAuth, (req, res, next) => (config.adminEmails.includes(req.user.email) ? next() : res.status(403).json({ error: 'No autorizado.', code: 'FORBIDDEN' })));

  const counts = async (table, { since, where } = {}) => {
    let q = db(table).select('user_id').count({ n: '*' }).groupBy('user_id');
    if (where) q = q.where(where);
    if (since) q = q.where('created_at', '>=', since);
    return Object.fromEntries((await q).map((x) => [x.user_id, Number(x.n)]));
  };

  r.get('/users', wrap(async (_req, res) => {
    const users = await db('users').select('id', 'email', 'created_at', 'last_login_at', 'plan', 'plan_expires_at').orderBy('created_at', 'desc').limit(1000);
    const [prayers, candles, messages] = await Promise.all([counts('entries'), counts('candles'), counts('chat_messages')]);
    const from = monthStart();
    const [offAll, offMonth] = await Promise.all([counts('scope_flags'), counts('scope_flags', { since: from })]);
    const [mPrayers, mCandles, mMessages] = await Promise.all([counts('entries', { since: from, where: { counted: true } }), counts('candles', { since: from, where: { size: 'pequena' } }), counts('chat_messages', { since: from, where: { role: 'user' } })]);
    res.json({
      total: users.length,
      users: users.map((u) => ({
        id: u.id, email: u.email, createdAt: u.created_at, lastLoginAt: u.last_login_at,
        plan: u.plan === 'premium' && (!u.plan_expires_at || u.plan_expires_at > Date.now()) ? 'premium' : 'free',
        isAdmin: config.adminEmails.includes(u.email),
        prayers: prayers[u.id] || 0, candles: candles[u.id] || 0, messages: messages[u.id] || 0,
        offTopic: offAll[u.id] || 0, monthOffTopic: offMonth[u.id] || 0,
        monthPrayers: mPrayers[u.id] || 0, monthCandles: mCandles[u.id] || 0, monthMessages: mMessages[u.id] || 0,
      })),
    });
  }));

  // Qué ha hecho una persona: fecha y TIPO de cada acción. Nunca el contenido ni el tema de lo que escribe.
  r.get('/users/:id/activity', wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!(await db('users').where({ id }).first())) throw httpError(404, 'No encontramos a esa persona.');
    const q = (t, cols, where = {}) => db(t).where({ user_id: id, ...where }).select(cols).orderBy('created_at', 'desc').limit(150);
    const [entries, candles, msgs, flags] = await Promise.all([q('entries', ['created_at']), q('candles', ['created_at', 'size']), q('chat_messages', ['created_at'], { role: 'user' }), q('scope_flags', ['created_at'])]);
    const events = [
      ...entries.map((e) => ({ at: e.created_at, type: 'oracion' })),
      ...candles.map((c) => ({ at: c.created_at, type: 'vela', size: c.size })),
      ...msgs.map((m) => ({ at: m.created_at, type: 'mensaje' })),
      ...flags.map((f) => ({ at: f.created_at, type: 'fuera_de_tema' })),
    ];
    res.json({ events: events.sort((a, b) => b.at - a.at).slice(0, 150) });
  }));

  r.delete('/users/:id', wrap(async (req, res) => {
    const id = Number(req.params.id);
    const target = await db('users').where({ id }).first();
    if (!target) throw httpError(404, 'No encontramos a esa persona.');
    if (config.adminEmails.includes(target.email)) throw httpError(400, 'No se puede borrar una cuenta de administrador desde aquí.');
    if (stripe && target.stripe_subscription_id) { try { await stripe.subscriptions.cancel(target.stripe_subscription_id); } catch (e) { console.error('[admin] no se pudo cancelar la suscripción', e?.message); } }
    await deleteUserData(db, id);
    res.json({ ok: true });
  }));

  return r;
}
