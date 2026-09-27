import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT) || 3001;
const COOKIE = 'session';
const MAX_BODY = 10_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const dbPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'game.db');
const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    result TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const q = {
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  insertUser: db.prepare('INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)'),
  insertSession: db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  sessionUser: db.prepare(
    `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.created_at > ?`,
  ),
  insertScore: db.prepare('INSERT INTO scores (user_id, score, result) VALUES (?, ?, ?)'),
  stats: db.prepare(
    'SELECT COALESCE(MAX(score), 0) AS best, COUNT(*) AS played FROM scores WHERE user_id = ?',
  ),
  recent: db.prepare(
    'SELECT score, result, created_at FROM scores WHERE user_id = ? ORDER BY id DESC LIMIT 10',
  ),
};

const hashPassword = (password, salt) =>
  crypto.scryptSync(password, salt, 64).toString('hex');

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function getToken(req) {
  const match = (req.headers.cookie || '').match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

function currentUser(req) {
  const token = getToken(req);
  if (!token) return null;
  return q.sessionUser.get(token, Date.now() - SESSION_TTL_MS) ?? null;
}

function startSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  q.insertSession.run(token, userId, Date.now());
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

const clearCookie = `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;

function credentials(body) {
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  return { username, password };
}

const routes = {
  'POST /api/signup': async (req, res) => {
    const { username, password } = credentials(await readJson(req));
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return send(res, 400, { error: 'Username must be 3-20 letters, numbers or underscores' });
    }
    if (password.length < 6 || password.length > 100) {
      return send(res, 400, { error: 'Password must be at least 6 characters' });
    }
    if (q.userByName.get(username)) {
      return send(res, 409, { error: 'Username is already taken' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const { lastInsertRowid } = q.insertUser.run(username, hashPassword(password, salt), salt);
    send(res, 200, { user: { id: Number(lastInsertRowid), username } }, {
      'Set-Cookie': startSession(lastInsertRowid),
    });
  },

  'POST /api/login': async (req, res) => {
    const { username, password } = credentials(await readJson(req));
    const row = q.userByName.get(username);
    const ok =
      row &&
      crypto.timingSafeEqual(
        Buffer.from(hashPassword(password, row.salt), 'hex'),
        Buffer.from(row.password_hash, 'hex'),
      );
    if (!ok) return send(res, 401, { error: 'Invalid username or password' });
    send(res, 200, { user: { id: row.id, username: row.username } }, {
      'Set-Cookie': startSession(row.id),
    });
  },

  'POST /api/logout': async (req, res) => {
    const token = getToken(req);
    if (token) q.deleteSession.run(token);
    send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie });
  },

  'GET /api/me': async (req, res) => {
    send(res, 200, { user: currentUser(req) });
  },

  'POST /api/scores': async (req, res) => {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: 'Not signed in' });
    const { score } = await readJson(req);
    if (!Number.isInteger(score) || Math.abs(score) > 1000) {
      return send(res, 400, { error: 'Invalid score' });
    }
    const result = score > 0 ? 'win' : score < 0 ? 'loss' : 'tie';
    q.insertScore.run(user.id, score, result);
    send(res, 200, { ok: true });
  },

  'GET /api/scores': async (req, res) => {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { ...q.stats.get(user.id), recent: q.recent.all(user.id) });
  },
};

const server = http.createServer(async (req, res) => {
  const handler = routes[`${req.method} ${req.url.split('?')[0]}`];
  if (!handler) return send(res, 404, { error: 'Not found' });
  try {
    await handler(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) send(res, status, { error: status === 500 ? 'Server error' : err.message });
  }
});

server.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`));
