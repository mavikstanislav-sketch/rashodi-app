const express = require('express');
const { requireAuth } = require('../middleware/auth');
const models = require('../models');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const user = await models.getUserById(req.session.userId);
  const yearMonth = req.query.month || currentYearMonth();

  const [summary, expenses, cards, categories, availableMonths] = await Promise.all([
    models.getMonthSummary(user.id, yearMonth, user.monthly_budget),
    models.getExpensesForMonth(user.id, yearMonth),
    models.getCardsByUser(user.id),
    models.getCategories(user.id),
    models.getAvailableMonths(user.id),
  ]);
  if (!availableMonths.includes(currentYearMonth())) availableMonths.unshift(currentYearMonth());

  res.render('dashboard', {
    user,
    summary,
    expenses,
    cards,
    categories,
    yearMonth,
    availableMonths: [...new Set(availableMonths)].sort().reverse(),
    isCurrentMonth: yearMonth === currentYearMonth(),
  });
}));

router.post('/expenses', requireAuth, asyncHandler(async (req, res) => {
  const { cardId, categoryId, amount, date, note } = req.body;
  const parsedAmount = parseFloat(amount);

  if (!cardId || !categoryId || !date || !parsedAmount || parsedAmount <= 0) {
    return res.redirect('/');
  }

  await models.addExpense(req.session.userId, {
    cardId: Number(cardId),
    categoryId: Number(categoryId),
    amount: parsedAmount,
    date,
    note: (note || '').trim(),
  });

  const yearMonth = date.slice(0, 7);
  res.redirect(`/?month=${yearMonth}`);
}));

router.get('/expenses/:id/edit', requireAuth, asyncHandler(async (req, res) => {
  const expense = await models.getExpenseById(req.session.userId, Number(req.params.id));
  if (!expense) return res.redirect('/');

  const [cards, categories] = await Promise.all([
    models.getCardsByUser(req.session.userId),
    models.getCategories(req.session.userId),
  ]);
  res.render('edit-expense', { expense, cards, categories });
}));

router.post('/expenses/:id', requireAuth, asyncHandler(async (req, res) => {
  const { cardId, categoryId, amount, date, note } = req.body;
  const parsedAmount = parseFloat(amount);
  const id = Number(req.params.id);

  if (!cardId || !categoryId || !date || !parsedAmount || parsedAmount <= 0) {
    return res.redirect(`/expenses/${id}/edit`);
  }

  await models.updateExpense(req.session.userId, id, {
    cardId: Number(cardId),
    categoryId: Number(categoryId),
    amount: parsedAmount,
    date,
    note: (note || '').trim(),
  });

  res.redirect(`/?month=${date.slice(0, 7)}`);
}));

router.post('/expenses/:id/delete', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const expense = await models.getExpenseById(req.session.userId, id);
  await models.deleteExpense(req.session.userId, id);

  const yearMonth = expense ? expense.expense_date.slice(0, 7) : currentYearMonth();
  res.redirect(`/?month=${yearMonth}`);
}));

router.post('/cards', requireAuth, asyncHandler(async (req, res) => {
  const { label, cardNumber } = req.body;
  const digits = String(cardNumber || '').replace(/\D/g, '');

  if (digits.length < 4) {
    return res.redirect('/');
  }

  await models.addCard(req.session.userId, (label || '').trim(), digits);
  res.redirect('/');
}));

router.post('/categories', requireAuth, asyncHandler(async (req, res) => {
  const { name, icon } = req.body;
  const trimmedName = (name || '').trim();

  if (!trimmedName) {
    return res.redirect('/');
  }

  await models.addCategory(req.session.userId, trimmedName, (icon || '').trim());
  res.redirect('/');
}));

router.post('/budget', requireAuth, asyncHandler(async (req, res) => {
  const amount = parseFloat(req.body.monthlyBudget);
  if (!isNaN(amount) && amount >= 0) {
    await models.updateBudget(req.session.userId, amount);
  }
  res.redirect('/');
}));

module.exports = router;
