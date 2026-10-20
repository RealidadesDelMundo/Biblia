// Arranca la API real (SQLite en memoria, IA y pagos en modo demostración) para las pruebas de interfaz.
import { startApp } from './helpers.mjs';
const app = await startApp();
console.log(`BASE=${app.base}`);
process.on('SIGTERM', async () => { await app.close(); process.exit(0); });
