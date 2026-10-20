// Base de datos: PostgreSQL en producción (DATABASE_URL), SQLite en local.
// Todas las fechas se guardan como milisegundos epoch (entero) para que se comporten igual en ambas.
import knexLib from 'knex';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10))); // int8 -> number

export async function createDb(config) {
  let db;
  if (config.databaseUrl) {
    const host = (() => { try { return new URL(config.databaseUrl).hostname; } catch { return ''; } })();
    const local = ['localhost', '127.0.0.1'].includes(host) || host.endsWith('.railway.internal');
    const ssl = config.pgSsl === 'true' ? { rejectUnauthorized: false } : config.pgSsl === 'false' ? false : local ? false : { rejectUnauthorized: false };
    db = knexLib({ client: 'pg', connection: { connectionString: config.databaseUrl, ssl }, pool: { min: 0, max: 10 } });
  } else {
    if (config.isProd) {
      console.warn('[db] AVISO: sin DATABASE_URL en producción. SQLite en disco efímero perderá los datos en cada despliegue. Añade PostgreSQL.');
    }
    const file = config.sqlitePath;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    let client = 'better-sqlite3';
    try { await import('better-sqlite3'); } catch { throw new Error('Falta better-sqlite3 (dependencia opcional para desarrollo local: necesita Python y un compilador de C++; ver README) o define DATABASE_URL para usar PostgreSQL.'); }
    db = knexLib({ client, connection: { filename: file }, useNullAsDefault: true, pool: file === ':memory:' ? { min: 1, max: 1 } : undefined });
    if (file !== ':memory:') await db.raw('PRAGMA journal_mode = WAL');
    await db.raw('PRAGMA foreign_keys = ON');
  }
  await migrate(db);
  return db;
}

async function ensure(db, name, build) {
  if (!(await db.schema.hasTable(name))) await db.schema.createTable(name, build);
}

export async function migrate(db) {
  await ensure(db, 'users', (t) => {
    t.increments('id');
    t.string('email').notNullable().unique();
    t.string('password_hash').notNullable();
    t.integer('token_version').notNullable().defaultTo(0);
    t.bigInteger('created_at').notNullable();
    t.bigInteger('consent_at').notNullable();
    t.string('consent_version').notNullable();
    t.string('plan').notNullable().defaultTo('free'); // 'free' | 'premium'
    t.string('plan_status'); // estado de Stripe: active, trialing, past_due, canceled...
    t.string('plan_interval'); // 'month' | 'year'
    t.bigInteger('plan_expires_at'); // fin del periodo pagado
    t.boolean('cancel_at_period_end').notNullable().defaultTo(false);
    t.string('stripe_customer_id');
    t.string('stripe_subscription_id');
    t.integer('credits').notNullable().defaultTo(0); // créditos extra del acompañante
    t.string('country_override');
    t.bigInteger('last_login_at');
  });
  await ensure(db, 'entries', (t) => {
    t.increments('id');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('original').notNullable();
    t.text('prayer').notNullable();
    t.string('theme').notNullable();
    t.string('verse_ref').notNullable();
    t.text('verse_text').notNullable();
    t.boolean('moderate_risk').notNullable().defaultTo(false);
    t.boolean('counted').notNullable().defaultTo(true); // false si la IA falló y se dio una oración de respaldo
    t.bigInteger('created_at').notNullable();
    t.index(['user_id', 'created_at']);
  });
  await ensure(db, 'candles', (t) => {
    t.increments('id');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('name').notNullable();
    t.string('intention').notNullable();
    t.string('size').notNullable();
    t.string('verse_ref');
    t.text('verse_text');
    t.bigInteger('created_at').notNullable();
    t.bigInteger('expires_at').notNullable();
    t.index(['user_id', 'expires_at']);
  });
  await ensure(db, 'orders', (t) => {
    t.increments('id');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('kind').notNullable(); // 'candle' | 'credits'
    t.text('payload').notNullable(); // JSON
    t.string('stripe_session_id').unique();
    t.string('status').notNullable().defaultTo('pending'); // pending | paid
    t.bigInteger('created_at').notNullable();
    t.bigInteger('paid_at');
  });
  await ensure(db, 'chat_messages', (t) => {
    t.increments('id');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('role').notNullable(); // 'user' | 'assistant'
    t.text('content').notNullable();
    t.bigInteger('created_at').notNullable();
    t.index(['user_id', 'created_at']);
  });
  await ensure(db, 'password_resets', (t) => {
    t.increments('id');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token_hash').notNullable().unique();
    t.bigInteger('expires_at').notNullable();
    t.bigInteger('used_at');
  });
  await ensure(db, 'stripe_events', (t) => {
    t.string('id').primary();
    t.bigInteger('created_at').notNullable();
  });
}
