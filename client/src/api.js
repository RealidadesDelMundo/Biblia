async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Sin conexión. Comprueba tu red e inténtalo de nuevo.'), { status: 0, code: 'OFFLINE' });
  }
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Algo ha fallado. Inténtalo de nuevo.'), { status: res.status, code: data?.code, data });
  return data;
}
export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p, b = {}) => request('DELETE', p, b),
};
