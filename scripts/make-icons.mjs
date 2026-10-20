// Genera los iconos de la PWA a partir de un SVG (una vela encendida sobre fondo noche). Uso: npm run icons
import sharp from 'sharp';
import fs from 'node:fs';

const out = new URL('../client/public/icons/', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><radialGradient id="g" cx="50%" cy="38%" r="55%"><stop offset="0" stop-color="#e8a94d" stop-opacity=".55"/><stop offset="1" stop-color="#e8a94d" stop-opacity="0"/></radialGradient>
  <linearGradient id="w" x1="0" x2="1"><stop offset="0" stop-color="#d9cdb2"/><stop offset=".45" stop-color="#f7f0e0"/><stop offset="1" stop-color="#cfc2a4"/></linearGradient></defs>
  <rect width="512" height="512" fill="#0a0e1a"/><rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${pad}) translate(-256 -256)">
    <g transform="translate(164 56) scale(5.4)"><path d="M17 2 C25 16 27 25 19 34 C23 28 21 20 17 14 C13 20 11 28 15 34 C7 25 9 16 17 2 Z" fill="#ffd98a"/><path d="M17 12 C21 19 21.5 25 17 30 C19.5 26 18.5 21 17 18 C15.5 21 14.5 26 17 30 C12.5 25 13 19 17 12 Z" fill="#fff6e0"/></g>
    <rect x="248" y="226" width="16" height="30" rx="5" fill="#3a2d1d"/>
    <rect x="206" y="250" width="100" height="170" rx="12" fill="url(#w)"/><ellipse cx="256" cy="250" rx="50" ry="10" fill="#fbf6ea"/>
    <rect x="178" y="418" width="156" height="22" rx="11" fill="#6f5a37"/>
  </g></svg>`;
const jobs = [['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['maskable-512.png', 512, 0.74], ['apple-touch-icon.png', 180, 0.9], ['favicon-32.png', 32, 0.95]];
for (const [name, size, pad] of jobs) await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(out + name);
console.log('Iconos generados en', out);
