/** Contador de uso mensual: «Oraciones este mes  2/3» con barra y nota (p. ej. cuándo se renueva). */
export default function Usage({ label, used, limit, note }) {
  const shown = Math.min(used, limit);
  const pct = limit ? Math.min(100, (shown / limit) * 100) : 0;
  const full = shown >= limit;
  return (
    <div className="usage" role="group" aria-label={`${label}: ${shown} de ${limit}`}>
      <div className="spread"><span className="small">{label}</span><b className="small" style={{ color: full ? 'var(--gold)' : undefined }}>{shown}/{limit}</b></div>
      <div className="burn" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      {note && <p className="tiny muted" style={{ marginTop: 6 }}>{note}</p>}
    </div>
  );
}
