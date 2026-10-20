// Construye server/data/verses.json con el texto REAL de la Reina-Valera 1909 (dominio público)
// a partir de las referencias elegidas a mano en el prototipo.
// Uso: node scripts/build-verses.mjs <prototipo.jsx> <SpaRV.json> <salida.json>
import fs from 'node:fs';

const [,, protoPath, rvPath, outPath] = process.argv;
const src = fs.readFileSync(protoPath, 'utf8');
const start = src.indexOf('const VERSES = {');
const end = src.indexOf('\n};', start) + 3;
const themes = new Function('return ' + src.slice(start + 'const VERSES = '.length, end - 1))();

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
const byName = Object.fromEntries(rv.books.map(b => [b.name, b]));

// Ortografía: solo se actualizan acentos de monosílabos y preposiciones/conjunciones antiguas.
function normalize(t) {
  let s = t.replace(/\s+/g, ' ').trim();
  // Las primeras palabras de cada pasaje vienen en versalitas (EN, Y, MAS...): se pasan a minúscula salvo la inicial
  s = s.replace(/^([¡¿(]?)([A-ZÁÉÍÓÚÑ]{2,})(?=[\s,;:.!?])/, (m, pre, w) => pre + w[0] + w.slice(1).toLowerCase());
  s = s.replace(/\bfué\b/g, 'fue').replace(/\bvió\b/g, 'vio').replace(/\bdió\b/g, 'dio').replace(/\bfuí\b/g, 'fui')
       .replace(/\bví\b/g, 'vi').replace(/\bá\b/g, 'a').replace(/\bó\b/g, 'o').replace(/\bFué\b/g, 'Fue').replace(/\bDió\b/g, 'Dio');
  return s;
}

// En los salmos con título, la RV1909 lo incluye dentro del versículo 1 ("Al Músico principal: ... DIOS es nuestro amparo").
// El texto del versículo empieza en la primera palabra en versalitas que sigue al título.
function stripTitle(text) {
  const m = text.match(/[.:?!)]\s+([¡¿]?[A-ZÁÉÍÓÚÑ]{2,}\b)/);
  if (!m) return text;
  const cut = m.index + m[0].length - m[1].length;
  return text.slice(cut);
}

function lookup(ref) {
  const m = ref.match(/^(.+?) (\d+):(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error('Referencia no válida: ' + ref);
  const [, name, c, v1, v2] = m;
  const en = BOOKS[name];
  if (!en) throw new Error('Libro desconocido: ' + name + ' en ' + ref);
  const book = byName[en];
  const chap = book.chapters.find(x => x.chapter === Number(c));
  if (!chap) throw new Error('Capítulo inexistente: ' + ref);
  const from = Number(v1), to = v2 ? Number(v2) : from;
  const vs = chap.verses.filter(x => x.verse >= from && x.verse <= to);
  if (vs.length !== to - from + 1) throw new Error('Versículos incompletos: ' + ref);
  const parts = vs.map((x, i) => {
    let t = x.text;
    if (en === 'Psalms' && x.verse === 1) t = stripTitle(t);
    if (en === 'Habakkuk' && c === '3') t = t.replace(/\s*Al jefe de los cantores.*$/, '');
    return normalize(t);
  });
  return parts.join(' ');
}

const out = { translation: 'Reina-Valera 1909 (dominio público)', themes: {} };
let n = 0;
for (const [theme, list] of Object.entries(themes)) {
  out.themes[theme] = list.map(({ ref, text }) => { n++; return { ref, text: lookup(ref), summary: text }; });
}
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`OK: ${Object.keys(out.themes).length} temas, ${n} versículos -> ${outPath}`);
