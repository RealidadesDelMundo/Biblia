import { loadConfig } from '../server/config.js';
import { createDb } from '../server/db.js';
import { createApp } from '../server/app.js';
import { createAI } from '../server/services/ai.js';

process.env.RATE_LIMIT_DISABLED ??= '1';

export async function startApp({ env = {}, aiClient, stripe, mailer, rateLimits = false } = {}) {
  if (rateLimits) delete process.env.RATE_LIMIT_DISABLED;
  const config = loadConfig({ NODE_ENV: 'test', SQLITE_PATH: ':memory:', BCRYPT_ROUNDS: '4', JWT_SECRET: 'test-secret', PORT: '0', PAYMENTS_MODE: 'demo', APP_URL: 'http://localhost:3000', ...env });
  const db = await createDb(config);
  const ai = createAI(config, aiClient ? { client: aiClient } : {});
  const app = createApp({ config, db, ai, stripe, mailer, clientDir: '/nonexistent' });
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  if (rateLimits) process.env.RATE_LIMIT_DISABLED = '1';
  return { base, config, db, ai, close: async () => { await new Promise((r) => server.close(r)); await db.destroy(); } };
}

export function client(base) {
  let cookie = '';
  const call = async (method, path, body, headers = {}, raw) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
      body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) { const [kv] = c.split(';'); const i = kv.indexOf('='); const v = kv.slice(i + 1); cookie = v === '' ? '' : kv; }
    let json = null; try { json = await res.json(); } catch { /* sin cuerpo */ }
    return { status: res.status, json, headers: res.headers, setCookie };
  };
  return {
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, b, h) => call('POST', p, b ?? {}, h),
    patch: (p, b, h) => call('PATCH', p, b, h),
    del: (p, b, h) => call('DELETE', p, b ?? {}, h),
    postRaw: (p, raw, h) => call('POST', p, undefined, h, raw),
    get cookie() { return cookie; },
  };
}

let n = 0;
export async function signup(base, over = {}) {
  const c = client(base);
  const email = over.email ?? `user${++n}_${Date.now()}@example.com`;
  const r = await c.post('/api/auth/register', { email, password: 'clave-segura-1', consent: true, ...over.body });
  if (r.status !== 201) throw new Error('signup falló: ' + JSON.stringify(r.json));
  return { c, email, user: r.json.user };
}

/** Cliente de IA falso: registra cada llamada y responde según el modelo (rápido = clasificación, principal = texto). */
export function fakeAnthropic({ assess = () => ({ risk: 'none', theme: 'ansiedad' }), choose = (candidatesText) => ({ ref: candidatesText.split('\n')[1].split(' — ')[0] }), text = () => 'Señor, gracias por escucharme. Dame calma y claridad para hoy.', failMain = false } = {}) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (args) => {
        calls.push(args);
        if (args.model === 'claude-haiku-5-5') {
          const userText = args.messages[0].content;
          const isChoose = /elige el versículo|Eliges el versículo/i.test(args.system);
          return { content: [{ type: 'text', text: JSON.stringify(isChoose ? choose(userText) : assess(userText)) }] };
        }
        if (failMain) { const e = new Error('servicio caído'); e.status = 529; throw e; }
        return { content: [{ type: 'text', text: text(args) }] };
      },
    },
  };
}
