import { spawn } from 'node:child_process';
import path from 'node:path';

let child;
export async function setup() {
  child = spawn('node', [path.resolve(import.meta.dirname, '../../tests/ui-server.mjs')], { stdio: ['ignore', 'pipe', 'inherit'] });
  const base = await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => { const m = String(d).match(/BASE=(\S+)/); if (m) resolve(m[1]); });
    child.on('exit', (c) => reject(new Error('El servidor de pruebas terminó con código ' + c)));
    setTimeout(() => reject(new Error('El servidor de pruebas no arrancó')), 15000);
  });
  process.env.TEST_BASE = base;
}
export async function teardown() { child?.kill('SIGTERM'); }
