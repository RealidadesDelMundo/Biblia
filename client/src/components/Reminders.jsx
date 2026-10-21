import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

const PRESETS = [
  { id: '3h', label: 'Cada 3 horas', times: ['08:00', '11:00', '14:00', '17:00', '20:00'] },
  { id: '2h', label: 'Cada 2 horas', times: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'] },
  { id: '3x', label: '3 veces al día', times: ['08:00', '14:00', '21:00'] },
  { id: '1x', label: '1 vez al día', times: ['08:00'] },
  { id: 'custom', label: 'Personalizado', times: null },
];
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const presetOf = (times) => PRESETS.find((p) => p.times && same(p.times, [...times].sort()))?.id || 'custom';
const keyToBytes = (b64) => {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
function capability() {
  const apis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (apis) return { ok: true, denied: Notification.permission === 'denied' };
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return { ok: false, ios, standalone };
}

/** 'ok' (se puede activar), 'denied' (bloqueadas en el navegador), 'ios-install' (iPhone sin instalar la app) o 'unsupported'. */
export function reminderSupport() {
  const c = capability();
  if (c.ok) return c.denied ? 'denied' : 'ok';
  return c.ios && !c.standalone ? 'ios-install' : 'unsupported';
}

/** Recordatorios de oración: avisos push a las horas que elige la persona (cada N horas, N veces al día o a medida). */
export default function Reminders() {
  const { config, toast, prefill, setPrefill } = useApp();
  const sectionRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [times, setTimes] = useState(PRESETS[0].times);
  const [preset, setPreset] = useState('3h');
  const [newTime, setNewTime] = useState('12:00');
  const [busy, setBusy] = useState(false);
  const cap = useMemo(capability, []);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  useEffect(() => {
    api.get('/api/reminders').then((s) => { setStatus(s); if (s.times.length) { setTimes(s.times); setPreset(presetOf(s.times)); } }).catch(() => {});
  }, []);

  // Si se llega desde el aviso de Hoy («¿Quieres que te recordemos orar?»), se baja hasta esta tarjeta
  useEffect(() => {
    if (prefill?.focus === 'reminders' && sectionRef.current) { sectionRef.current.scrollIntoView?.({ block: 'start', behavior: 'smooth' }); setPrefill(null); }
  }, [prefill, setPrefill, status]);

  if (!config?.push?.enabled) return null;
  const enabled = !!status?.enabled;

  const save = async (on, next = times) => { const s = await api.put('/api/reminders', { enabled: on, times: next, tz }); setStatus({ ...s, available: true }); };
  const apply = async (next, nextPreset) => {
    setTimes(next); setPreset(nextPreset);
    if (enabled) { try { await save(true, next); } catch (e) { toast(e.message, 'err'); } }
  };

  async function enable() {
    setBusy(true);
    try {
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') { toast('Para recibir avisos, permite las notificaciones cuando el navegador te lo pregunte.', 'err'); return; }
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
      const opts = { userVisibleOnly: true, applicationServerKey: keyToBytes(config.push.publicKey) };
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        try { sub = await reg.pushManager.subscribe(opts); }
        catch { await (await reg.pushManager.getSubscription())?.unsubscribe(); sub = await reg.pushManager.subscribe(opts); }
      }
      await api.post('/api/reminders/subscribe', { subscription: sub.toJSON() });
      await save(true);
      toast('Recordatorios activados.');
    } catch (e) {
      toast(e?.message === 'timeout' ? 'Recarga la página (o abre la aplicación instalada) y vuelve a intentarlo.' : 'No se pudieron activar los recordatorios en este dispositivo.', 'err');
    } finally { setBusy(false); }
  }
  async function disable() { try { await save(false); toast('Recordatorios desactivados.'); } catch (e) { toast(e.message, 'err'); } }
  async function sendTest() {
    try { const r = await api.post('/api/reminders/test'); r.sent ? toast('Aviso enviado. Debería llegarte en unos segundos.') : toast('No hemos podido enviarlo a este dispositivo. Prueba a desactivar y volver a activar.', 'err'); }
    catch (e) { toast(e.message, 'err'); }
  }
  const choose = (id) => { const p = PRESETS.find((x) => x.id === id); p.times ? apply(p.times, id) : setPreset('custom'); };
  function addTime() {
    if (!newTime || times.includes(newTime)) return;
    if (times.length >= 12) { toast('Puedes elegir hasta 12 horas.', 'err'); return; }
    const next = [...times, newTime].sort(); apply(next, presetOf(next));
  }
  function removeTime(t) {
    if (times.length === 1 && enabled) { toast('Deja al menos una hora o desactiva los recordatorios.', 'err'); return; }
    const next = times.filter((x) => x !== t); apply(next, presetOf(next));
  }

  return (
    <section className="card stack" aria-labelledby="rem-h" ref={sectionRef}>
      <h2 id="rem-h" className="label">Recordatorios de oración</h2>
      <p className="small">Te enviamos un aviso breve para que hagas una pausa y ores. Tú eliges cuándo.</p>
      {!cap.ok ? (
        cap.ios && !cap.standalone
          ? <p className="notice">En iPhone y iPad: pulsa Compartir y «Añadir a pantalla de inicio», abre Oración desde su icono y podrás activar aquí los recordatorios.</p>
          : <p className="notice">Este navegador no admite avisos. Prueba con Chrome, Edge o Firefox, o con Safari en un iPhone con la app instalada.</p>
      ) : cap.denied ? (
        <p className="notice warn">Tienes las notificaciones bloqueadas para esta página. Actívalas en los ajustes del navegador (el candado junto a la dirección) y vuelve aquí.</p>
      ) : (
        <>
          <div className="chips" role="radiogroup" aria-label="Frecuencia">
            {PRESETS.map((p) => <button key={p.id} type="button" className="chip" role="radio" aria-checked={preset === p.id} style={preset === p.id ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : undefined} onClick={() => choose(p.id)}>{p.label}</button>)}
          </div>
          <div className="chips" aria-label="Horas elegidas">
            {times.map((t) => <span key={t} className="chip">{t} <button type="button" className="btn quiet sm" style={{ minHeight: 0, padding: '0 4px' }} aria-label={`Quitar las ${t}`} onClick={() => removeTime(t)}>×</button></span>)}
          </div>
          <div className="row">
            <label htmlFor="newtime" className="sr-only">Añadir una hora</label>
            <input id="newtime" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="btn sm" onClick={addTime}>Añadir hora</button>
          </div>
          <p className="tiny muted">Las horas son de tu zona horaria ({tz}).</p>
          {enabled
            ? <div className="row-wrap"><button type="button" className="btn" onClick={disable}>Desactivar</button><button type="button" className="btn quiet" onClick={sendTest}>Enviar una prueba</button></div>
            : <button type="button" className="btn primary block" disabled={busy || !times.length} onClick={enable}>{busy ? 'Un momento…' : 'Activar recordatorios'}</button>}
          {enabled && <p className="notice" role="status">Recordatorios activados en este dispositivo.</p>}
        </>
      )}
      <p className="tiny muted">Puedes desactivarlos cuando quieras. Se borran con tu cuenta.</p>
    </section>
  );
}
