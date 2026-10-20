import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { money, plural, remaining } from '../format.js';
import Candle from '../components/Candle.jsx';
import { HelpFooter } from '../components/Crisis.jsx';

export default function Chapel() {
  const { config, auth, isPremium, prefill, setPrefill, setUsage, toast, setPremiumOpen } = useApp();
  const [data, setData] = useState(null);
  const [size, setSize] = useState('pequena');
  const [name, setName] = useState('');
  const [intention, setIntention] = useState('');
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(null);
  const formRef = useRef(null);

  const load = () => api.get('/api/candles').then((d) => { setData(d); setUsage(d.usage); }).catch((e) => toast(e.message, 'err'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (prefill?.intention) { setIntention(prefill.intention); setPrefill(null); formRef.current?.scrollIntoView?.({ block: 'start' }); } }, [prefill, setPrefill]);

  if (!config) return null;
  const paymentsOn = config.paymentsMode !== 'off';
  const sizes = config.candleSizes;
  const u = auth.usage?.smallCandles;
  const smallLeft = u ? Math.max(0, u.limit - u.used) : 0;
  const price = sizes[size].cents;

  async function light(e) {
    e.preventDefault();
    if (intention.trim().length < 2 || busy) return;
    setBusy(true); setHelp(null);
    try {
      const r = await api.post('/api/candles', { size, name, intention });
      if (r.checkoutUrl) { window.location.assign(r.checkoutUrl); return; }
      if (r.usage) setUsage(r.usage);
      if (r.helpline) setHelp(r.helpline);
      setName(''); setIntention(''); toast('Vela encendida.');
      await load();
    } catch (err) {
      if (err.code === 'LIMIT_CANDLES') { setUsage(err.data.usage); toast(err.message, 'err'); } else toast(err.message, 'err');
    } finally { setBusy(false); }
  }

  const days = (h) => (h >= 48 ? `${Math.round(h / 24)} días` : `${h} horas`);
  return (
    <main className="shell stack-lg">
      <header><h1 className="screen-title">Capilla</h1><p className="screen-lead">Enciende una vela por alguien o por algo. Arde en tu capilla durante el tiempo de su tamaño.</p></header>

      <form className="card stack" onSubmit={light} ref={formRef}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="label" id="size-label">Tamaño</span>
          <div className="sizes" role="radiogroup" aria-labelledby="size-label">
            {Object.entries(sizes).map(([key, s]) => {
              const off = (key === 'pequena' && smallLeft === 0) || (key !== 'pequena' && !paymentsOn);
              return (
                <button type="button" key={key} className="size" role="radio" aria-checked={size === key} disabled={off} onClick={() => setSize(key)}>
                  <span className="stage"><Candle size={key} scale={1.1} label="" /></span>
                  <b>{s.label}</b>
                  <span>{key !== 'pequena' && !paymentsOn ? 'Próximamente' : s.cents ? money(s.cents) : 'Gratis'}</span>
                  <span>{days(s.hours)}</span>
                </button>
              );
            })}
          </div>
          {size === 'pequena' && <p className="tiny muted">Pequeñas gratis este mes: te quedan {smallLeft} de {u?.limit}.</p>}
        </div>
        <div className="field">
          <label htmlFor="cname">¿Por quién la enciendes? <span className="muted">(opcional)</span></label>
          <input id="cname" type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Por ejemplo: mi madre" />
        </div>
        <div className="field">
          <label htmlFor="cintention">¿Cuál es tu intención?</label>
          <input id="cintention" type="text" value={intention} maxLength={140} onChange={(e) => setIntention(e.target.value)} placeholder="Por ejemplo: por su recuperación" />
          <span className="hint">{isPremium ? 'Esta vela llevará un versículo relacionado con tu intención.' : paymentsOn ? 'Con Premium, cada vela lleva un versículo relacionado.' : ''}</span>
        </div>
        {size === 'pequena' && smallLeft === 0 ? (
          <div className="stack">
            <p className="small">{paymentsOn ? <>Has usado tus velas pequeñas de este mes. Puedes encender una mediana o una grande{isPremium ? '' : ', o pasarte a Premium'}.</> : 'Has usado tus velas pequeñas de este mes. Se renuevan el día 1.'}</p>
            {paymentsOn && !isPremium && <button type="button" className="btn block" onClick={() => setPremiumOpen(true)}>Ver Premium</button>}
          </div>
        ) : (
          <>
            <button className="btn primary block" disabled={busy || intention.trim().length < 2}>{busy ? 'Un momento…' : price ? `Pagar ${money(price)} y encender` : 'Encender vela'}</button>
            {price > 0 && <p className="tiny muted">La vela se enciende de inmediato, por lo que al pagar pierdes el derecho de desistimiento. Una vela es un gesto de acompañamiento; no garantiza ningún resultado.</p>}
          </>
        )}
        {help && <HelpFooter helpline={help} onHelpline={setHelp} />}
      </form>

      {data && data.candles.length === 0 && <p className="muted center">Tu capilla está en calma. Cuando enciendas una vela, aparecerá aquí.</p>}
      <div className="candles">
        {data?.candles.map((c) => {
          const total = (sizes[c.size]?.hours || 24) * 3600000;
          return (
            <article key={c.id} className="candle-card">
              <div className="candle-stage"><Candle size={c.size} scale={1.7} label={`Vela ${sizes[c.size]?.label || ''}`} /></div>
              <p className="candle-name">{c.name}</p>
              <p className="candle-intention">«{c.intention}»</p>
              {c.verse && <p className="tiny muted">{c.verse.ref}</p>}
              <div className="burn" aria-hidden="true"><span style={{ width: `${Math.max(3, Math.min(100, (c.remainingMs / total) * 100))}%` }} /></div>
              <p className="tiny muted">Arde {remaining(c.remainingMs)} más</p>
            </article>
          );
        })}
      </div>
      {data?.hiddenCount > 0 && <p className="small muted center">Y {plural(data.hiddenCount, 'vela más arde', 'velas más arden')} en tu capilla.</p>}
    </main>
  );
}
