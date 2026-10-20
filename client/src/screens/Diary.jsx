import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { dateLong, plural } from '../format.js';
import Verse from '../components/Verse.jsx';

export default function Diary() {
  const { config, toast, setPremiumOpen, go } = useApp();
  const paymentsOn = config?.paymentsMode !== 'off';
  const [data, setData] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => api.get('/api/entries').then(setData).catch((e) => toast(e.message, 'err'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(id) {
    try { await api.del(`/api/entries/${id}`); setConfirm(null); await load(); toast('Oración borrada.'); }
    catch (e) { toast(e.message, 'err'); }
  }

  return (
    <main className="shell stack-lg">
      <header><h1 className="screen-title">Mi diario</h1><p className="screen-lead">Tus oraciones, guardadas solo para ti.</p></header>
      {!data && <p className="muted">Cargando…</p>}
      {data && data.total === 0 && (
        <div className="card stack center">
          <p>Aquí se guardarán tus oraciones.</p>
          <button className="btn primary" onClick={() => go('hoy')}>Escribir la primera</button>
        </div>
      )}
      {data?.entries.map((e) => (
        <article key={e.id} className="card stack">
          <div className="spread">
            <span className="small muted">{dateLong(e.createdAt)} · {e.themeLabel}</span>
            {confirm === e.id
              ? <span className="row"><button className="btn danger sm" onClick={() => remove(e.id)}>Sí, borrar</button><button className="btn quiet sm" onClick={() => setConfirm(null)}>No</button></span>
              : <button className="btn quiet sm" onClick={() => setConfirm(e.id)} aria-label="Borrar esta oración"><Trash2 size={18} /></button>}
          </div>
          <p className="small muted"><b style={{ color: 'var(--vellum)', fontWeight: 500 }}>Lo que escribiste:</b> {e.original}</p>
          <div className="prayer">{e.prayer.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
          <Verse verse={e.verse} small />
        </article>
      ))}
      {data && data.hiddenCount > 0 && (
        <div className="card raised stack">
          <p>Tienes {plural(data.hiddenCount, 'oración más guardada', 'oraciones más guardadas')}. {paymentsOn ? 'Con Premium las ves todas; no se pierde nada.' : 'No se pierde nada: siguen guardadas.'}</p>
          {paymentsOn && <button className="btn primary" onClick={() => setPremiumOpen(true)}>Ver Premium</button>}
        </div>
      )}
    </main>
  );
}
