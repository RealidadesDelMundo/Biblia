// Prueba el service worker REAL (client/public/sw.js) cargándolo en un contexto aislado y simulando los eventos del navegador.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function loadSW({ windows = [] } = {}) {
  const listeners = {}, shown = [], opened = [], focused = [];
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    registration: { showNotification: async (title, opts) => { shown.push({ title, opts }); } },
    clients: { matchAll: async () => windows.map((w) => ({ ...w, focus: async () => { focused.push(w.url); } })), openWindow: async (u) => { opened.push(u); }, claim: async () => {} },
    skipWaiting: () => {},
  };
  const caches = { open: async () => ({ addAll: async () => {}, put: async () => {} }), keys: async () => [], delete: async () => true, match: async () => undefined };
  vm.runInNewContext(fs.readFileSync(new URL('../client/public/sw.js', import.meta.url), 'utf8'), { self, caches, location: { origin: 'https://app.example' }, URL, fetch: async () => ({}) });
  const fire = async (type, ev) => { const waits = []; listeners[type]({ ...ev, waitUntil: (p) => waits.push(p) }); await Promise.all(waits); };
  return { fire, shown, opened, focused };
}

describe('Service worker: recordatorios de oración', () => {
  test('al llegar un aviso lo muestra con su título, texto, icono y destino, y los avisos no se acumulan (misma etiqueta)', async () => {
    const sw = loadSW();
    await sw.fire('push', { data: { json: () => ({ title: 'Un momento para orar', body: 'Haz una pausa: tu oración te espera.', url: '/' }) } });
    assert.equal(sw.shown.length, 1);
    const { title, opts } = sw.shown[0];
    assert.equal(title, 'Un momento para orar');
    assert.equal(opts.body, 'Haz una pausa: tu oración te espera.');
    assert.equal(opts.icon, '/icons/icon-192.png');
    assert.equal(opts.tag, 'oracion-recordatorio');
    assert.equal(opts.data.url, '/');
  });

  test('si el contenido del aviso no es JSON o no hay contenido, igualmente se muestra un aviso válido', async () => {
    const sw = loadSW();
    await sw.fire('push', { data: { json: () => { throw new Error('no json'); }, text: () => 'Solo texto' } });
    await sw.fire('push', {});
    assert.deepEqual(sw.shown.map((x) => [x.title, x.opts.body]), [['Un momento para orar', 'Solo texto'], ['Un momento para orar', '']]);
    assert.ok(sw.shown.every((x) => x.opts.data.url === '/'));
  });

  test('al tocar el aviso se cierra y se abre la app (o se enfoca la ventana que ya está abierta)', async () => {
    const a = loadSW(); let closed = 0;
    await a.fire('notificationclick', { notification: { close: () => { closed++; }, data: { url: '/' } } });
    assert.equal(closed, 1); assert.deepEqual(a.opened, ['/']); assert.deepEqual(a.focused, []);
    const b = loadSW({ windows: [{ url: 'https://app.example/' }] });
    await b.fire('notificationclick', { notification: { close: () => {}, data: { url: '/' } } });
    assert.deepEqual(b.focused, ['https://app.example/']); assert.deepEqual(b.opened, []);
  });

  test('sigue sin guardar en caché nada de /api (datos personales)', () => {
    const src = fs.readFileSync(new URL('../client/public/sw.js', import.meta.url), 'utf8');
    assert.match(src, /url\.pathname\.startsWith\('\/api\/'\)\) return/);
  });
});
