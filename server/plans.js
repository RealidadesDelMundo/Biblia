// Planes, límites y uso mensual. TODO el control de límites se hace aquí, en el servidor.
export const monthStart = (now = Date.now()) => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
export const nextMonthStart = (now = Date.now()) => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
};

export function isPremium(user, now = Date.now()) {
  return user.plan === 'premium' && (!user.plan_expires_at || user.plan_expires_at > now);
}

export function limitsFor(config, user, now = Date.now()) {
  return isPremium(user, now) ? config.limits.premium : config.limits.free;
}

const count = async (q) => Number((await q.count({ n: '*' }).first())?.n || 0);

export async function usage(db, config, user, now = Date.now()) {
  const from = monthStart(now);
  const lim = limitsFor(config, user, now);
  const [prayers, small, chat] = await Promise.all([
    count(db('entries').where({ user_id: user.id, counted: true }).where('created_at', '>=', from)),
    count(db('candles').where({ user_id: user.id, size: 'pequena' }).where('created_at', '>=', from)),
    count(db('chat_messages').where({ user_id: user.id, role: 'user' }).where('created_at', '>=', from)),
  ]);
  const chatLeftFromAllowance = Math.max(0, lim.chat - chat);
  return {
    premium: isPremium(user, now),
    resetsAt: nextMonthStart(now),
    prayers: { used: prayers, limit: Number.isFinite(lim.prayers) ? lim.prayers : null },
    smallCandles: { used: small, limit: lim.smallCandles },
    chat: { used: chat, allowance: lim.chat, remainingAllowance: chatLeftFromAllowance, credits: user.credits, available: chatLeftFromAllowance + user.credits },
    diaryVisible: Number.isFinite(lim.diaryVisible) ? lim.diaryVisible : null,
  };
}

export const publicUser = (user, now = Date.now(), adminEmails = []) => ({
  id: user.id,
  email: user.email,
  isAdmin: adminEmails.includes(user.email),
  plan: isPremium(user, now) ? 'premium' : 'free',
  planInterval: isPremium(user, now) ? user.plan_interval : null,
  planStatus: user.plan_status,
  planExpiresAt: user.plan_expires_at,
  cancelAtPeriodEnd: !!user.cancel_at_period_end,
  hasBilling: !!user.stripe_customer_id,
  countryOverride: user.country_override,
  createdAt: user.created_at,
});
