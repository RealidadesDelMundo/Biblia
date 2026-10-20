import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/** Hoja inferior accesible basada en <dialog> (foco atrapado y cierre con Esc incluidos). */
export default function Sheet({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    if (!open && d.open) { if (d.close) d.close(); else d.removeAttribute('open'); }
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <div className="stack">
          <div className="spread">
            <h2 className="screen-title" style={{ fontSize: '1.6rem' }}>{title}</h2>
            <button className="btn quiet" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
