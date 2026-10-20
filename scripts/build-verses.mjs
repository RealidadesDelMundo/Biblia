// Construye server/data/verses.json con el texto REAL de la Reina-Valera 1909 (dominio público) a partir de
// scripts/verses-source.json (referencias elegidas a mano + resumen en lenguaje actual).
// Uso: node scripts/build-verses.mjs <SpaRV.json> [fuente.json] [salida.json]
//   SpaRV.json: https://github.com/scrollmapper/bible_databases (formats/json/SpaRV.json)
import fs from 'node:fs';

const [,, rvPath, srcPath = 'scripts/verses-source.json', outPath = 'server/data/verses.json'] = process.argv;
const source = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const rv = JSON.parse(fs.readFileSync(rvPath, 'utf8'));
const BOOKS = {
  'Génesis':'Genesis','Éxodo':'Exodus','Levítico':'Leviticus','Números':'Numbers','Deuteronomio':'Deuteronomy','Josué':'Joshua',
  'Jueces':'Judges','Rut':'Ruth','1 Samuel':'I Samuel','2 Samuel':'II Samuel','1 Reyes':'I Kings','2 Reyes':'II Kings',
  '1 Crónicas':'I Chronicles','2 Crónicas':'II Chronicles','Esdras':'Ezra','Nehemías':'Nehemiah','Ester':'Esther','Job':'Job',
  'Salmo':'Psalms','Proverbios':'Proverbs','Eclesiastés':'Ecclesiastes','Cantares':'Song of Solomon','Isaías':'Isaiah',
  'Jeremías':'Jeremiah','Lamentaciones':'Lamentations','Ezequiel':'Ezekiel','Daniel':'Daniel','Oseas':'Hosea','Joel':'Joel',
  'Amós':'Amos','Abdías':'Obadiah','Jonás':'Jonah','Miqueas':'Micah','Nahúm':'Nahum','Habacuc':'Habakkuk','Sofonías':'Zephaniah',
  'Hageo':'Haggai','Zacarías':'Zechariah','Malaquías':'Malachi','Mateo':'Matthew','Marcos':'Mark','Lucas':'Luke','Juan':'John',
  'Hechos':'Acts','Romanos':'Romans','1 Corintios':'I Corinthians','2 Corintios':'II Corinthians','Gálatas':'Galatians',
  'Efesios':'Ephesians','Filipenses':'Philippians','Colosenses':'Colossians','1 Tesalonicenses':'I Thessalonians',
  '2 Tesalonicenses':'II Thessalonians','1 Timoteo':'I Timothy','2 Timoteo':'II Timothy','Tito':'Titus','Filemón':'Philemon',
  'Hebreos':'Hebrews','Santiago':'James','1 Pedro':'I Peter','2 Pedro':'II Peter','1 Juan':'I John','2 Juan':'II John',
  '3 Juan':'III John','Judas':'Jude','Apocalipsis':'Revelation of John',
};
const byName = Object.fromEntries(rv.books.map((b) => [b.name, b]));

