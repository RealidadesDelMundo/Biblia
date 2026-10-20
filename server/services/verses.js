// Versículos: texto real de la Reina-Valera 1909 (dominio público). La IA NUNCA inventa ni cita versículos:
// solo elige el tema y el servidor selecciona de esta base curada.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { norm } from './crisis.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const versesFile = read('verses.json');
const themesFile = read('themes.json');
const demoPrayers = read('demo-prayers.json');
// 'summary' (mi paráfrasis en lenguaje actual) pasa a llamarse 'gist': se muestra aparte y siempre rotulada como paráfrasis, nunca como texto bíblico.
for (const list of Object.values(versesFile.themes)) for (const v of list) { v.gist = v.summary; delete v.summary; }

export const TRANSLATION = { id: 'rv1909', name: 'Reina-Valera 1909', note: 'Dominio público' };
export const THEMES = Object.keys(versesFile.themes);
export const LABELS = themesFile.labels;
export const ALL = THEMES.flatMap((theme) => versesFile.themes[theme].map((v) => ({ theme, ref: v.ref, text: v.text, gist: v.gist })));
const byRef = new Map(ALL.map((v) => [v.ref, v]));
const keywordMap = Object.fromEntries(Object.entries(themesFile.keywords).map(([k, list]) => [k, list.map(norm)]));

export const isTheme = (t) => Object.prototype.hasOwnProperty.call(versesFile.themes, t);
export const getVerse = (ref) => byRef.get(ref) || null;
export const publicVerse = (v) => ({ ref: v.ref, text: v.text, gist: v.gist ?? byRef.get(v.ref)?.gist ?? null, theme: v.theme, themeLabel: LABELS[v.theme] || v.theme });

function hashInt(...parts) {
  const h = crypto.createHash('sha256').update(parts.join('|')).digest();
  return h.readUInt32BE(0);
}

/** Elige un versículo del tema evitando los recientes. Aleatorio salvo que se pase `seed`. */
export function pickVerse(theme, { avoidRefs = [], seed } = {}) {
  const list = (isTheme(theme) ? versesFile.themes[theme] : versesFile.themes.general).map((v) => ({ ...v, theme: isTheme(theme) ? theme : 'general' }));
  const fresh = list.filter((v) => !avoidRefs.includes(v.ref));
  const pool = fresh.length ? fresh : list;
  const i = seed === undefined ? Math.floor(Math.random() * pool.length) : seed % pool.length;
  return pool[i];
}

// ---------- Versículo del día ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Orden fijo (pseudoaleatorio) de temas: días consecutivos nunca repiten tema y, con el tiempo, se recorren todos los versículos.
const THEME_ORDER = (() => {
  const arr = [...THEMES];
  const rnd = mulberry32(20261020);
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
})();

export function dayIndexFromDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function verseOfTheDay(dateStr) {
  const n = dayIndexFromDateStr(dateStr);
  const theme = THEME_ORDER[n % THEME_ORDER.length];
  const cycle = Math.floor(n / THEME_ORDER.length);
  const list = versesFile.themes[theme];
  const v = list[cycle % list.length];
  return { theme, ref: v.ref, text: v.text, gist: v.gist };
}

/** Versículo personalizado (premium): el tema que más has orado en los últimos días. Devuelve null si no hay datos. */
export function personalVerseOfTheDay({ userId, dateStr, recentEntries }) {
  const since = Date.now() - 7 * 86400000;
  const recent = recentEntries.filter((e) => e.created_at >= since && e.theme !== 'general');
  if (!recent.length) return null;
  const counts = new Map();
  recent.forEach((e, idx) => counts.set(e.theme, (counts.get(e.theme) || 0) + 1 + idx * 1e-6)); // desempate: el más reciente
  const [theme] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const avoid = recentEntries.slice(0, 14).map((e) => e.verse_ref);
  const v = pickVerse(theme, { avoidRefs: avoid, seed: hashInt(userId, dateStr, theme) });
  return { theme, ref: v.ref, text: v.text, gist: v.gist };
}

// ---------- Clasificación de tema sin IA (modo demostración / respaldo) ----------
export function guessTheme(text) {
  const t = ` ${norm(text)} `;
  let best = 'general';
  let bestScore = 0;
  for (const [theme, words] of Object.entries(keywordMap)) {
    let score = 0;
    for (const w of words) if (w && t.includes(w)) score += w.length >= 6 ? 2 : 1;
    if (score > bestScore) { best = theme; bestScore = score; }
  }
  return best;
}

export const demoPrayer = (theme) => demoPrayers[theme] || demoPrayers.general;
