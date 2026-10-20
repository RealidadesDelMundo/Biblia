import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { money, plural } from '../format.js';
import { CrisisCard, HelpFooter } from '../components/Crisis.jsx';

const IDEAS = ['Estoy pasando un mal momento', 'Tengo una decisión difícil', 'Quiero dar gracias por algo'];

export default function Companion() {
  const { config, toast, applySession, setPremiumOpen, isPremium } = useApp();
  const [items, setItems] = useState(null); // {role:'user'|'assistant'|'crisis', content?, data?}
  const [chat, setChat] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const paymentsOn = config?.paymentsMode !== 'off';
  const endRef = useRef(null);

  useEffect(() => {
    api.get('/api/companion').then((d) => { setItems(d.messages.map((m) => ({ role: m.role, content: m.content }))); setChat(d.usage); }).catch((e) => toast(e.message, 'err'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [items, busy]);

  const syncUsage = (c) => setChat(c);

  async function send(e) {
    e?.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true); setText('');
    setItems((it) => [...it, { role: 'user', content: message }]);
    try {
      const r = await api.post('/api/companion', { message });
      if (r.risk === 'high') setItems((it) => [...it, { role: 'crisis', data: r }]);
      else setItems((it) => [...it, { role: 'assistant', content: r.reply, helpline: r.risk === 'moderate' ? r.helpline : null }]);
      syncUsage(r.usage);
    } catch (err) {
      setItems((it) => it.slice(0, -1)); setText(message);
      if (err.code === 'LIMIT_CHAT') { setChat(err.data.usage); } else toast(err.message, 'err');
    } finally { setBusy(false); }
  }

  async function buyCredits() {
    try {
      const r = await api.post('/api/billing/credits');
      if (r.checkoutUrl) { window.location.assign(r.checkoutUrl); return; }
      if (r.demo) { applySession(r); setChat(r.usage.chat); toast('Créditos añadidos (modo de pruebas).'); }
    } catch (e) { toast(e.message, 'err'); }
  }

  async function clear() {
    try { await api.del('/api/companion'); setItems([]); toast('Conversación borrada.'); } catch (e) { toast(e.message, 'err'); }
  }

  const available = chat?.available ?? 0;
  const pack = config?.prices.creditPack;
  return (
    <main className="shell stack-lg">
      <header>
        <h1 className="screen-title">Acompañante</h1>
        <p className="screen-lead">Una IA con la que ordenar lo que sientes y orar. No es Dios, ni un pastor, ni un terapeuta.</p>
      </header>

      {items && items.length === 0 && (
        <div className="stack">
          <p className="muted">Escribe lo que quieras compartir. Algunas ideas para empezar:</p>
          <div className="chips">{IDEAS.map((i) => <button key={i} className="chip" onClick={() => setText(i)}>{i}</button>)}</div>
        </div>
      )}

      <div className="chat" aria-live="polite">
        {(items || []).map((m, i) => m.role === 'crisis'
          ? <CrisisCard key={i} data={m.data} onHelpline={(h) => setItems((it) => it.map((x, k) => (k === i ? { ...x, data: { ...x.data, helpline: h } } : x)))} />
          : (
            <div key={i} className={`bubble ${m.role === 'user' ? 'me' : 'ai'}`}>
              {m.content}
              {m.helpline && <HelpFooter helpline={m.helpline} onHelpline={() => {}} />}
            </div>
          ))}
        {busy && <p className="typing">Escribiendo…</p>}
        <div ref={endRef} />
      </div>

      <div className="composer">
        {available > 0 ? (
          <form className="row" onSubmit={send}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="msg" className="sr-only">Tu mensaje</label>
              <textarea id="msg" value={text} rows={1} maxLength={1500} onChange={(e) => setText(e.target.value)} placeholder="Escribe aquí…"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia?.('(pointer: fine)').matches) send(e); }} />
            </div>
            <button className="btn primary" disabled={busy || !text.trim()} aria-label="Enviar"><Send size={18} /></button>
          </form>
        ) : (
          <div className="card stack">
            <p>Has usado tus mensajes de este mes con el acompañante.{!paymentsOn && ' Se renuevan el día 1.'}</p>
            {paymentsOn && <button className="btn primary" onClick={buyCredits}>Comprar {pack?.credits} mensajes · {pack && money(pack.cents)}</button>}
            {paymentsOn && !isPremium && <button className="btn" onClick={() => setPremiumOpen(true)}>Ver Premium ({config?.limits.premium.chat} al mes)</button>}
          </div>
        )}
        <div className="spread" style={{ marginTop: 6 }}>
          <span className="tiny muted">{chat ? `${plural(available, 'mensaje disponible', 'mensajes disponibles')}${chat.credits ? ` (${chat.credits} de crédito)` : ''}` : ''}</span>
          {items?.length > 0 && <button className="btn quiet sm" onClick={clear}>Borrar conversación</button>}
        </div>
        <p className="tiny muted">Las respuestas las genera una IA y pueden contener errores. No sustituye ayuda profesional.</p>
      </div>
    </main>
  );
}
