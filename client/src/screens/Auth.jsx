import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import Candle from '../components/Candle.jsx';

function Password({ id, label, value, onChange, autoComplete, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{show ? <EyeOff size={20} /> : <Eye size={20} />}</button>
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export default function Auth() {
  const { config, applySession, toast, route } = useApp();
  const [inviteCode, setInviteCode] = useState('');
  const [mode, setMode] = useState('register'); // register | login | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (mode === 'register' && !consent) { setError('Para crear la cuenta necesitamos que aceptes el tratamiento de tus datos.'); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') { await api.post('/api/auth/forgot', { email }); setSent(true); return; }
      const d = await api.post(mode === 'register' ? '/api/auth/register' : '/api/auth/login', mode === 'register' ? { email, password, consent: true, inviteCode } : { email, password });
      applySession(d);
      if (mode === 'register') toast('Cuenta creada. Bienvenido.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const title = mode === 'register' ? 'Crea tu cuenta' : mode === 'login' ? 'Entra a tu cuenta' : 'Recupera tu contraseña';
  return (
    <main className="shell bare stack-lg">
      <div className="hero" style={{ paddingTop: 12 }}><Candle size="mediana" scale={1.8} /></div>
      <div>
        <h1 className="screen-title center">{title}</h1>
        {mode === 'register' && <p className="screen-lead center">Tu diario y tus velas se guardan en tu cuenta, solo para ti.</p>}
      </div>
      {sent ? (
        <div className="card stack">
          <p>Si existe una cuenta con ese correo, te hemos enviado un enlace para elegir una contraseña nueva. Caduca en una hora.</p>
          <button className="btn block" onClick={() => { setSent(false); setMode('login'); }}>Volver a entrar</button>
        </div>
      ) : (
        <form className="card stack" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
          </div>
          {mode !== 'forgot' && (
            <Password id="password" label="Contraseña" value={password} onChange={setPassword} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} hint={mode === 'register' ? 'Mínimo 8 caracteres.' : undefined} />
          )}
          {mode === 'register' && config?.inviteRequired && (
            <div className="field">
              <label htmlFor="invite">Código de invitación</label>
              <input id="invite" type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} autoCapitalize="none" autoComplete="off" spellCheck="false" required />
              <span className="hint">Esta versión es solo para personas invitadas.</span>
            </div>
          )}
          {mode === 'register' && (
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Soy mayor de 18 años y consiento que se traten mis oraciones y datos, que pueden revelar mis creencias religiosas, para prestarme el servicio. Lo explicamos en la{' '}
                <a href="/privacidad" onClick={(e) => { e.preventDefault(); route.navigate('/privacidad'); }}>Política de privacidad</a>.</span>
            </label>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary block" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'register' ? 'Crear cuenta' : mode === 'login' ? 'Entrar' : 'Enviarme el enlace'}
          </button>
        </form>
      )}
      {!sent && (
        <div className="stack center" style={{ gap: 4 }}>
          {mode !== 'register' && <button className="btn quiet" onClick={() => { setMode('register'); setError(''); }}>Crear una cuenta nueva</button>}
          {mode !== 'login' && <button className="btn quiet" onClick={() => { setMode('login'); setError(''); }}>Ya tengo cuenta</button>}
          {mode === 'login' && <button className="btn quiet" onClick={() => { setMode('forgot'); setError(''); }}>He olvidado mi contraseña</button>}
        </div>
      )}
    </main>
  );
}

export function ResetPassword() {
  const { route, toast } = useApp();
  const token = new URLSearchParams(route.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { await api.post('/api/auth/reset', { token, password }); toast('Contraseña cambiada. Ya puedes entrar.'); route.navigate('/', { replace: true }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <main className="shell bare stack-lg">
      <h1 className="screen-title">Elige una contraseña nueva</h1>
      <form className="card stack" onSubmit={submit}>
        <Password id="newpw" label="Contraseña nueva" value={password} onChange={setPassword} autoComplete="new-password" hint="Mínimo 8 caracteres." />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Un momento…' : 'Guardar contraseña'}</button>
      </form>
    </main>
  );
}
