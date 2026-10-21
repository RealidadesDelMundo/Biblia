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
    const last = await db('chat_messages').where({ user_id: user.id, role: 'assistant' }).orderBy('id', 'desc').first();
    const a = await ai.assess(message, { context: last?.content });
    const risk = maxRisk(floor.risk, a.risk);
    const hl = helplineForRequest(req, user);
    if (risk === 'high') {
      // No se envía a la IA, no se guarda y no se descuenta.
      const kind = floor.kind || 'self';
      return res.json({ risk: 'high', kind, messages: highRiskText(kind, hl), helpline: hl, usage: u.chat });
    }

    // Fuera del ámbito del acompañante (recetas, código, deberes…): respuesta fija y amable, sin llamar al modelo grande,
    // sin guardar el mensaje y sin gastar cupo. Solo se anota la fecha (nunca el contenido) para que el administrador vea cuántas veces ocurre.
    if (risk === 'none' && a.scope === 'out') {
      await db('scope_flags').insert({ user_id: user.id, created_at: Date.now() });
      const redirects = [
        'Para eso no soy la ayuda adecuada: este espacio es para acompañarte en lo que sientes, en tu fe y en tu oración. Si hay algo que llevas en el corazón, cuéntamelo y lo vemos juntos.',
        'Me gustaría ayudarte, pero aquí solo puedo acompañarte en lo personal y lo espiritual: cómo te sientes, qué te preocupa o qué quieres llevar a oración. ¿Cómo estás hoy, de verdad?',
        'Eso se sale de lo que puedo hacer aquí. Este es tu lugar para hablar de lo que vives y para orar. Si quieres, cuéntame cómo va tu día o qué tienes en la mente y lo acompañamos con una oración.',
      ];
      return res.json({ reply: redirects[Math.floor(Math.random() * redirects.length)], risk: 'none', offTopic: true, usage: u.chat });
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
