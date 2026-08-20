const express = require('express');
const bcrypt = require('bcryptjs');
const models = require('../models');
const { redirectIfAuthed } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/login', redirectIfAuthed, (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', redirectIfAuthed, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await models.getUserByEmail((email || '').trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).render('login', { error: 'Неверный email или пароль' });
  }

  req.session.userId = user.id;
  res.redirect('/');
}));

router.get('/register', redirectIfAuthed, (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', redirectIfAuthed, asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!normalizedEmail || !password || password.length < 6) {
    return res.status(400).render('register', { error: 'Проверьте email и пароль (минимум 6 символов)' });
  }

  const existing = await models.getUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(400).render('register', { error: 'Пользователь с таким email уже существует' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const userId = await models.createUser(
    normalizedEmail,
    passwordHash,
    (name || normalizedEmail.split('@')[0]).trim(),
    0
  );

  req.session.userId = userId;
  res.redirect('/');
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
