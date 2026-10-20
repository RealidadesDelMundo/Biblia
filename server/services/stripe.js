// Facturación con Stripe Checkout (página de pago alojada por Stripe: la app nunca ve datos de tarjeta).
// El cliente de Stripe se inyecta para poder probar la lógica sin red.
import { createCandle } from './candles.js';

const GRACE_MS = 3 * 86400000; // margen por si un webhook de renovación llega tarde
const ACTIVE = new Set(['active', 'trialing', 'past_due']);
const periodEndMs = (sub) => {
  const s = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end; // versiones nuevas de la API lo mueven a los ítems
  return s ? s * 1000 : null;
};

export function createBilling({ db, config, stripe, ai, now = () => Date.now() }) {
  const ctx = { db, config, ai };
  const { appUrl } = config;

  const withdrawal = 'Al pagar aceptas que el servicio se presta de inmediato y reconoces que pierdes el derecho de desistimiento de 14 días una vez comenzada la prestación (contenido digital).';
  const common = (user) => ({
    client_reference_id: String(user.id),
    ...(user.stripe_customer_id ? { customer: user.stripe_customer_id } : { customer_email: user.email }),
    locale: 'es',
    custom_text: { submit: { message: withdrawal } },
    ...(config.stripe.automaticTax ? { automatic_tax: { enabled: true }, billing_address_collection: 'required' } : {}),
  });
  const product = (name, description) => ({ name, description, ...(config.stripe.automaticTax ? { tax_code: 'txcd_10000000' } : {}) });
  const urls = (extra = '') => ({
    success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}${extra}`,
    cancel_url: `${appUrl}/?checkout=cancel`,
  });

  async function checkoutSubscription(user, interval) {
    const yearly = interval === 'year';
    const s = await stripe.checkout.sessions.create({
      ...common(user),
      mode: 'subscription',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: config.currency,
          unit_amount: yearly ? config.prices.yearly : config.prices.monthly,
          recurring: { interval: yearly ? 'year' : 'month' },
          product_data: product('Oración Premium', 'Oraciones ilimitadas, diario completo, versículo del día personalizado y más.'),
        },
      }],
      allow_promotion_codes: true,
      metadata: { kind: 'subscription', user_id: String(user.id) },
      subscription_data: { metadata: { user_id: String(user.id) } },
      ...urls(),
    });
    return { url: s.url, id: s.id };
  }

  async function checkoutOrder(user, kind, payload, amountCents, name, description) {
    const [r] = await db('orders').insert({ user_id: user.id, kind, payload: JSON.stringify(payload), status: 'pending', created_at: now() }).returning('id');
    const orderId = typeof r === 'object' ? r.id : r;
    const s = await stripe.checkout.sessions.create({
      ...common(user),
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: config.currency, unit_amount: amountCents, product_data: product(name, description) } }],
      metadata: { kind, order_id: String(orderId), user_id: String(user.id) },
      payment_intent_data: { metadata: { kind, order_id: String(orderId), user_id: String(user.id) } },
      ...urls(`&kind=${kind}`),
    });
    await db('orders').where({ id: orderId }).update({ stripe_session_id: s.id });
    return { url: s.url, id: s.id, orderId };
  }

  const checkoutCandle = (user, { name, intention, size }) =>
    checkoutOrder(user, 'candle', { name, intention, size }, config.prices.candle[size], `Vela ${config.candle.sizes[size].label.toLowerCase()}`, `Arde ${config.candle.sizes[size].hours >= 24 * 7 ? Math.round(config.candle.sizes[size].hours / 24) + ' días' : '24 horas'} en tu capilla.`);

  const checkoutCredits = (user) =>
    checkoutOrder(user, 'credits', { credits: config.prices.creditPack.credits }, config.prices.creditPack.cents, `${config.prices.creditPack.credits} mensajes para el acompañante`, 'Créditos que no caducan.');

  async function portal(user) {
    if (!user.stripe_customer_id) throw Object.assign(new Error('Aún no tienes una suscripción.'), { status: 400 });
    const s = await stripe.billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `${appUrl}/` });
    return { url: s.url };
  }

  async function applySubscription(userId, sub, customerId) {
    const status = sub.status;
    const end = periodEndMs(sub);
    const interval = sub.items?.data?.[0]?.price?.recurring?.interval || sub.items?.data?.[0]?.plan?.interval || null;
    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || customerId || null;
    const base = { plan_status: status, stripe_subscription_id: sub.id, ...(customer ? { stripe_customer_id: customer } : {}) };
    if (ACTIVE.has(status)) {
      await db('users').where({ id: userId }).update({ ...base, plan: 'premium', plan_interval: interval, plan_expires_at: end ? end + GRACE_MS : null, cancel_at_period_end: !!sub.cancel_at_period_end });
    } else {
      await db('users').where({ id: userId }).update({ ...base, plan: 'free', plan_interval: null, plan_expires_at: null, cancel_at_period_end: false });
    }
  }

  async function syncSubscription(sub) {
    const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    let user = null;
    if (sub.metadata?.user_id) user = await db('users').where({ id: Number(sub.metadata.user_id) }).first();
    if (!user && customer) user = await db('users').where({ stripe_customer_id: customer }).first();
    if (!user) user = await db('users').where({ stripe_subscription_id: sub.id }).first();
    if (!user) { console.warn('[stripe] suscripción sin usuario asociado', sub.id); return { status: 'unknown' }; }
    await applySubscription(user.id, sub, customer);
    return { status: 'synced', userId: user.id };
  }

  async function fulfillOrder(userId, orderId, sessionId) {
    const order = await db('orders').where({ id: orderId, user_id: userId }).first();
    if (!order) return { status: 'unknown' };
    if (order.status === 'paid') return { status: 'paid', kind: order.kind, already: true };
    const n = await db('orders').where({ id: order.id, status: 'pending' }).update({ status: 'paid', paid_at: now(), stripe_session_id: sessionId });
    if (n !== 1) return { status: 'paid', kind: order.kind, already: true }; // otro proceso lo está cumpliendo
    try {
      const user = await db('users').where({ id: userId }).first();
      const payload = JSON.parse(order.payload);
      if (order.kind === 'candle') await createCandle(ctx, user, payload);
      else if (order.kind === 'credits') await db('users').where({ id: userId }).increment('credits', payload.credits);
    } catch (err) {
      await db('orders').where({ id: order.id }).update({ status: 'pending', paid_at: null }); // permite reintentar
      throw err;
    }
    return { status: 'paid', kind: order.kind };
  }

  /** Idempotente: se llama desde el webhook y desde /api/billing/confirm al volver de Stripe. */
  async function fulfillSession(session) {
    if (session.mode === 'subscription') {
      if (!['paid', 'no_payment_required'].includes(session.payment_status)) return { status: 'pending' };
      const userId = Number(session.client_reference_id || session.metadata?.user_id);
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (!userId || !subId) return { status: 'unknown' };
      const sub = await stripe.subscriptions.retrieve(subId);
      await applySubscription(userId, sub, typeof session.customer === 'string' ? session.customer : session.customer?.id);
      return { status: 'paid', kind: 'subscription' };
    }
    if (session.mode === 'payment') {
      if (session.payment_status !== 'paid') return { status: 'pending' };
      const userId = Number(session.client_reference_id || session.metadata?.user_id);
      const orderId = Number(session.metadata?.order_id);
      if (!userId || !orderId) return { status: 'unknown' };
      return fulfillOrder(userId, orderId, session.id);
    }
    return { status: 'ignored' };
  }

  async function confirm(user, sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (String(session.client_reference_id || session.metadata?.user_id) !== String(user.id)) throw Object.assign(new Error('Esta sesión de pago no es tuya.'), { status: 403 });
    return fulfillSession(session);
  }

  async function handleEvent(event) {
    if (await db('stripe_events').where({ id: event.id }).first()) return { duplicate: true };
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await fulfillSession(obj); break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(obj); break;
      case 'invoice.payment_failed': {
        const customer = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
        if (customer) await db('users').where({ stripe_customer_id: customer }).update({ plan_status: 'past_due' });
        break;
      }
      default: break;
    }
    await db('stripe_events').insert({ id: event.id, created_at: now() }).onConflict('id').ignore();
    return { handled: event.type };
  }

  return { checkoutSubscription, checkoutCandle, checkoutCredits, portal, confirm, fulfillSession, syncSubscription, handleEvent };
}
