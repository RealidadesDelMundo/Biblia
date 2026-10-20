import { Router } from 'express';
import { wrap, httpError } from '../util.js';
import { requireAuth } from '../auth.js';
import { isPremium, publicUser, usage } from '../plans.js';

export function billingRoutes({ db, config, stripe, billing }) {
  const r = Router();

  // Webhook de Stripe: usa el cuerpo SIN procesar (ver app.js) y se autentica por firma.
  r.post('/webhook', wrap(async (req, res) => {
    if (!stripe || !config.stripe.webhookSecret) throw httpError(503, 'Webhook no configurado.');
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhookSecret);
    } catch (e) {
      return res.status(400).json({ error: `Firma no válida: ${e.message}` });
    }
    await billing.handleEvent(event);
    res.json({ received: true });
  }));

  r.use(requireAuth);
  const needStripe = () => { if (config.paymentsMode !== 'stripe') throw httpError(503, 'Los pagos no están disponibles todavía.', 'PAYMENTS_OFF'); };
  const me = async (userId) => { const u = await db('users').where({ id: userId }).first(); return { user: publicUser(u), usage: await usage(db, config, u) }; };

  r.post('/checkout', wrap(async (req, res) => {
    const interval = req.body?.interval === 'year' ? 'year' : 'month';
    if (isPremium(req.user) && req.user.plan_status !== 'canceled') throw httpError(409, 'Ya tienes Premium. Gestiona tu suscripción desde Cuenta.', 'ALREADY_PREMIUM');
    if (config.paymentsMode === 'off') throw httpError(503, 'Los pagos no están disponibles todavía.', 'PAYMENTS_OFF');
    if (config.paymentsMode === 'demo') {
      await db('users').where({ id: req.user.id }).update({ plan: 'premium', plan_status: 'active', plan_interval: interval, plan_expires_at: Date.now() + 30 * 86400000 });
      return res.json({ demo: true, ...(await me(req.user.id)) });
    }
    const out = await billing.checkoutSubscription(req.user, interval);
    res.json({ checkoutUrl: out.url });
  }));

  r.post('/credits', wrap(async (req, res) => {
    if (config.paymentsMode === 'off') throw httpError(503, 'Los pagos no están disponibles todavía.', 'PAYMENTS_OFF');
    if (config.paymentsMode === 'demo') {
      await db('users').where({ id: req.user.id }).increment('credits', config.prices.creditPack.credits);
      return res.json({ demo: true, ...(await me(req.user.id)) });
    }
    const out = await billing.checkoutCredits(req.user);
    res.json({ checkoutUrl: out.url });
  }));

  r.post('/portal', wrap(async (req, res) => { needStripe(); res.json(await billing.portal(req.user)); }));

  r.post('/confirm', wrap(async (req, res) => {
    needStripe();
    const id = String(req.body?.sessionId || '');
    if (!/^cs_/.test(id)) throw httpError(400, 'Sesión de pago no válida.');
    const result = await billing.confirm(req.user, id);
    res.json({ result, ...(await me(req.user.id)) });
  }));

  // Solo desarrollo (pagos simulados): alterna Premium para probar.
  r.post('/dev/premium', wrap(async (req, res) => {
    if (config.paymentsMode !== 'demo') throw httpError(404, 'No encontrado.');
    const on = req.body?.on !== false;
    await db('users').where({ id: req.user.id }).update(on
      ? { plan: 'premium', plan_status: 'active', plan_interval: 'month', plan_expires_at: Date.now() + 30 * 86400000 }
      : { plan: 'free', plan_status: null, plan_interval: null, plan_expires_at: null });
    res.json(await me(req.user.id));
  }));

  return r;
}
