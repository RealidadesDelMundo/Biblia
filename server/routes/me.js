import { Router } from 'express';
import { wrap, httpError } from '../util.js';
import { requireAuth, checkPassword, clearSessionCookie } from '../auth.js';
import { publicUser, usage } from '../plans.js';
import { countries } from '../services/crisis.js';
import { deleteUserData } from '../services/accounts.js';

export function meRoutes({ db, config, stripe }) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', wrap(async (req, res) => res.json({ user: publicUser(req.user, Date.now(), config.adminEmails), usage: await usage(db, config, req.user) })));

  r.patch('/', wrap(async (req, res) => {
    const patch = {};
    if ('countryOverride' in (req.body || {})) {
      const c = req.body.countryOverride;
      if (c !== null && c !== 'OTHER' && !countries[c]) throw httpError(400, 'País no válido.');
      patch.country_override = c;
    }
    if (Object.keys(patch).length) await db('users').where({ id: req.user.id }).update(patch);
    const user = await db('users').where({ id: req.user.id }).first();
    res.json({ user: publicUser(user, Date.now(), config.adminEmails) });
  }));

  // Derecho de acceso y portabilidad (RGPD art. 15 y 20)
  r.get('/export', wrap(async (req, res) => {
    const id = req.user.id;
    const [entries, candles, chat] = await Promise.all([
      db('entries').where({ user_id: id }).orderBy('created_at'),
      db('candles').where({ user_id: id }).orderBy('created_at'),
      db('chat_messages').where({ user_id: id }).orderBy('created_at'),
    ]);
    const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
    const out = {
      exportedAt: new Date().toISOString(),
      account: { email: req.user.email, createdAt: iso(req.user.created_at), consentAt: iso(req.user.consent_at), consentVersion: req.user.consent_version, plan: req.user.plan },
      prayers: entries.map((e) => ({ date: iso(e.created_at), whatYouWrote: e.original, prayer: e.prayer, verse: `${e.verse_ref}: ${e.verse_text}`, theme: e.theme })),
      candles: candles.map((c) => ({ date: iso(c.created_at), for: c.name, intention: c.intention, size: c.size, verse: c.verse_ref })),
      companionConversation: chat.map((m) => ({ date: iso(m.created_at), role: m.role, text: m.content })),
    };
    res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-oracion.json"');
    res.json(out);
  }));

  // Derecho de supresión (RGPD art. 17)
  r.delete('/', wrap(async (req, res) => {
    const ok = await checkPassword(String(req.body?.password || ''), req.user.password_hash);
    if (!ok) throw httpError(403, 'La contraseña no es correcta.', 'BAD_PASSWORD');
    if (stripe && req.user.stripe_subscription_id) {
      try { await stripe.subscriptions.cancel(req.user.stripe_subscription_id); } catch (e) { console.error('[delete] no se pudo cancelar la suscripción', e?.message); }
    }
    await deleteUserData(db, req.user.id);
    clearSessionCookie(config, res);
    res.json({ ok: true });
  }));

  return r;
}
