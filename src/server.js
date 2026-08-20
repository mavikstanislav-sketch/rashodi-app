const path = require('node:path');
const express = require('express');
const session = require('express-session');
require('dotenv').config();

const db = require('./db');
const seedDemo = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET is not set. Set it in the hosting environment before going to production.');
  process.exit(1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

if (isProduction) {
  // Render/Railway/Fly etc. terminate TLS at a proxy in front of the app;
  // trust proxy so secure cookies and req.protocol reflect the real request.
  app.set('trust proxy', 1);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      secure: isProduction,
    },
  })
);

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Внутренняя ошибка сервера');
});

async function main() {
  await db.init();
  await seedDemo();

  app.listen(PORT, () => {
    console.log(`Rashodi app listening on http://localhost:${PORT}`);
    console.log('Демо-вход: demo@example.com / demo1234');
  });
}

main().catch((err) => {
  console.error('Не удалось запустить сервер:', err);
  process.exit(1);
});
