import { useState } from 'react';
import Candle from '../components/Candle.jsx';
import { APP_NAME } from '../brand.js';

const SLIDES = [
  { title: 'Un rato de calma para orar', body: 'Cuéntanos lo que llevas en el corazón. Recibirás una oración pensada para ti y un versículo de la Biblia que la acompaña.' },
  { title: 'La Palabra, sin inventos', body: 'Los versículos son texto bíblico real (Reina-Valera 1909), nunca generado por una IA. Las oraciones sí las escribe una IA, y siempre te lo decimos.' },
  { title: 'Aquí cuidamos de ti', body: 'No somos Dios, ni un pastor, ni un terapeuta. Si lo que escribes suena a que estás en peligro, te mostraremos ayuda real en tu país.' },
];

export default function Onboarding({ onDone }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <main className="shell bare onboard">
      <div className="hero" style={{ paddingTop: '8vh' }}><Candle size="grande" scale={2.4} label={APP_NAME} /></div>
      <div className="stack center" style={{ flex: 1, justifyContent: 'center' }}>
        <h1 className="screen-title">{s.title}</h1>
        <p className="muted" style={{ fontSize: '1.0625rem' }}>{s.body}</p>
      </div>
      <div className="stack">
        <div className="dots" aria-hidden="true">{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <button className="btn primary block" onClick={() => (last ? onDone() : setI(i + 1))}>{last ? 'Empezar' : 'Siguiente'}</button>
        {!last && <button className="btn quiet block" onClick={onDone}>Saltar</button>}
      </div>
    </main>
  );
}
