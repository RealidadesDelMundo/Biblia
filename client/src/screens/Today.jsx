import { useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { dateShort, localDay, plural } from '../format.js';
import Candle from '../components/Candle.jsx';
import Usage from '../components/Usage.jsx';
import { reminderSupport } from '../components/Reminders.jsx';
import Verse from '../components/Verse.jsx';
import { CrisisCard, HelpFooter } from '../components/Crisis.jsx';

const NUDGE_KEY = 'oracion.remNudgeUntil';

export default function Today() {
  const { config, auth, isPremium, setUsage, go, toast, setPremiumOpen } = useApp();
  const [votd, setVotd] = useState(null);
  const [intention, setIntention] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const paymentsOn = config?.paymentsMode !== 'off';
  const crisisRef = useRef(null);
  // Aviso «¿Quieres que te recordemos orar?»: solo tras una oración, si los recordatorios se pueden usar y aún no están activados.
  const [remStatus, setRemStatus] = useState(null);
  const [nudgeOff, setNudgeOff] = useState(false);
  useEffect(() => {
    if (!result?.entry || !config?.push?.enabled) return;
    api.get('/api/reminders').then(setRemStatus).catch(() => {});
  }, [result?.entry]); // eslint-disable-line react-hooks/exhaustive-deps
  const snoozed = () => { try { return Number(localStorage.getItem(NUDGE_KEY) || 0) > Date.now(); } catch { return false; } };
  const snooze = (days) => { try { localStorage.setItem(NUDGE_KEY, String(Date.now() + days * 86400000)); } catch { /* sin almacenamiento */ } };
  const showNudge = !!result?.entry && !nudgeOff && !!remStatus?.available && !remStatus.enabled && !snoozed() && ['ok', 'ios-install'].includes(reminderSupport());
  // Si hay riesgo alto, la ayuda debe verse al instante, sin tener que buscarla
  useEffect(() => { if (result?.risk === 'high') crisisRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); }, [result]);

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
        {votd ? <Verse verse={votd.verse} share note={votd.note} openGist /> : <p className="muted">Cargando el versículo…</p>}
        {votd && !isPremium && paymentsOn && (
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Con Premium este versículo se elige según lo que has orado esta semana. <button className="btn quiet sm" style={{ minHeight: 28, padding: '0 4px' }} onClick={() => setPremiumOpen(true)}>Ver Premium</button>
          </p>
        )}
      </section>

      {config?.aiMode === 'demo' && <p className="notice warn" role="note">Versión de prueba: las oraciones de esta versión son de ejemplo.</p>}

      {result?.risk === 'high' ? (
        <div ref={crisisRef} style={{ scrollMarginTop: 12 }}>
          <CrisisCard data={result} onHelpline={setHelpline}>
            <button className="btn block" onClick={() => setResult(null)}>Volver</button>
          </CrisisCard>
        </div>
      ) : result?.entry ? (
        <section className="card stack" aria-label="Tu oración">
          <Verse verse={result.entry.verse} small openGist />
          <hr className="divider" style={{ margin: '4px 0' }} />
          <div className="prayer">{result.entry.prayer.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
          <p className="tiny muted">Oración creada para ti por tu acompañante virtual. Guardada en tu diario.</p>
          {result.aiFallback && <p className="notice">Hoy tu acompañante no está disponible, así que te dejamos una oración de este tema. No se ha gastado ninguna de tus oraciones.</p>}
          {result.risk === 'moderate' && <HelpFooter helpline={result.helpline} onHelpline={setHelpline} />}
          <div className="row-wrap">
            <button className="btn sm" onClick={() => go('capilla', { intention: result.entry.original.slice(0, 140) })}><Flame size={16} /> Encender una vela</button>
            <button className="btn quiet sm" onClick={() => setResult(null)}>Escribir otra</button>
          </div>
          {showNudge && (
            <div className="notice" role="region" aria-label="Recordatorios de oración">
              <b>¿Quieres que te recordemos orar?</b>
              <p className="small" style={{ margin: '4px 0 10px' }}>Te avisamos con un mensaje breve a las horas que elijas, por ejemplo cada 3 horas.</p>
              <div className="row-wrap">
                <button className="btn primary sm" onClick={() => { snooze(3); go('cuenta', { focus: 'reminders' }); }}>Activar recordatorios</button>
                <button className="btn quiet sm" onClick={() => { snooze(30); setNudgeOff(true); }}>Ahora no</button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <form className="card stack" onSubmit={write}>
          <div className="field">
            <label htmlFor="intention">¿Qué oración nace hoy de tu corazón?</label>
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
              {limit != null && <Usage label="Oraciones este mes" used={usage.prayers.used} limit={limit} note={`Se renuevan el ${dateShort(usage.resetsAt)}`} />}
            </>
          )}
        </form>
      )}
    </main>
  );
}
