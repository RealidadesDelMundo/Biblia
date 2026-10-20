import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { useRoute } from './router.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [bootError, setBootError] = useState(null);
  const [auth, setAuth] = useState({ status: 'loading', user: null, usage: null });
  const [tab, setTab] = useState('hoy');
  const [prefill, setPrefill] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const route = useRoute();

  const toast = useCallback((message, kind = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const applySession = useCallback((d) => setAuth({ status: 'ready', user: d.user, usage: d.usage }), []);
  const setUsage = useCallback((usage) => setAuth((a) => (a.status === 'ready' ? { ...a, usage } : a)), []);

  const refresh = useCallback(async () => {
    try { const d = await api.get('/api/me'); applySession(d); return d; }
    catch (e) { if (e.status === 401) { setAuth({ status: 'anon', user: null, usage: null }); return null; } throw e; }
  }, [applySession]);

  useEffect(() => {
    (async () => {
      try { setConfig(await api.get('/api/config')); }
      catch (e) { setBootError(e.message); return; }
      try { await refresh(); } catch { setAuth({ status: 'anon', user: null, usage: null }); }
    })();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout'); } catch { /* da igual: se limpia en local */ }
    setAuth({ status: 'anon', user: null, usage: null });
    setTab('hoy');
  }, []);

  const go = useCallback((t, pre = null) => { setPrefill(pre); setTab(t); window.scrollTo?.(0, 0); }, []);

  const value = useMemo(() => ({
    config, bootError, auth, tab, prefill, toasts, premiumOpen, route,
    isPremium: auth.user?.plan === 'premium',
    toast, applySession, setUsage, refresh, logout, go, setTab, setPrefill, setPremiumOpen,
  }), [config, bootError, auth, tab, prefill, toasts, premiumOpen, route, toast, applySession, setUsage, refresh, logout, go]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