// Ortografía: solo se actualizan la preposición «á», la conjunción «ó» y monosílabos con tilde antigua (fué, vió, dió, fuí, ví).
// IMPORTANTE: los límites de palabra deben ser Unicode (\b de JavaScript no entiende vocales con tilde y quitaba la tilde de «corazón»).
const W = '[\\p{L}]';
const word = (w) => new RegExp(`(?<!${W})${w}(?!${W})`, 'gu');
function normalize(t) {
  let s = t.replace(/\s+/g, ' ').trim();
  s = s.replace(/^([¡¿(]?)([A-ZÁÉÍÓÚÑ]{2,})(?=[\s,;:.!?])/u, (m, pre, w) => pre + w[0] + w.slice(1).toLowerCase());
  s = s.replace(word('fué'), 'fue').replace(word('vió'), 'vio').replace(word('dió'), 'dio').replace(word('fuí'), 'fui')
       .replace(word('ví'), 'vi').replace(word('á'), 'a').replace(word('ó'), 'o')
       .replace(word('Fué'), 'Fue').replace(word('Dió'), 'Dio').replace(word('Vió'), 'Vio')
  s = s.replace(word('oir'), 'oír').replace(word('Oir'), 'Oír').replace(word('Angel'), 'Ángel').replace(word('Angeles'), 'Ángeles'); // omisiones de tilde de la fuente

  return s;
}
// En los salmos con título, la RV1909 lo incluye dentro del versículo 1; el texto empieza en la primera palabra en versalitas.
function stripTitle(text) {
  const m = text.match(/[.:?!)]\s+([¡¿]?[A-ZÁÉÍÓÚÑ]{2,}\b)/);
  return m ? text.slice(m.index + m[0].length - m[1].length) : text;
}
function lookup(ref) {
  const m = ref.match(/^(.+?) (\d+):(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error('Referencia no válida: ' + ref);
  const [, name, c, v1, v2] = m;
  const en = BOOKS[name];
  if (!en) throw new Error('Libro desconocido: ' + name + ' en ' + ref);
  const chap = byName[en].chapters.find((x) => x.chapter === Number(c));
  if (!chap) throw new Error('Capítulo inexistente: ' + ref);
  const from = Number(v1), to = v2 ? Number(v2) : from;
  const vs = chap.verses.filter((x) => x.verse >= from && x.verse <= to);
  if (vs.length !== to - from + 1) throw new Error('Versículos incompletos: ' + ref);
  return vs.map((x) => {
    let t = x.text;
    if (en === 'Psalms' && x.verse === 1) t = stripTitle(t);
    if (en === 'Habakkuk' && c === '3') t = t.replace(/\s*Al jefe de los cantores.*$/, '');
    return normalize(t);
  }).join(' ');
}

// ---- Legibilidad: ¿se entiende hoy sin esfuerzo? (se usa para el versículo del día) ----
const stem = (s) => new Set(s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 4).map((w) => w.slice(0, 5)));
function readability(text, gist) {
  const a = stem(gist), b = stem(text);
  let hit = 0; for (const w of a) if (b.has(w)) hit++;
  const sim = a.size ? hit / a.size : 0;
  const archaic = (text.match(/\b(á|empero|mas|vosotros|vuestr\w+|os|aseguraréme|salud|JAH|cuyo|mesmo|acaecer\w*|agora)\b/gi) || []).length
    + (text.match(/\b\w{3,}(?:ó|ió|é)(?:le|les|lo|los|la|las|me|te|se)\b/gi) || []).length;
  return sim - 0.12 * archaic - (text.length > 230 ? 0.2 : 0);
}

const out = { translation: 'Reina-Valera 1909 (dominio público)', themes: {} };
const seen = new Map();
const all = [];
let dups = 0;
for (const [theme, list] of Object.entries(source)) {
  out.themes[theme] = [];
  for (const { ref, gist } of list) {
    if (seen.has(ref)) { dups++; console.warn(`  duplicado omitido: ${ref} (${theme}; ya está en ${seen.get(ref)})`); continue; }
    seen.set(ref, theme);
    const text = lookup(ref);
    const v = { ref, text, gist, _r: readability(text, gist) };
    out.themes[theme].push(v); all.push(v);
  }
}
// Umbral global: ~58 % más legibles; cada tema conserva al menos 2 "legibles" para que el versículo del día pueda recorrer todos los temas
const sorted = all.map((v) => v._r).sort((a, b) => b - a);
const cut = sorted[Math.floor(sorted.length * 0.58)];
for (const list of Object.values(out.themes)) {
  list.forEach((v) => { v.readable = v._r >= cut; });
  const need = 2 - list.filter((v) => v.readable).length;
  if (need > 0) [...list].filter((v) => !v.readable).sort((a, b) => b._r - a._r).slice(0, need).forEach((v) => { v.readable = true; });
  list.forEach((v) => delete v._r);
}
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
const n = all.length;
console.log(`OK: ${Object.keys(out.themes).length} temas, ${n} versículos (${dups} duplicados omitidos), ${all.filter((v) => out.themes[Object.keys(out.themes).find((t) => out.themes[t].includes(v))].find((x) => x === v).readable).length} legibles -> ${outPath}`);
