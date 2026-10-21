import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { dateLong, plural } from '../format.js';

const when = (ms) => new Date(ms).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function describe(e) {
  if (e.type === 'oracion') return 'Escribió una oración';
  if (e.type === 'vela') return `Encendió una vela (${e.size})`;
  if (e.type === 'fuera_de_tema') return 'Pidió algo ajeno al acompañante (desviado, sin guardar)';
  return 'Envió un mensaje al acompañante';
}

/** Panel de administración: cuánto usa y qué ha hecho cada persona (tipo y fecha). Nunca lo que escribe ni de qué trata. */
export default function Admin() {
  const { config, route, toast } = useApp();
  const [data, setData] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [open, setOpen] = useState(null);
  const [events, setEvents] = useState(null);

  const load = () => api.get('/api/admin/users').then(setData).catch((e) => toast(e.message, 'err'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(id) {
    try { await api.del(`/api/admin/users/${id}`); setConfirm(null); await load(); toast('Cuenta borrada.'); } catch (e) { toast(e.message, 'err'); }
  }
  async function toggle(id) {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setEvents(null);
    try { setEvents((await api.get(`/api/admin/users/${id}/activity`)).events); } catch (e) { toast(e.message, 'err'); }
  }

  return (
    <main className="shell bare stack-lg">
      <div>
        <button className="btn quiet" style={{ paddingLeft: 0 }} onClick={() => route.navigate('/')}>Volver</button>
        <h1 className="screen-title">Personas registradas</h1>
        <p className="screen-lead">{data ? `${data.total} en total.` : 'Cargando…'} Ves cuánto usa y qué ha hecho cada persona, no lo que escribe.</p>
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
          {u.offTopic > 0 && <p className="small">Mensajes fuera de tema desviados: {u.monthOffTopic} este mes · {u.offTopic} en total</p>}
          <p className="tiny muted">En total: {plural(u.prayers, 'oración', 'oraciones')} · {plural(u.candles, 'vela', 'velas')} · {plural(u.messages, 'mensaje', 'mensajes')}</p>
          <button className="btn quiet sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => toggle(u.id)} aria-expanded={open === u.id}>{open === u.id ? 'Ocultar actividad' : 'Ver actividad'}</button>
          {open === u.id && (
            <ul className="activity" style={{ margin: 0, paddingLeft: 18 }}>
              {!events && <li className="small muted">Cargando…</li>}
              {events?.length === 0 && <li className="small muted">Sin actividad todavía.</li>}
              {events?.map((e, i) => <li key={i} className="small"><span className="muted">{when(e.at)}</span> · {describe(e)}</li>)}
            </ul>
          )}
          {!u.isAdmin && (confirm === u.id
            ? <div className="row"><button className="btn danger sm" onClick={() => remove(u.id)}>Sí, borrar todo</button><button className="btn quiet sm" onClick={() => setConfirm(null)}>No</button></div>
            : <button className="btn quiet sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => setConfirm(u.id)}>Borrar cuenta y datos</button>)}
        </article>
      ))}
    </main>
  );
}
