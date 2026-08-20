const bcrypt = require('bcryptjs');
const models = require('../models');

async function seedDemo() {
  const existing = await models.getUserByEmail('demo@example.com');
  if (existing) return;

  const passwordHash = bcrypt.hashSync('demo1234', 10);
  const userId = await models.createUser('demo@example.com', passwordHash, 'Демо Пользователь', 50000);

  const cardId = await models.addCard(userId, 'Основная карта', '4521');
  const cardId2 = await models.addCard(userId, 'Зарплатная карта', '7788');

  const categories = await models.getCategories();
  const catId = (name) => categories.find((c) => c.name === name).id;

  function dateStr(y, m, d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const today = now.getDate();

  const currentMonthDemo = [
    [catId('Заправка'), 1800, 3, 'WOG', cardId],
    [catId('Заправка'), 2200, 12, 'ОККО', cardId],
    [catId('Заведения'), 950, 4, 'Кав\'ярня', cardId2],
    [catId('Заведения'), 3200, 9, 'Ресторан', cardId],
    [catId('Заведения'), 1100, 15, 'Бар', cardId2],
    [catId('Магазины продуктовые'), 4500, 2, 'АТБ', cardId],
    [catId('Магазины продуктовые'), 3800, 8, 'Сільпо', cardId],
    [catId('Магазины продуктовые'), 5200, 14, 'Novus', cardId2],
  ];

  for (const [categoryId, amount, day, note, cId] of currentMonthDemo) {
    if (day <= today) {
      await models.addExpense(userId, { cardId: cId, categoryId, amount, date: dateStr(y, m, day), note });
    }
  }

  let prevY = y;
  let prevM = m - 1;
  if (prevM === 0) {
    prevM = 12;
    prevY -= 1;
  }
  const prevMonthDemo = [
    [catId('Заправка'), 4100, 5, 'WOG', cardId],
    [catId('Заведения'), 6300, 11, 'Ресторан', cardId2],
    [catId('Магазины продуктовые'), 12400, 20, 'АТБ', cardId],
  ];
  for (const [categoryId, amount, day, note, cId] of prevMonthDemo) {
    await models.addExpense(userId, { cardId: cId, categoryId, amount, date: dateStr(prevY, prevM, day), note });
  }

  console.log('Демо-данные созданы: demo@example.com / demo1234');
}

module.exports = seedDemo;
