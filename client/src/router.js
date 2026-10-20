import { useCallback, useEffect, useState } from 'react';
// Enrutado mínimo (sin librería): solo hay unas pocas rutas públicas (/privacidad, /terminos, /restablecer).
export function useRoute() {
  const read = () => ({ path: window.location.pathname.replace(/\/$/, '') || '/', search: window.location.search });
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const f = () => setLoc(read());
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, []);
  const navigate = useCallback((to, { replace = false } = {}) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', to);
    setLoc(read());
    window.scrollTo?.(0, 0);
  }, []);
  return { ...loc, navigate };
}
