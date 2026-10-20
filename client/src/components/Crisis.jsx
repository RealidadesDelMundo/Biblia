import { useState } from 'react';
import { Phone } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { telHref } from '../format.js';

function Line({ line, note, title }) {
  const href = telHref(line);
  const inner = (<><b>{line}</b><span>{title ? `${title}. ` : ''}{note}</span></>);
  return href ? <a className="help-line" href={href}>{inner}</a> : <div className="help-line">{inner}</div>;
}

function CountryPicker({ helpline, onHelpline }) {
  const { config, toast } = useApp();
  const [open, setOpen] = useState(false);
  async function pick(code) {
    try {
      await api.patch('/api/me', { countryOverride: code });
      const r = await api.get('/api/helpline');
      onHelpline(r.helpline);
      setOpen(false);
    } catch (e) { toast(e.message, 'err'); }
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <p className="tiny muted">
        {helpline?.name ? `Teléfonos de ${helpline.name}.` : 'No hemos podido saber en qué país estás.'}{' '}
        <button className="btn quiet sm" style={{ minHeight: 28, padding: '0 4px' }} onClick={() => setOpen((o) => !o)}>
          {helpline?.name ? '¿No es tu país?' : 'Elegir país'}
        </button>
      </p>
      {open && (
        <div className="field">
          <label htmlFor="country-pick" className="sr-only">País</label>
          <select id="country-pick" defaultValue="" onChange={(e) => e.target.value && pick(e.target.value)}>
            <option value="" disabled>Elige tu país</option>
            {(config?.countries || []).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            <option value="OTHER">Otro país</option>
          </select>
        </div>
      )}
    </div>
  );
}

/** Pantalla de ayuda cuando se detecta riesgo alto. Sustituye a la oración: no se guarda nada. */
export function CrisisCard({ data, onHelpline, children }) {
  const hl = data.helpline;
  return (
    <section className="card danger stack" role="alert" aria-live="assertive">
      <div className="prayer" style={{ fontSize: '1.3rem' }}>
        {data.messages.map((m, i) => <p key={i}>{m}</p>)}
      </div>
      <div className="stack" style={{ gap: 10 }}>
        {hl?.line
          ? <Line line={hl.line} note={hl.note} title={hl.name} />
          : <div className="help-line"><b><Phone size={16} style={{ verticalAlign: '-2px' }} /> Línea de ayuda de tu país</b><span>Busca la línea de prevención del suicidio de tu país; suele ser gratuita y atender las 24 horas.</span></div>}
        {hl?.emergency
          ? <Line line={hl.emergency} note="Si hay peligro inmediato, llama ahora." title="Emergencias" />
          : <div className="help-line"><b>Emergencias</b><span>Si hay peligro inmediato, llama al número de emergencias de tu país.</span></div>}
      </div>
      <CountryPicker helpline={hl} onHelpline={onHelpline} />
      <p className="small muted">Esta aplicación no puede darte la ayuda que necesitas ahora, pero estas personas sí. Lo que has escrito no se ha guardado.</p>
      {children}
    </section>
  );
}

/** Aviso discreto bajo una oración cuando el riesgo es moderado. */
export function HelpFooter({ helpline, onHelpline }) {
  const href = telHref(helpline?.line);
  return (
    <div className="notice stack" style={{ gap: 8, marginTop: 18 }}>
      <p>Si lo que sientes te está pesando mucho, no tienes que llevarlo solo. Hablar con alguien de confianza o con un profesional puede ayudarte.</p>
      {helpline?.line
        ? <p>{helpline.name}: {href ? <a href={href}>{helpline.line}</a> : helpline.line}. {helpline.note}</p>
        : <p>Si necesitas ayuda ahora, llama al número de emergencias o a la línea de ayuda de tu país.</p>}
      <CountryPicker helpline={helpline} onHelpline={onHelpline} />
    </div>
  );
}
