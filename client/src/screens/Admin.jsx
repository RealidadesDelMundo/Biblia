import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { dateLong, plural } from '../format.js';

/** Panel de administración: cuánto usa cada persona (contadores), nunca lo que escribe. */
export default function Admin() {
  const { config, route, toast } = useApp();
  const [data, setData] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => api.get('/api/admin/users').then(setData).catch((e) => toast(e.message, 'err'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(id) {
    try { await api.del(`/api/admin/users/${id}`); setConfirm(null); await load(); toast('Cuenta borrada.'); } catch (e) { toast(e.message, 'err'); }
  }

  return (
    <main className="shell bare stack-lg">
      <div>
        <button className="btn quiet" style={{ paddingLeft: 0 }} onClick={() => route.navigate('/')}>Volver</button>
        <h1 className="screen-title">Personas registradas</h1>
        <p className="screen-lead">{data ? `${data.total} en total.` : 'Cargando…'} Solo ves cuánto usa cada persona, no lo que escribe.</p>
        {config && <p className="small muted">Límites mensuales del plan gratuito: {config.limits.free.prayers} oraciones, {config.limits.free.smallCandles} velas pequeñas y {config.limits.free.chat} mensajes. Se renuevan el día 1.</p>}
      </div>
      {data?.users.map((u) => (
        <article key={u.id} className="card stack" style={{ gap: 8 }}>
          <div className="spread">
            <b style={{ overflowWrap: 'anywhere' }}>{u.email}</b>
            <span className="small muted">{u.plan === 'premium' ? 'Premium' : 'Gratis'}{u.isAdmin ? ' · admin' : ''}</span>
          </div>
          <p className="small muted">Alta: {dateLong(u.createdAt)} · Último acceso: {u.lastLoginAt ? dateLong(u.lastLoginAt) : '—'}</p>
          <p className="small">Este mes: {plural(u.monthPrayers, 'oración', 'oraciones')} · {plural(u.monthCandles, 'vela pequeña', 'velas pequeñas')} · {plural(u.monthMessages, 'mensaje', 'mensajes')}</p>
          <p className="tiny muted">En total: {plural(u.prayers, 'oración', 'oraciones')} · {plural(u.candles, 'vela', 'velas')} · {plural(u.messages, 'mensaje', 'mensajes')}</p>
          {!u.isAdmin && (confirm === u.id
            ? <div className="row"><button className="btn danger sm" onClick={() => remove(u.id)}>Sí, borrar todo</button><button className="btn quiet sm" onClick={() => setConfirm(null)}>No</button></div>
            : <button className="btn quiet sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => setConfirm(u.id)}>Borrar cuenta y datos</button>)}
        </article>
      ))}
    </main>
  );
}
