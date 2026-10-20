// Elige el versículo que acompaña lo que escribe la persona.
// 1) Candidatos: los versículos de los 1-3 temas detectados (sin los vistos hace poco).
// 2) La IA elige el mejor ENTRE ESOS candidatos; si devuelve algo que no está en la lista, se ignora (nunca se inventa una cita).
// 3) Sin IA o si falla: coincidencia de palabras con lo que escribió y, si no hay, uno al azar del tema.
import * as V from './verses.js';

export async function selectVerse({ ai, text, assessment, avoidRefs = [] }) {
  const themes = (assessment.themes?.length ? assessment.themes : [assessment.theme]).slice(0, 3);
  const BONUS = [1.5, 0.7, 0];
  let cands = [...new Map(themes.flatMap((t, i) => V.versesOf(t).map((v) => ({ ...v, bonus: BONUS[i] || 0 }))).map((v) => [v.ref, v])).values()];
  const fresh = cands.filter((v) => !avoidRefs.includes(v.ref));
  if (fresh.length >= 3) cands = fresh;
  const ref = await ai.chooseVerse({ text, candidates: cands });
  const hit = ref ? cands.find((v) => v.ref === ref) : null;
  return hit || V.rankPick(text, cands);
}
