const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
export const money = (cents) => eur.format(cents / 100);
export const dateLong = (ms) => new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
export const dateShort = (ms) => new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
export const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function remaining(ms) {
  const h = ms / 3600000;
  if (h < 1) return 'menos de una hora';
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} días`;
}
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const telHref = (line) => (/^[\d\s*#+]+$/.test(line || '') ? `tel:${encodeURIComponent(line.replace(/\s/g, ''))}` : null);
