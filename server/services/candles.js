import { isPremium } from '../plans.js';
import { selectVerse } from './verseSelect.js';

export const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Crea la vela. Con Premium se le asocia un versículo relacionado con la intención (elegido de la base curada). */
export async function createCandle({ db, config, ai }, user, { name, intention, size }) {
  const now = Date.now();
  const hours = config.candle.sizes[size].hours;
  let verse = null;
  if (isPremium(user, now)) {
    const a = await ai.assess(intention);
    verse = await selectVerse({ ai, text: intention, assessment: a });
  }
  const row = {
    user_id: user.id,
    name: clean(name, 40) || 'Anónimo',
    intention: clean(intention, 140),
    size,
    verse_ref: verse?.ref ?? null,
    verse_text: verse?.text ?? null,
    created_at: now,
    expires_at: now + hours * 3600000,
  };
  const [r] = await db('candles').insert(row).returning('id');
  return { id: typeof r === 'object' ? r.id : r, ...row };
}

export const publicCandle = (c, now = Date.now()) => ({
  id: c.id,
  name: c.name,
  intention: c.intention,
  size: c.size,
  verse: c.verse_ref ? { ref: c.verse_ref, text: c.verse_text } : null,
  createdAt: c.created_at,
  expiresAt: c.expires_at,
  remainingMs: Math.max(0, c.expires_at - now),
});
