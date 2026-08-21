const path = require('node:path');
const fs = require('node:fs');
const { createClient } = require('@libsql/client');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

let db;
if (TURSO_URL) {
  // Cloud (Turso, libSQL-over-HTTP) — used in production so data survives
  // restarts/redeploys on hosts with no persistent local disk.
  db = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN });
} else {
  // Local file — used for development when no Turso credentials are set.
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  db = createClient({ url: `file:${path.join(DATA_DIR, 'rashodi.db')}` });
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    monthly_budget REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    last4 TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    amount REAL NOT NULL,
    expense_date TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date);

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`;

const FIXED_CATEGORIES = [
  { name: 'Заправка', icon: '⛽' },
  { name: 'Заведения', icon: '🍽️' },
  { name: 'Магазины продуктовые', icon: '🛒' },
];

async function ensureColumn(table, column, type) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`);
  if (!rows.some((r) => r.name === column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

async function init() {
  await db.execute('PRAGMA foreign_keys = ON;');
  await db.executeMultiple(SCHEMA);

  // Added after the initial release — ensureColumn is a no-op once these
  // already exist, so this stays safe to run on every cold start.
  await ensureColumn('categories', 'icon', 'TEXT');
  await ensureColumn('categories', 'user_id', 'INTEGER');

  for (const { name, icon } of FIXED_CATEGORIES) {
    await db.execute({ sql: 'INSERT OR IGNORE INTO categories (name, icon) VALUES (?, ?)', args: [name, icon] });
    // Backfill icons for categories created before this column existed.
    await db.execute({
      sql: 'UPDATE categories SET icon = ? WHERE name = ? AND icon IS NULL',
      args: [icon, name],
    });
  }
}

module.exports = db;
module.exports.init = init;
