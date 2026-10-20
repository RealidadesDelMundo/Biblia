import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 6000 }); // margen para máquinas lentas o con carga

afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

// jsdom no implementa <dialog>.showModal ni varias APIs del navegador
HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// fetch relativo -> servidor real de pruebas, con "cookie jar" como un navegador
let jar = '';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const base = process.env.TEST_BASE;
  const headers = { ...(init.headers || {}), ...(jar ? { cookie: jar } : {}) };
  const res = await realFetch(String(url).startsWith('/') ? base + url : url, { ...init, headers });
  for (const c of res.headers.getSetCookie?.() ?? []) { const kv = c.split(';')[0]; jar = kv.split('=')[1] === '' ? '' : kv; }
  return res;
};
globalThis.__resetJar__ = () => { jar = ''; };
