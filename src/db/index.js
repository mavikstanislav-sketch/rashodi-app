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
`;

const FIXED_CATEGORIES = ['Заправка', 'Заведения', 'Магазины продуктовые'];

async function init() {
  await db.execute('PRAGMA foreign_keys = ON;');
  await db.executeMultiple(SCHEMA);
  for (const name of FIXED_CATEGORIES) {
    await db.execute({ sql: 'INSERT OR IGNORE INTO categories (name) VALUES (?)', args: [name] });
  }
}

module.exports = db;
module.exports.init = init;
