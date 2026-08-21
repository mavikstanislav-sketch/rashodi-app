const path = require('node:path');
const express = require('express');
const session = require('express-session');
require('dotenv').config();

const db = require('./db');
const seedDemo = require('./db/seed');
const TursoSessionStore = require('./sessionStore');

const app = express();
const PORT = process.env.PORT || 3000;

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set. Set it in the hosting environment before going to production.');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

if (isProduction) {
  // Render/Vercel/Fly etc. terminate TLS at a proxy in front of the app;
  // trust proxy so secure cookies and req.protocol reflect the real request.
  app.set('trust proxy', 1);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// On serverless hosts (Vercel) each cold start re-runs this module, so schema
// creation/demo seeding must finish before anything touches the DB — including
// the session middleware below, which reads/writes the sessions table.
// Locally and on always-on hosts (Render) this resolves once at startup.
const initPromise = db.init().then(() => seedDemo());

app.use((req, res, next) => {
  initPromise.then(() => next(), next);
});

app.use(
  session({
    store: new TursoSessionStore(),
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Rashodi app listening on http://localhost:${PORT}`);
    console.log('Демо-вход: demo@example.com / demo1234');
  });
}

module.exports = app;
