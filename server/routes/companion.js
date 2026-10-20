import { Router } from 'express';
import { wrap, httpError } from '../util.js';
import { requireAuth } from '../auth.js';
import { clean } from '../services/candles.js';
import { assessRiskPatterns, maxRisk, helplineForRequest, highRiskText } from '../services/crisis.js';
import { usage } from '../plans.js';

const publicMsg = (m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.created_at });

export function companionRoutes({ db, config, ai, aiLimiter }) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', wrap(async (req, res) => {
    const rows = await db('chat_messages').where({ user_id: req.user.id }).orderBy('id', 'desc').limit(60);
    res.json({ messages: rows.reverse().map(publicMsg), usage: (await usage(db, config, req.user)).chat, aiMode: ai.mode });
  }));

  r.post('/', aiLimiter, wrap(async (req, res) => {
    const message = String(req.body?.message ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 1500);
    if (!message) throw httpError(400, 'Escribe un mensaje.');
    const user = req.user;
    const u = await usage(db, config, user);
    if (u.chat.available <= 0) return res.status(402).json({ error: 'Has agotado tus mensajes con el acompañante este mes.', code: 'LIMIT_CHAT', usage: u.chat });

    const floor = assessRiskPatterns(message);
    const a = await ai.assess(message);
    const risk = maxRisk(floor.risk, a.risk);
    const hl = helplineForRequest(req, user);
    if (risk === 'high') {
      // No se envía a la IA, no se guarda y no se descuenta.
      const kind = floor.kind || 'self';
      return res.json({ risk: 'high', kind, messages: highRiskText(kind, hl), helpline: hl, usage: u.chat });
    }

    const prev = await db('chat_messages').where({ user_id: user.id }).orderBy('id', 'desc').limit(20);
    const history = prev.reverse().map((m) => ({ role: m.role, content: m.content }));
    while (history.length && history[0].role !== 'user') history.shift();
    history.push({ role: 'user', content: message });

    const riskNote = risk === 'moderate' ? 'La persona parece estar pasando un momento muy duro. Sé especialmente cuidadoso y, con naturalidad, menciona que hablar con alguien de confianza o con un profesional puede ayudar.' : '';
    const reply = await ai.companionReply({ history, riskNote });
    if (reply.error) throw httpError(503, 'El acompañante no está disponible ahora mismo. No se ha descontado ningún mensaje; inténtalo de nuevo en un momento.', 'AI_UNAVAILABLE');

    const now = Date.now();
    await db.transaction(async (trx) => {
      await trx('chat_messages').insert([
        { user_id: user.id, role: 'user', content: message, created_at: now },
        { user_id: user.id, role: 'assistant', content: reply.text, created_at: now + 1 },
      ]);
      if (u.chat.remainingAllowance <= 0) await trx('users').where({ id: user.id }).where('credits', '>', 0).decrement('credits', 1);
    });
    const after = await usage(db, config, await db('users').where({ id: user.id }).first());
    res.status(201).json({ reply: reply.text, risk: risk === 'moderate' ? 'moderate' : 'none', helpline: risk === 'moderate' ? hl : undefined, usage: after.chat });
  }));

  r.delete('/', wrap(async (req, res) => {
    await db('chat_messages').where({ user_id: req.user.id }).del();
    res.json({ ok: true });
  }));

  return r;
}
