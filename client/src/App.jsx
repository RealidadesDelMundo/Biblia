import { useEffect, useRef, useState } from 'react';
import { BookOpen, Flame, MessageCircle, Sun, User } from 'lucide-react';
import { api } from './api.js';
import { AppProvider, useApp } from './store.jsx';
import Candle from './components/Candle.jsx';
import Toasts from './components/Toasts.jsx';
import PremiumSheet from './components/PremiumSheet.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Auth, { ResetPassword } from './screens/Auth.jsx';
import Today from './screens/Today.jsx';
import Diary from './screens/Diary.jsx';
import Chapel from './screens/Chapel.jsx';
import Companion from './screens/Companion.jsx';
import Account, { applyScale } from './screens/Account.jsx';
import { Privacy, Terms } from './screens/Legal.jsx';
import Admin from './screens/Admin.jsx';

const TABS = [
  { id: 'hoy', label: 'Hoy', Icon: Sun, View: Today },
  { id: 'diario', label: 'Diario', Icon: BookOpen, View: Diary },
  { id: 'capilla', label: 'Capilla', Icon: Flame, View: Chapel },
  { id: 'hablar', label: 'Hablar', Icon: MessageCircle, View: Companion },
  { id: 'cuenta', label: 'Cuenta', Icon: User, View: Account },
];

/** Vuelta desde Stripe: ?checkout=success&session_id=... */
function useCheckoutReturn() {
  const { auth, route, toast, applySession, go } = useApp();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || auth.status !== 'ready') return;
    const q = new URLSearchParams(route.search);
    const state = q.get('checkout');
    if (!state) return;
    done.current = true;
    route.navigate('/', { replace: true });
    if (state === 'cancel') { toast('Has cancelado el pago. No se ha cobrado nada.'); return; }
    const sessionId = q.get('session_id');
    if (!sessionId) return;
    api.post('/api/billing/confirm', { sessionId }).then((r) => {
      applySession(r);
      const kind = r.result?.kind;
      if (r.result?.status !== 'paid') { toast('Estamos confirmando tu pago. Si no se refleja en unos minutos, escríbenos.'); return; }
      if (kind === 'subscription') { toast('¡Premium activado! Gracias.'); go('cuenta'); }
      else if (kind === 'candle') { toast('Tu vela está encendida.'); go('capilla'); }
      else if (kind === 'credits') { toast('Mensajes añadidos.'); go('hablar'); }
    }).catch((e) => toast(e.message, 'err'));
  }, [auth.status]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Main() {
  const { tab, setTab } = useApp();
  useCheckoutReturn();
  const View = TABS.find((t) => t.id === tab).View;
  return (
    <>
      <View key={tab} />
      <nav className="tabbar" aria-label="Secciones">
        <div className="tabbar-inner">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); window.scrollTo?.(0, 0); }}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </div>
      </nav>
      <PremiumSheet />
    </>
  );
}

function Root() {
  const { config, bootError, auth, route } = useApp();
  const [seen, setSeen] = useState(() => localStorage.getItem('oracion.seen') === '1');

  useEffect(() => { applyScale(localStorage.getItem('oracion.scale') || '100'); }, []);

  if (bootError) return (
    <main className="shell bare stack-lg"><div className="card stack"><h1 className="screen-title">No podemos conectar</h1><p className="muted">{bootError}</p><button className="btn primary" onClick={() => window.location.reload()}>Reintentar</button></div></main>
  );
  if (!config || auth.status === 'loading') return (
    <main className="shell bare"><div className="hero" style={{ paddingTop: '28vh' }}><Candle size="mediana" scale={2} label="Cargando" /><p className="muted">Un momento…</p></div></main>
  );
  if (route.path === '/privacidad') return <Privacy />;
  if (route.path === '/terminos') return <Terms />;
  if (route.path === '/restablecer') return <ResetPassword />;
  if (auth.status === 'anon') return seen ? <Auth /> : <Onboarding onDone={() => { localStorage.setItem('oracion.seen', '1'); setSeen(true); }} />;
  if (route.path === '/admin' && auth.user?.isAdmin) return <Admin />;
  return <Main />;
}

export default function App() {
  return (
    <AppProvider>
      <Root />
      <Toasts />
    </AppProvider>
  );
}
