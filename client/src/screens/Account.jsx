import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { dateLong, money } from '../format.js';
import Sheet from '../components/Sheet.jsx';

const SCALES = [{ v: '100', label: 'A', title: 'Tamaño normal' }, { v: '112', label: 'A', title: 'Tamaño grande' }, { v: '125', label: 'A', title: 'Tamaño muy grande' }];
export const applyScale = (v) => { document.documentElement.style.fontSize = `${v}%`; };

export default function Account() {
  const { config, auth, isPremium, logout, toast, refresh, applySession, setPremiumOpen, route } = useApp();
  const user = auth.user;
  const [scale, setScale] = useState(() => localStorage.getItem('oracion.scale') || '100');
  const [helpline, setHelpline] = useState(null);
  const [delOpen, setDelOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [installEvt, setInstallEvt] = useState(window.__installPrompt || null);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia?.('(display-mode: standalone)').matches;

  useEffect(() => { api.get('/api/helpline').then((r) => setHelpline(r.helpline)).catch(() => {}); }, []);
  useEffect(() => { const f = (e) => { e.preventDefault(); window.__installPrompt = e; setInstallEvt(e); }; window.addEventListener('beforeinstallprompt', f); return () => window.removeEventListener('beforeinstallprompt', f); }, []);

  const chooseScale = (v) => { setScale(v); localStorage.setItem('oracion.scale', v); applyScale(v); };

  async function setCountry(code) {
    try { await api.patch('/api/me', { countryOverride: code }); setHelpline((await api.get('/api/helpline')).helpline); toast('País actualizado.'); } catch (e) { toast(e.message, 'err'); }
  }
  async function portal() {
    try { const r = await api.post('/api/billing/portal'); window.location.assign(r.url); } catch (e) { toast(e.message, 'err'); }
  }
  async function devToggle() {
    try { applySession(await api.post('/api/billing/dev/premium', { on: !isPremium })); } catch (e) { toast(e.message, 'err'); }
  }
  async function exportData() {
    try {
      const r = await fetch('/api/me/export', { credentials: 'same-origin' });
      if (!r.ok) throw new Error('No se pudieron descargar tus datos.');
      const url = URL.createObjectURL(await r.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: 'mis-datos-oracion.json' });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { toast(e.message, 'err'); }
  }
  async function deleteAccount(e) {
    e.preventDefault(); setBusy(true);
    try { await api.del('/api/me', { password: pw }); await logout(); toast('Tu cuenta y tus datos se han borrado.'); }
    catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  }
  const link = (to) => (e) => { e.preventDefault(); route.navigate(to); };

  if (!user || !config) return null;
  const renew = user.planExpiresAt ? dateLong(user.planExpiresAt) : null;
  return (
    <main className="shell stack-lg">
      <header><h1 className="screen-title">Cuenta</h1><p className="screen-lead">{user.email}</p></header>

      <section className="card stack" aria-labelledby="plan-h">
        <h2 id="plan-h" className="label">Tu plan</h2>
        {isPremium ? (
          <>
            <p><b>Premium</b> {user.planInterval === 'year' ? '(anual)' : '(mensual)'}</p>
            {renew && <p className="small muted">{user.cancelAtPeriodEnd ? `Termina el ${renew}. No se renovará.` : `Se renueva alrededor del ${renew}.`}</p>}
            {user.planStatus === 'past_due' && <p className="notice warn">No hemos podido cobrar la última renovación. Revisa tu método de pago.</p>}
            {config.paymentsMode === 'stripe' && <button className="btn" onClick={portal}>Gestionar o cancelar suscripción</button>}
          </>
        ) : (
          <>
            <p><b>Gratuito</b></p>
            <p className="small muted">{config.limits.free.prayers} oraciones, {config.limits.free.smallCandles} velas pequeñas y {config.limits.free.chat} mensajes con el acompañante al mes; ves tus 3 últimas oraciones.</p>
            {config.paymentsMode !== 'off'
              ? <button className="btn primary" onClick={() => setPremiumOpen(true)}>Ver Premium · desde {money(Math.round(config.prices.yearly / 12))} al mes</button>
              : <p className="small muted">Premium llegará pronto.</p>}
          </>
        )}
        {config.paymentsMode === 'demo' && <button className="btn quiet sm" onClick={devToggle}>Modo de pruebas: {isPremium ? 'quitar' : 'activar'} Premium</button>}
      </section>

      <section className="card stack" aria-labelledby="read-h">
        <h2 id="read-h" className="label">Lectura</h2>
        <div className="row" role="radiogroup" aria-label="Tamaño del texto">
          {SCALES.map((s, i) => (
            <button key={s.v} className="btn" role="radio" aria-checked={scale === s.v} title={s.title} aria-label={s.title}
              style={{ fontSize: `${0.95 + i * 0.25}rem`, borderColor: scale === s.v ? 'var(--gold)' : undefined, flex: 1 }} onClick={() => chooseScale(s.v)}>{s.label}</button>
          ))}
        </div>
        <p className="small muted">Traducción bíblica: {config.translation.name} ({config.translation.note.toLowerCase()}). Añadiremos otras cuando se resuelvan sus licencias.</p>
      </section>

      <section className="card stack" aria-labelledby="help-h">
        <h2 id="help-h" className="label">Teléfonos de ayuda</h2>
        <div className="field">
          <label htmlFor="country" className="small muted">País que usamos para mostrarte ayuda si alguna vez la necesitas</label>
          <select id="country" value={user.countryOverride || ''} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Detectar automáticamente{helpline?.name ? ` (ahora: ${helpline.name})` : ''}</option>
            {config.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            <option value="OTHER">Otro país</option>
          </select>
        </div>
      </section>

      {(installEvt || ios) && (
        <section className="card stack">
          <h2 className="label">Instalar la aplicación</h2>
          {installEvt
            ? <button className="btn" onClick={async () => { installEvt.prompt(); await installEvt.userChoice; window.__installPrompt = null; setInstallEvt(null); }}><Download size={16} /> Añadir a la pantalla de inicio</button>
            : <p className="small muted">En el iPhone: toca el botón Compartir del navegador y elige «Añadir a pantalla de inicio».</p>}
        </section>
      )}

      <section className="card stack" aria-labelledby="data-h">
        <h2 id="data-h" className="label">Tus datos</h2>
        <button className="btn" onClick={exportData}>Descargar mis datos</button>
        <button className="btn danger" onClick={() => setDelOpen(true)}>Borrar mi cuenta y mis datos</button>
      </section>

      <footer className="stack center" style={{ gap: 6 }}>
        <p className="small"><a href="/privacidad" onClick={link('/privacidad')}>Privacidad</a> · <a href="/terminos" onClick={link('/terminos')}>Términos</a> · <a href={`mailto:${config.supportEmail}`}>Soporte</a></p>
        <button className="btn block" onClick={logout}>Cerrar sesión</button>
        <p className="tiny muted">Pagos y suscripciones gestionados por Stripe. No vemos los datos de tu tarjeta.</p>
      </footer>

      <Sheet open={delOpen} onClose={() => setDelOpen(false)} title="Borrar mi cuenta">
        <form className="stack" onSubmit={deleteAccount}>
          <p>Se borrarán tu diario, tus velas y tus conversaciones, y se cancelará tu suscripción. No se puede deshacer.</p>
          <div className="field"><label htmlFor="delpw">Escribe tu contraseña para confirmar</label><input id="delpw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required /></div>
          <button className="btn danger block" disabled={busy || !pw}>{busy ? 'Borrando…' : 'Borrar todo'}</button>
        </form>
      </Sheet>
    </main>
  );
}
