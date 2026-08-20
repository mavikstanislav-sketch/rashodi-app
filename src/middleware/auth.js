function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

function redirectIfAuthed(req, res, next) {
  if (req.session.userId) {
    return res.redirect('/');
  }
  next();
}

module.exports = { requireAuth, redirectIfAuthed };
