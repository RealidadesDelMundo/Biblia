// Detección de riesgo (suicidio, autolesión, daño a terceros) y teléfonos de ayuda por país.
// Capas: (1) patrones deterministas, que funcionan aunque la IA falle, y (2) clasificación por IA (ver ai.js).
// El riesgo final es siempre el MÁXIMO de ambas capas: la IA puede subirlo, nunca bajarlo por debajo del suelo de los patrones.
import fs from 'node:fs';
import geoip from 'geoip-country';

const helplines = JSON.parse(fs.readFileSync(new URL('../data/helplines.json', import.meta.url), 'utf8'));

export const norm = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

// negatable: "no quiero morir" no debe disparar el patrón de deseo.
const HIGH_SELF = [
  { re: /\b(quiero|quisiera|me\s+quiero|ganas\s+de|voy\s+a|pienso|estoy\s+pensando\s+en|he\s+pensado\s+en|he\s+decidido|vull)\s+(morir|morirme|matarme|suicidarme|quitarme\s+la\s+vida|acabar\s+con\s+mi\s+vida|acabar\s+con\s+todo|terminar\s+con\s+mi\s+vida|terminar\s+con\s+todo|matar-?me|suicidar-?me)\b/, negatable: true },
  { re: /\b(me\s+voy\s+a\s+(matar|suicidar)|me\s+suicido|me\s+mato|me\s+quiero\s+matar)\b/, negatable: true },
  { re: /\bno\s+quiero\s+(seguir\s+)?(vivir|viviendo|estar\s+vivo|estar\s+viva|existir)\b/ },
  { re: /\bno\s+(vale|merece)\s+la\s+pena\s+(vivir|seguir\s+viviendo|seguir\s+adelante\s+con\s+mi\s+vida)\b/ },
  { re: /\b(estaria|estarian|estariamos)\s+mejor\s+(muert[oa]s?|sin\s+mi)\b|\bmejor\s+(estar\s+)?muert[oa]\b/, negatable: true },
  { re: /\b(ojala|quisiera)\s+(no\s+despertar|morirme|estar\s+muert[oa]|no\s+haber\s+nacido|no\s+existir)\b/, negatable: true },
  { re: /\b(pensamientos|ideas|ideacion|intenciones|tendencias)\s+suicidas?\b/ },
  { re: /\b(me\s+(quiero|voy\s+a)\s+cortar\s+(las\s+|los\s+)?(venas|munecas|brazos|piernas)|cortarme\s+(las\s+|los\s+)?(venas|munecas|brazos|piernas)|me\s+corto\s+(las\s+|los\s+)?(venas|munecas|brazos|piernas|muslos)|me\s+corto\s+(cuando|para|porque|a\s+escondidas)|me\s+estoy\s+cortando(?!\s+(el|las|los|mi)\s+(pelo|unas|flequillo|barba))|autolesion\w*|autolesionar\w*|hacerme\s+dano|hacerme\s+mal\s+a\s+proposito|me\s+hago\s+dano)\b/, negatable: true },
  { re: /\btomarme\s+(todas\s+)?(las\s+)?pastillas\b|\b(tengo|compre)\s+(un\s+plan|una\s+soga|pastillas)\s+para\s+(morir|matarme|suicidarme|acabar)\b/ },
  { re: /\b(i\s+want\s+to\s+die|kill\s+myself|end\s+my\s+life|want\s+to\s+end\s+it\s+all|i'?m\s+suicidal|suicidal\s+thoughts|hurt\s+myself)\b/, negatable: true },
  { re: /\b(em\s+vull\s+(matar|suicidar)|no\s+vull\s+viure|acabar\s+amb\s+la\s+meva\s+vida|vull\s+morir)\b/, negatable: true },
];

const HIGH_OTHERS = [
  { re: /\b(voy\s+a|quiero|tengo\s+ganas\s+de|pienso|estoy\s+pensando\s+en)\s+(matar|asesinar|apunalar|disparar\s+a|hacer(le)?\s+dano\s+a|pegar\s+a)\b/, negatable: true },
  { re: /\b(voy\s+a|quiero)\s+(matar|asesinar|hacer)(lo|la|los|las|le)\b/, negatable: true },
];

const MODERATE = [
  // Preocupación por otra persona (p. ej. al encender una vela): conviene ofrecer recursos
  /\b(se\s+quiere|se\s+quieren|quiere|quieren)\s+(morir|matar|suicidar|quitar\s+la\s+vida)\w*/,
  /\bamenaz\w+\s+con\s+(suicid|matarse|quitarse)/,
  /\b(intento|intentos)\s+de\s+suicidio\b/,
  /\bpensamientos\s+intrusivos\b/,
  /\bno\s+(puedo|aguanto|soporto)\s+mas\b/,
  /\bsuicid\w*/,
  /\b(desesperad[oa]|desesperacion|sin\s+salida|sin\s+esperanza|estoy\s+destrozad[oa])\b/,
  /\bmi\s+vida\s+no\s+tiene\s+sentido\b|\bya\s+nada\s+tiene\s+sentido\b|\btodo\s+me\s+da\s+igual\b/,
  /\bquiero\s+desaparecer\b|\bme\s+quiero\s+ir\s+de\s+aqui\s+para\s+siempre\b/,
  /\b(depresion|deprimid[oa]|ataques?\s+de\s+panico)\b/,
  /\b(sobredosis|me\s+siento\s+una\s+carga)\b/,
];

function isNegated(text, index) {
  const before = text.slice(Math.max(0, index - 18), index);
  return /\b(no|nunca|jamas|ni|tampoco)\s+$/.test(before) || /\b(no|never)\s+(me\s+)?$/.test(before);
}

export function assessRiskPatterns(text) {
  const t = norm(text);
  const hit = (list) => {
    for (const p of list) {
      const m = t.match(p.re);
      if (!m) continue;
      if (p.negatable && isNegated(t, m.index)) continue;
      return true;
    }
    return false;
  };
  if (hit(HIGH_SELF)) return { risk: 'high', kind: 'self' };
  if (hit(HIGH_OTHERS)) return { risk: 'high', kind: 'others' };
  if (MODERATE.some((re) => re.test(t))) return { risk: 'moderate', kind: 'self' };
  return { risk: 'none', kind: null };
}

const ORDER = { none: 0, moderate: 1, high: 2 };
export function maxRisk(a, b) {
  const x = ORDER[a] >= ORDER[b] ? a : b;
  return x;
}

// ---------- Teléfonos por país ----------
export const countries = helplines.countries;

export function listCountries() {
  return Object.entries(countries).map(([code, c]) => ({ code, name: c.name }));
}

export function helplineFor(code) {
  const c = countries[code];
  if (!c) return { code: code || null, name: null, line: null, note: null, emergency: null };
  return { code, name: c.name, line: c.line, note: c.note, emergency: c.emergency };
}

function cleanIp(ip) {
  if (!ip) return '';
  return String(ip).replace(/^::ffff:/, '');
}

export function detectCountry(req, user) {
  if (user?.country_override) {
    return { code: user.country_override === 'OTHER' ? null : user.country_override, source: 'override' };
  }
  const cf = req.headers['cf-ipcountry'];
  if (cf && /^[A-Za-z]{2}$/.test(cf) && !['XX', 'T1'].includes(cf.toUpperCase())) return { code: cf.toUpperCase(), source: 'ip' };
  try {
    const g = geoip.lookup(cleanIp(req.ip));
    if (g?.country) return { code: g.country, source: 'ip' };
  } catch { /* IP privada o inválida */ }
  const lang = String(req.headers['accept-language'] || '').split(',')[0];
  const region = lang.split('-')[1];
  if (region && /^[A-Za-z]{2}$/.test(region)) return { code: region.toUpperCase(), source: 'language' };
  return { code: null, source: 'unknown' };
}

export function helplineForRequest(req, user) {
  const { code, source } = detectCountry(req, user);
  return { ...helplineFor(code), source };
}

// ---------- Textos fijos (no dependen de la IA) ----------
export function highRiskText(kind, hl) {
  if (kind === 'others') {
    return [
      'Lo que describes suena a que alguien podría salir herido. Lo más importante ahora es que te alejes de la situación y de la persona, y que llames a emergencias' + (hl?.emergency ? ` (${hl.emergency})` : ' de tu país') + ' si hay peligro inmediato.',
      'Si puedes, habla ahora con alguien de confianza para no quedarte solo con esto. Cuando estés más tranquilo, un profesional de salud mental puede ayudarte a manejar lo que sientes.',
    ];
  }
  const line = hl?.line ? `Puedes llamar ahora a la línea de ayuda (${hl.line}).` : 'Puedes llamar ahora a la línea de prevención del suicidio de tu país.';
  return [
    'Lo que has escrito suena a que estás pasando por algo muy duro, y me importa que estés a salvo. No tienes que atravesarlo solo.',
    `${line} ${hl?.emergency ? `Si estás en peligro inmediato, llama a emergencias (${hl.emergency}).` : 'Si estás en peligro inmediato, llama a emergencias.'} Si puedes, dile ahora mismo a una persona de confianza que no estás bien y pídele que se quede contigo.`,
  ];
}
