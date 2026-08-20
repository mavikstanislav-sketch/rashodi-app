const db = require('./db');

const CATEGORY_COLORS = {
  'Заправка': '#f59e0b',
  'Заведения': '#ec4899',
  'Магазины продуктовые': '#22c55e',
};

async function getUserById(id) {
  const { rows } = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return rows[0] || null;
}

async function getUserByEmail(email) {
  const { rows } = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  return rows[0] || null;
}

async function createUser(email, passwordHash, name, monthlyBudget = 0) {
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO users (email, password_hash, name, monthly_budget) VALUES (?, ?, ?, ?)',
    args: [email, passwordHash, name, monthlyBudget],
  });
  return Number(lastInsertRowid);
}

async function getCategories() {
  const { rows } = await db.execute('SELECT id, name FROM categories ORDER BY id');
  return rows;
}

async function getCardsByUser(userId) {
  const { rows } = await db.execute({
    sql: 'SELECT id, label, last4 FROM cards WHERE user_id = ? ORDER BY id',
    args: [userId],
  });
  return rows;
}

async function addCard(userId, label, cardNumber) {
  const digits = String(cardNumber).replace(/\D/g, '');
  const last4 = digits.slice(-4);
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO cards (user_id, label, last4) VALUES (?, ?, ?)',
    args: [userId, label || 'Карта', last4],
  });
  return Number(lastInsertRowid);
}

async function addExpense(userId, { cardId, categoryId, amount, date, note }) {
  const { lastInsertRowid } = await db.execute({
    sql: 'INSERT INTO expenses (user_id, card_id, category_id, amount, expense_date, note) VALUES (?, ?, ?, ?, ?, ?)',
    args: [userId, cardId, categoryId, amount, date, note || null],
  });
  return Number(lastInsertRowid);
}

function monthBounds(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = `${yearMonth}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

async function getMonthSummary(userId, yearMonth, monthlyBudget) {
  const { start, end } = monthBounds(yearMonth);

  const totalResult = await db.execute({
    sql: 'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ?',
    args: [userId, start, end],
  });
  const total = totalResult.rows[0].total;

  const byCategoryResult = await db.execute({
    sql: `SELECT c.id, c.name, COALESCE(SUM(e.amount), 0) as spent
          FROM categories c
          LEFT JOIN expenses e ON e.category_id = c.id AND e.user_id = ? AND e.expense_date BETWEEN ? AND ?
          GROUP BY c.id, c.name
          ORDER BY c.id`,
    args: [userId, start, end],
  });
  const byCategory = byCategoryResult.rows.map((row) => ({
    ...row,
    color: CATEGORY_COLORS[row.name] || '#94a3b8',
  }));

  const remaining = monthlyBudget - total;
  const percentUsed = monthlyBudget > 0 ? Math.min(100, Math.round((total / monthlyBudget) * 100)) : 0;

  return { total, byCategory, remaining, percentUsed, monthlyBudget };
}

async function getExpensesForMonth(userId, yearMonth) {
  const { start, end } = monthBounds(yearMonth);
  const { rows } = await db.execute({
    sql: `SELECT e.id, e.amount, e.expense_date, e.note, c.name as category_name,
                 cd.label as card_label, cd.last4 as card_last4
          FROM expenses e
          JOIN categories c ON c.id = e.category_id
          JOIN cards cd ON cd.id = e.card_id
          WHERE e.user_id = ? AND e.expense_date BETWEEN ? AND ?
          ORDER BY e.expense_date DESC, e.id DESC`,
    args: [userId, start, end],
  });
  return rows;
}

async function getExpenseById(userId, id) {
  const { rows } = await db.execute({
    sql: 'SELECT * FROM expenses WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  return rows[0] || null;
}

async function updateExpense(userId, id, { cardId, categoryId, amount, date, note }) {
  const { rowsAffected } = await db.execute({
    sql: `UPDATE expenses SET card_id = ?, category_id = ?, amount = ?, expense_date = ?, note = ?
          WHERE id = ? AND user_id = ?`,
    args: [cardId, categoryId, amount, date, note || null, id, userId],
  });
  return rowsAffected > 0;
}

async function deleteExpense(userId, id) {
  const { rowsAffected } = await db.execute({
    sql: 'DELETE FROM expenses WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  return rowsAffected > 0;
}

async function getAvailableMonths(userId) {
  const { rows } = await db.execute({
    sql: `SELECT DISTINCT substr(expense_date, 1, 7) as ym
          FROM expenses WHERE user_id = ? ORDER BY ym DESC`,
    args: [userId],
  });
  return rows.map((r) => r.ym);
}

async function updateBudget(userId, amount) {
  await db.execute({ sql: 'UPDATE users SET monthly_budget = ? WHERE id = ?', args: [amount, userId] });
}

module.exports = {
  CATEGORY_COLORS,
  getUserById,
  getUserByEmail,
  createUser,
  getCategories,
  getCardsByUser,
  addCard,
  addExpense,
  getMonthSummary,
  getExpensesForMonth,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getAvailableMonths,
  updateBudget,
};
