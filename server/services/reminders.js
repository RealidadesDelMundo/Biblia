// Recordatorios de oración: a las horas que elige cada persona (en SU zona horaria) se envía un aviso breve y genérico.
const MESSAGES = [
  'Respira hondo. ¿Qué quieres poner hoy en manos de Dios?',
  'Haz una pausa: tu oración te espera.',
  'Un minuto para ti y para Dios.',
  '¿Cómo está tu corazón ahora? Cuéntaselo en oración.',
  'Es un buen momento para dar gracias.',
  'Detente un instante y ora por quien lo necesita.',
  'Un respiro, una oración, y sigue con tu día.',
  'Aquí tienes un momento de calma para orar.',
];
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export const pickMessage = (key) => MESSAGES[hash(key) % MESSAGES.length];

export const validTz = (tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return typeof tz === 'string' && tz.length > 0; } catch { return false; } };

/** Fecha local (AAAA-MM-DD) y minutos desde medianoche en esa zona horaria. */
export function localParts(now, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** Envía a todos los dispositivos de una persona. Los que el navegador da por caducados (404/410) se eliminan. */
export async function sendToUser({ db, push, userId, payload }) {
  const subs = await db('push_subscriptions').where({ user_id: userId });
  let sent = 0, removed = 0;
  for (const s of subs) {
    try {
      await push.send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) { await db('push_subscriptions').where({ id: s.id }).del(); removed++; }
      else console.error('[push]', e?.statusCode || '', e?.message);
    }
  }
  return { sent, removed };
}

/**
 * Revisa quién tiene un aviso pendiente. Se ejecuta cada minuto. Un aviso es "pendiente" si su hora fue hace 0-5 minutos y aún no se envió.
 * El aviso se reclama con una actualización atómica en la base de datos, así que aunque haya varias instancias del servidor nunca se duplica.
 */
export async function tick({ db, push, now = Date.now() }) {
  const rows = await db('reminder_settings').where({ enabled: true });
  let delivered = 0;
  for (const r of rows) {
    let times; try { times = JSON.parse(r.times); } catch { continue; }
    if (!Array.isArray(times) || !validTz(r.tz)) continue;
    const { date, minutes } = localParts(now, r.tz);
    for (const t of times) {
      const [h, m] = String(t).split(':').map(Number);
      const diff = minutes - (h * 60 + m);
      if (!(diff >= 0 && diff <= 5)) continue;
      const key = `${date}|${t}`;
      const claimed = await db('reminder_settings').where({ user_id: r.user_id }).andWhere((q) => q.whereNull('last_key').orWhereNot('last_key', key)).update({ last_key: key });
      if (!claimed) continue;
      const res = await sendToUser({ db, push, userId: r.user_id, payload: { title: 'Un momento para orar', body: pickMessage(key), url: '/' } });
      delivered += res.sent;
      if ((await db('push_subscriptions').where({ user_id: r.user_id }).count({ n: '*' }).first()).n == 0) await db('reminder_settings').where({ user_id: r.user_id }).update({ enabled: false });
    }
  }
  return delivered;
}

export function startReminderScheduler({ db, push }) {
  const timer = setInterval(() => tick({ db, push }).catch((e) => console.error('[recordatorios]', e?.message)), 60 * 1000);
  timer.unref?.();
  return () => clearInterval(timer);
}
