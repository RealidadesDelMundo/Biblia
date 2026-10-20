import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { dateShort, localDay, plural } from '../format.js';
import Candle from '../components/Candle.jsx';
import Verse from '../components/Verse.jsx';
import { CrisisCard, HelpFooter } from '../components/Crisis.jsx';

export default function Today() {
  const { config, auth, isPremium, setUsage, go, toast, setPremiumOpen } = useApp();
  const [votd, setVotd] = useState(null);
  const [intention, setIntention] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const paymentsOn = config?.paymentsMode !== 'off';

  useEffect(() => {
    let live = true;
    api.get(`/api/verse-of-the-day?d=${localDay()}`).then((d) => live && setVotd(d)).catch(() => {});
    return () => { live = false; };
  }, [auth.user?.plan]);

  const usage = auth.usage;
  const limit = usage?.prayers.limit;
  const left = limit === null || limit === undefined ? null : Math.max(0, limit - usage.prayers.used);
  const blocked = left === 0;

  async function write(e) {
    e.preventDefault();
    if (intention.trim().length < 3 || busy) return;
    setBusy(true); setResult(null);
    try {
      const r = await api.post('/api/prayers', { intention });
      if (r.usage) setUsage(r.usage);
      setResult(r);
      if (r.risk !== 'high') setIntention('');
    } catch (err) {
      if (err.code === 'LIMIT_PRAYERS') { setUsage(err.data.usage); if (paymentsOn) setPremiumOpen(true); else toast(err.message, 'err'); } else toast(err.message, 'err');
    } finally { setBusy(false); }
  }

  const setHelpline = (h) => setResult((r) => ({ ...r, helpline: h }));

  return (
    <main className="shell stack-lg">
      <header className="hero">
        <Candle size="mediana" scale={1.7} label="Vela encendida" />
        <h1 className="screen-title">{votd?.personalized ? 'Tu versículo de hoy' : 'Versículo del día'}</h1>
      </header>

      <section className="card" aria-label="Versículo del día">
        {votd ? <Verse verse={votd.verse} share note={votd.note} /> : <p className="muted">Cargando el versículo…</p>}
        {votd && !isPremium && paymentsOn && (
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Con Premium este versículo se elige según lo que has orado esta semana. <button className="btn quiet sm" style={{ minHeight: 28, padding: '0 4px' }} onClick={() => setPremiumOpen(true)}>Ver Premium</button>
          </p>
        )}
      </section>

      {config?.aiMode === 'demo' && <p className="notice warn" role="note">Modo de demostración: la IA no está conectada y las oraciones son de ejemplo.</p>}

      {result?.risk === 'high' ? (
        <CrisisCard data={result} onHelpline={setHelpline}>
          <button className="btn block" onClick={() => setResult(null)}>Volver</button>
        </CrisisCard>
      ) : result?.entry ? (
        <section className="card stack" aria-label="Tu oración">
          <Verse verse={result.entry.verse} small />
          <hr className="divider" style={{ margin: '4px 0' }} />
          <div className="prayer">{result.entry.prayer.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
          <p className="tiny muted">Oración escrita por una IA. Guardada en tu diario.</p>
          {result.aiFallback && <p className="notice">Hoy la IA no está disponible, así que te dejamos una oración de este tema. No se ha gastado ninguna de tus oraciones.</p>}
          {result.risk === 'moderate' && <HelpFooter helpline={result.helpline} onHelpline={setHelpline} />}
          <div className="row-wrap">
            <button className="btn sm" onClick={() => go('capilla', { intention: result.entry.original.slice(0, 140) })}><Flame size={16} /> Encender una vela</button>
            <button className="btn quiet sm" onClick={() => setResult(null)}>Escribir otra</button>
          </div>
        </section>
      ) : (
        <form className="card stack" onSubmit={write}>
          <div className="field">
            <label htmlFor="intention">¿Qué quieres llevar a oración hoy?</label>
            <textarea id="intention" value={intention} maxLength={1000} onChange={(e) => setIntention(e.target.value)} disabled={blocked}
              placeholder="Por ejemplo: mañana tengo una entrevista de trabajo y estoy nervioso." />
          </div>
          {blocked ? (
            <div className="stack">
              <p>Has usado tus {limit} oraciones gratuitas de este mes. Se renuevan el {dateShort(usage.resetsAt)}.</p>
              {paymentsOn && <button type="button" className="btn primary block" onClick={() => setPremiumOpen(true)}>Ver Premium</button>}
            </div>
          ) : (
            <>
              <button className="btn primary block" disabled={busy || intention.trim().length < 3}>{busy ? 'Escribiendo tu oración…' : 'Escribir mi oración'}</button>
              {left !== null && <p className="tiny muted center">Te quedan {plural(left, 'oración gratuita', 'oraciones gratuitas')} este mes.</p>}
            </>
          )}
        </form>
      )}
    </main>
  );
}
