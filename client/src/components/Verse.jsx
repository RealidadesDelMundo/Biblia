import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useApp } from '../store.jsx';
import { APP_NAME } from '../brand.js';

export async function shareText(text, toast) {
  try {
    if (navigator.share) { await navigator.share({ text, url: window.location.origin }); return; }
    await navigator.clipboard.writeText(`${text}\n${window.location.origin}`);
    toast('Copiado. Ya puedes pegarlo donde quieras.');
  } catch { /* el usuario canceló */ }
}

/** Texto bíblico (siempre de la base curada) con su referencia y, opcionalmente, la paráfrasis en lenguaje actual. */
export default function Verse({ verse, small = false, share = false, note, openGist = false }) {
  const { toast } = useApp();
  const [gist, setGist] = useState(openGist);
  return (
    <figure style={{ margin: 0 }}>
      <blockquote className={`scripture ${small ? 'small-s' : ''}`} style={{ margin: 0 }}>«{verse.text}»</blockquote>
      <figcaption className="verse-ref" style={{ marginTop: 10 }}>{verse.ref}</figcaption>
      {note && <p className="tiny muted" style={{ marginTop: 8 }}>{note}</p>}
      {verse.gist && (
        <div style={{ marginTop: 8 }}>
          <button className="btn quiet sm" style={{ paddingLeft: 0 }} onClick={() => setGist((g) => !g)} aria-expanded={gist}>
            {gist ? 'Ocultar lenguaje actual' : 'Ver en lenguaje actual'}
          </button>
          {gist && <p className="gist">{verse.gist}<br /><span className="tiny">Paráfrasis para entenderlo mejor; no es texto bíblico.</span></p>}
        </div>
      )}
      {share && (
        <button className="btn quiet sm" style={{ paddingLeft: 0 }} onClick={() => shareText(`«${verse.text}» (${verse.ref}) — ${APP_NAME}`, toast)}>
          <Share2 size={16} /> Compartir
        </button>
      )}
    </figure>
  );
}
