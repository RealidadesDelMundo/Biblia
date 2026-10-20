import { Router } from 'express';
import { wrap } from '../util.js';
import * as V from '../services/verses.js';
import { helplineForRequest, listCountries } from '../services/crisis.js';
import { isPremium } from '../plans.js';

export function metaRoutes({ db, config, ai }) {
  const r = Router();

  r.get('/health', (_req, res) => res.json({ ok: true }));

  r.get('/config', (_req, res) => {
    res.json({
      aiMode: ai.mode,
      paymentsMode: config.paymentsMode,
      translation: V.TRANSLATION,
      prices: { currency: config.currency, ...config.prices },
      limits: {
        free: { ...config.limits.free, prayers: config.limits.free.prayers },
        premium: { smallCandles: config.limits.premium.smallCandles, chat: config.limits.premium.chat },
      },
      candleSizes: Object.fromEntries(Object.entries(config.candle.sizes).map(([k, s]) => [k, { label: s.label, hours: s.hours, cents: config.prices.candle[k] ?? 0 }])),
      themes: Object.fromEntries(V.THEMES.map((t) => [t, V.LABELS[t]])),
      legalDraftBanner: config.legalDraftBanner,
      supportEmail: config.supportEmail,
      legal: { entity: config.legalEntity, address: config.legalAddress },
      privacyVersion: config.privacyVersion,
      countries: listCountries(),
    });
  });

  // Versículo del día. ?d=YYYY-MM-DD (día local del usuario; se acepta ±2 días respecto al servidor).
  r.get('/verse-of-the-day', wrap(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    let d = String(req.query.d || today);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Math.abs(V.dayIndexFromDateStr(d) - V.dayIndexFromDateStr(today)) > 2) d = today;
    let verse = V.verseOfTheDay(d);
    let personalized = false;
    let note = null;
    if (req.user && isPremium(req.user)) {
      const recent = await db('entries').where({ user_id: req.user.id }).orderBy('created_at', 'desc').limit(30).select('theme', 'verse_ref', 'created_at');
      const p = V.personalVerseOfTheDay({ userId: req.user.id, dateStr: d, recentEntries: recent });
      if (p) { verse = p; personalized = true; note = `Elegido porque esta semana has orado sobre ${V.LABELS[p.theme].toLowerCase()}.`; }
    }
    res.json({ date: d, verse: V.publicVerse(verse), personalized, note, translation: V.TRANSLATION });
  }));

  r.get('/helpline', (req, res) => res.json({ helpline: helplineForRequest(req, req.user), countries: listCountries() }));

  return r;
}
