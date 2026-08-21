const session = require('express-session');
const db = require('./db');

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7;

// express-session's default MemoryStore only lives inside one process. On
// serverless hosts (Vercel) each request can land on a different instance
// with its own empty memory, so logins would appear to work once and then
// randomly disappear. Storing sessions in Turso instead means every instance
// shares the same session data, just like it already shares the app's data.
class TursoSessionStore extends session.Store {
  async get(sid, callback) {
    try {
      const { rows } = await db.execute({
        sql: 'SELECT data, expires_at FROM sessions WHERE sid = ?',
        args: [sid],
      });
      const row = rows[0];
      if (!row || Number(row.expires_at) < Date.now()) {
        return callback(null, null);
      }
      callback(null, JSON.parse(row.data));
    } catch (err) {
      callback(err);
    }
  }

  async set(sid, sessionData, callback) {
    try {
      const expiresAt = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires).getTime()
        : Date.now() + DEFAULT_TTL_MS;

      await db.execute({
        sql: `INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
              ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`,
        args: [sid, JSON.stringify(sessionData), expiresAt],
      });
      callback && callback(null);
    } catch (err) {
      callback && callback(err);
    }
  }

  async destroy(sid, callback) {
    try {
      await db.execute({ sql: 'DELETE FROM sessions WHERE sid = ?', args: [sid] });
      callback && callback(null);
    } catch (err) {
      callback && callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    return this.set(sid, sessionData, callback);
  }
}

module.exports = TursoSessionStore;
