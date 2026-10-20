import { useId } from 'react';

const BODY = { pequena: { w: 10, h: 16 }, mediana: { w: 14, h: 30 }, grande: { w: 18, h: 50 } };

/** Vela encendida. La llama es siempre igual; lo que cambia con el tamaño es la cera (y el tiempo que arde). */
export default function Candle({ size = 'pequena', scale = 2, label }) {
  const uid = useId().replace(/:/g, '');
  const b = BODY[size] || BODY.pequena;
  const H = 34 + b.h + 4;
  const x = 20 - b.w / 2;
  return (
    <svg className="candle" width={40 * scale} height={H * scale} viewBox={`0 0 40 ${H}`} role="img" aria-label={label || `Vela ${size}`}>
      <defs>
        <filter id={`b${uid}`} x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="6" /></filter>
        <linearGradient id={`w${uid}`} x1="0" x2="1"><stop offset="0" stopColor="#d9cdb2" /><stop offset="0.45" stopColor="#f7f0e0" /><stop offset="1" stopColor="#cfc2a4" /></linearGradient>
      </defs>
      <circle className="glow" cx="20" cy="18" r="21" fill="#e8a94d" opacity="0.55" filter={`url(#b${uid})`} />
      <g className="flame" transform="translate(3,0)">
        <path d="M17 2 C25 16 27 25 19 34 C23 28 21 20 17 14 C13 20 11 28 15 34 C7 25 9 16 17 2 Z" fill="#ffd98a" />
        <path d="M17 12 C21 19 21.5 25 17 30 C19.5 26 18.5 21 17 18 C15.5 21 14.5 26 17 30 C12.5 25 13 19 17 12 Z" fill="#fff6e0" />
      </g>
      <rect x="19.4" y="30" width="1.2" height="5" rx="0.6" fill="#3a2d1d" />
      <rect x={x} y="34" width={b.w} height={b.h} rx="1.6" fill={`url(#w${uid})`} />
      <ellipse cx="20" cy="34" rx={b.w / 2} ry="1.7" fill="#fbf6ea" />
      <rect x={x - 3} y={34 + b.h} width={b.w + 6} height="3" rx="1.5" fill="#6f5a37" />
    </svg>
  );
}
