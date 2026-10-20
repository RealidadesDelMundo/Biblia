import { Router } from 'express';
import { wrap, httpError } from '../util.js';
import { requireAuth } from '../auth.js';
import { clean } from '../services/candles.js';
import { assessRiskPatterns, maxRisk, helplineForRequest, highRiskText } from '../services/crisis.js';
import { usage, isPremium } from '../plans.js';
import * as V from '../services/verses.js';
import { selectVerse } from '../services/verseSelect.js';

const publicEntry = (e) => ({
  id: e.id,
  original: e.original,
  prayer: e.prayer,
  theme: e.theme,
  themeLabel: V.LABELS[e.theme] || e.theme,
  verse: { ref: e.verse_ref, text: e.verse_text, gist: V.getVerse(e.verse_ref)?.gist ?? null },
  moderateRisk: !!e.moderate_risk,
  createdAt: e.created_at,
});

export function prayerRoutes({ db, config, ai, aiLimiter }) {
  const r = Router();
  // requireAuth va por ruta (no con r.use): este router está montado en /api y no debe exigir sesión a rutas ajenas (p. ej. el webhook).

  r.post('/prayers', requireAuth, aiLimiter, wrap(async (req, res) => {
    const intention = clean(req.body?.intention, 1000);
    if (intention.length < 3) throw httpError(400, 'Cuéntanos un poco más sobre lo que quieres llevar a oración.', 'TOO_SHORT');
    const user = req.user;
    const u = await usage(db, config, user);
    if (u.prayers.limit !== null && u.prayers.used >= u.prayers.limit) {
      return res.status(402).json({ error: 'Has usado tus oraciones gratuitas de este mes.', code: 'LIMIT_PRAYERS', usage: u });
    }

    const floor = assessRiskPatterns(intention);
    const a = await ai.assess(intention);
    const risk = maxRisk(floor.risk, a.risk);
    const hl = helplineForRequest(req, user);

    if (risk === 'high') {
      // No se guarda el texto ni se descuenta del límite.
      const kind = floor.kind || 'self';
      return res.json({ risk: 'high', kind, messages: highRiskText(kind, hl), helpline: hl });
    }

    const recent = await db('entries').where({ user_id: user.id }).orderBy('created_at', 'desc').limit(14).select('theme', 'verse_ref');
    const recentThemes = isPremium(user) ? [...new Set(recent.slice(0, 5).map((e) => V.LABELS[e.theme] || e.theme))] : [];
    // Primero el versículo (el que mejor encaja con lo escrito) y después la oración, que parte de él
    const verse = await selectVerse({ ai, text: intention, assessment: a, avoidRefs: recent.map((e) => e.verse_ref) });
    const prayer = await ai.writePrayer({ intention, theme: a.theme, risk, recentThemes, verse });

    const row = {
      user_id: user.id, original: intention, prayer: prayer.text, theme: verse.theme, verse_ref: verse.ref, verse_text: verse.text,
      moderate_risk: risk === 'moderate',
      counted: ai.mode === 'demo' ? true : prayer.ok, // si la IA falló, no gasta tu cupo
      created_at: Date.now(),
    };
    const [r0] = await db('entries').insert(row).returning('id');
    const entry = { id: typeof r0 === 'object' ? r0.id : r0, ...row };
    res.status(201).json({
      risk: risk === 'moderate' ? 'moderate' : 'none',
      entry: publicEntry(entry),
      helpline: risk === 'moderate' ? hl : undefined,
      aiFallback: ai.mode === 'claude' && !prayer.ok,
      usage: await usage(db, config, user),
    });
  }));

  r.get('/entries', requireAuth, wrap(async (req, res) => {
    const premium = isPremium(req.user);
    const total = Number((await db('entries').where({ user_id: req.user.id }).count({ n: '*' }).first()).n);
    const limit = premium ? Math.min(Number(req.query.limit) || 50, 100) : config.limits.free.diaryVisible;
    const q = db('entries').where({ user_id: req.user.id }).orderBy('id', 'desc').limit(limit);
    if (premium && req.query.before) q.where('id', '<', Number(req.query.before));
    const rows = await q;
    res.json({ entries: rows.map(publicEntry), total, hiddenCount: premium ? 0 : Math.max(0, total - rows.length), premium });
  }));

  r.delete('/entries/:id', requireAuth, wrap(async (req, res) => {
    const n = await db('entries').where({ id: Number(req.params.id), user_id: req.user.id }).del();
    if (!n) throw httpError(404, 'No encontramos esa oración.');
    res.json({ ok: true });
  }));

  return r;
}
