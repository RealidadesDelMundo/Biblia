import { useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { money } from '../format.js';
import Sheet from './Sheet.jsx';

export default function PremiumSheet() {
  const { config, premiumOpen, setPremiumOpen, toast, applySession } = useApp();
  const [interval, setInterval] = useState('year');
  const [busy, setBusy] = useState(false);
  if (!config) return null;
  const { monthly, yearly } = config.prices;
  const off = config.paymentsMode === 'off';
  const saving = Math.round((1 - yearly / (monthly * 12)) * 100);

  async function start() {
    setBusy(true);
    try {
      const r = await api.post('/api/billing/checkout', { interval });
      if (r.checkoutUrl) { window.location.assign(r.checkoutUrl); return; }
      if (r.demo) { applySession(r); setPremiumOpen(false); toast('Premium activado (modo de pruebas, sin cobro).'); }
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  }

  return (
    <Sheet open={premiumOpen} onClose={() => setPremiumOpen(false)} title="Premium">
      <ul className="ticks">
        <li><Check /> Oraciones sin límite</li>
        <li><Check /> Todo tu diario, sin ocultar nada</li>
        <li><Check /> Un versículo del día elegido según lo que has orado esta semana</li>
        <li><Check /> Cada vela con un versículo relacionado y hasta {config.limits.premium.smallCandles} velas pequeñas al mes</li>
        <li><Check /> {config.limits.premium.chat} mensajes al mes con el acompañante</li>
      </ul>
      {off ? (
        <>
          <p className="notice warn">Premium estará disponible pronto. De momento puedes usar el plan gratuito.</p>
          <button className="btn block" onClick={() => setPremiumOpen(false)}>Entendido</button>
        </>
      ) : (
        <>
      <div className="plan-toggle" role="radiogroup" aria-label="Periodo de pago">
        <button className="plan-opt" role="radio" aria-checked={interval === 'year'} onClick={() => setInterval('year')}>
          <b>{money(yearly)}</b><span>al año · ahorras un {saving} %</span>
        </button>
        <button className="plan-opt" role="radio" aria-checked={interval === 'month'} onClick={() => setInterval('month')}>
          <b>{money(monthly)}</b><span>al mes</span>
        </button>
      </div>
      <button className="btn primary block" onClick={start} disabled={busy}>{busy ? 'Un momento…' : 'Continuar'}</button>
      <p className="tiny muted">
        Se renueva solo hasta que lo canceles (desde Cuenta, cuando quieras). El servicio empieza de inmediato, por lo que pierdes el derecho de desistimiento de 14 días una vez comenzado.
        {config.paymentsMode === 'demo' && ' Modo de pruebas: no se cobra nada.'}
      </p>
        </>
      )}
    </Sheet>
  );
}
