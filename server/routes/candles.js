import { Router } from 'express';
import { wrap, httpError } from '../util.js';
import { requireAuth } from '../auth.js';
import { createCandle, publicCandle, clean } from '../services/candles.js';
import { assessRiskPatterns, helplineForRequest } from '../services/crisis.js';
import { usage } from '../plans.js';

export function candleRoutes({ db, config, ai, billing }) {
  const r = Router();
  r.use(requireAuth);

  r.get('/', wrap(async (req, res) => {
    const now = Date.now();
    const active = await db('candles').where({ user_id: req.user.id }).whereNull('extinguished_at').where('expires_at', '>', now).orderBy('created_at', 'desc');
    const shown = active.slice(0, config.candle.maxVisible);
    res.json({ candles: shown.map((c) => publicCandle(c, now)), hiddenCount: active.length - shown.length, usage: await usage(db, config, req.user) });
  }));

  r.post('/', wrap(async (req, res) => {
    const size = String(req.body?.size || 'pequena');
    if (!config.candle.sizes[size]) throw httpError(400, 'Tamaño de vela no válido.');
    const intention = clean(req.body?.intention, 140);
    const name = clean(req.body?.name, 40);
    if (intention.length < 2) throw httpError(400, 'Escribe por quién o por qué enciendes la vela.', 'TOO_SHORT');

    const floor = assessRiskPatterns(`${name} ${intention}`);
    const helpline = floor.risk !== 'none' ? helplineForRequest(req, req.user) : undefined;

    if (size === 'pequena') {
      const u = await usage(db, config, req.user);
      if (u.smallCandles.used >= u.smallCandles.limit) return res.status(402).json({ error: 'Has usado tus velas pequeñas de este mes. Puedes encender una mediana o grande.', code: 'LIMIT_CANDLES', usage: u });
      const c = await createCandle({ db, config, ai }, req.user, { name, intention, size });
      return res.status(201).json({ candle: publicCandle(c), usage: await usage(db, config, req.user), risk: floor.risk, helpline });
    }

    // Velas medianas y grandes: de pago
    if (config.paymentsMode === 'off') throw httpError(503, 'Los pagos no están disponibles todavía.', 'PAYMENTS_OFF');
    if (config.paymentsMode === 'demo') {
      const c = await createCandle({ db, config, ai }, req.user, { name, intention, size });
      return res.status(201).json({ candle: publicCandle(c), demo: true, usage: await usage(db, config, req.user), risk: floor.risk, helpline });
    }
    const out = await billing.checkoutCandle(req.user, { name, intention, size });
    res.json({ checkoutUrl: out.url });
  }));

  // Apagar una vela: solo la propia y solo si sigue encendida. No se devuelve el cupo ni el pago (la vela ya se encendió).
  r.delete('/:id', wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw httpError(404, 'No encontramos esa vela.');
    const done = await db('candles').where({ id, user_id: req.user.id }).whereNull('extinguished_at').update({ extinguished_at: Date.now() });
    if (!done) throw httpError(404, 'No encontramos esa vela.');
    res.json({ ok: true, usage: await usage(db, config, req.user) });
  }));

  return r;
}
