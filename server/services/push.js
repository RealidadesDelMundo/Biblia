// Notificaciones push web (VAPID). Sin servicios de terceros de pago: el aviso viaja por el servicio de notificaciones del propio navegador
// (Google, Apple, Mozilla o Microsoft). El contenido de los avisos es genérico: nunca incluye nada personal.
import webpush from 'web-push';

/** Claves VAPID: las de las variables de entorno si existen; si no, se generan una vez y se guardan en la base de datos (sin configuración manual). */
export async function ensureVapid(db, config) {
  if (config.vapid.publicKey && config.vapid.privateKey) return { publicKey: config.vapid.publicKey, privateKey: config.vapid.privateKey };
  const read = async () => { const row = await db('app_settings').where({ key: 'vapid' }).first(); return row ? JSON.parse(row.value) : null; };
  const found = await read();
  if (found) return found;
  await db('app_settings').insert({ key: 'vapid', value: JSON.stringify(webpush.generateVAPIDKeys()) }).onConflict('key').ignore();
  return read();
}

export async function createPush(db, config) {
  const keys = await ensureVapid(db, config);
  const subject = /^https:\/\//.test(config.appUrl) ? config.appUrl : `mailto:${config.supportEmail}`;
  const vapidDetails = { subject, publicKey: keys.publicKey, privateKey: keys.privateKey };
  return {
    publicKey: keys.publicKey,
    send: (subscription, payload) => webpush.sendNotification(subscription, JSON.stringify(payload), { vapidDetails, TTL: 6 * 3600, urgency: 'normal' }),
  };
}
