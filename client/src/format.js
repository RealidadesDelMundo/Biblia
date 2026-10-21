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

/**
 * La persona escribe «por quién» enciende la vela desde SU punto de vista («mi madre»). Cuando la app se lo dice a ella
 * («¿apagar la vela de…?») hay que pasarlo a segunda persona: «tu madre». Solo cambia los posesivos y pronombres más comunes.
 */
export function toSecondPerson(text) {
  const w = (s) => new RegExp(`(?<![\\p{L}])${s}(?![\\p{L}])`, 'giu');
  const keep = (from, to) => (m) => (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to);
  return String(text || '')
    .replace(w('mis'), keep('mis', 'tus')).replace(w('mi'), keep('mi', 'tu'))
    .replace(w('mío'), keep('mío', 'tuyo')).replace(w('mía'), keep('mía', 'tuya')).replace(w('míos'), keep('míos', 'tuyos')).replace(w('mías'), keep('mías', 'tuyas'))
    .replace(w('mí'), keep('mí', 'ti')).replace(w('conmigo'), keep('conmigo', 'contigo'));
}

