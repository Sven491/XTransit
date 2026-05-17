const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

// Simple CORS middleware for browser-based admin UI testing.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

const ERROR_LOG_API_URL = process.env.ERROR_LOG_API_URL || 'http://localhost:5003/error_log';

function friendlyErrorMessage(statusCode) {
  if (statusCode === 400) return 'Controleer je invoer en probeer opnieuw.';
  if (statusCode === 401) return 'Je sessie is verlopen. Log opnieuw in.';
  if (statusCode === 403) return 'Je hebt hier geen toegang toe.';
  if (statusCode === 404) return 'Niet gevonden.';
  return 'Er ging iets mis. Probeer het later opnieuw.';
}

async function reportError({ partOfService, error }) {
  try {
    await fetch(ERROR_LOG_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'auth_api',
        partOfService,
        error,
      }),
    });
  } catch (_) {}
}

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && body && typeof body === 'object') {
      const rawError = body.error || body.message || body.details || `HTTP ${res.statusCode}`;
      void reportError({ partOfService: `${req.method} ${req.originalUrl}`, error: rawError });
      return originalJson({ error: friendlyErrorMessage(res.statusCode) });
    }
    return originalJson(body);
  };

  next();
});

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USER_CODES = new Set(
  String(process.env.ADMIN_USER_CODES || '')
    .split(',')
    .map(c => Number(c.trim()))
    .filter(Number.isFinite)
);


app.post('/login', async (req, res) => {
  try {
    const { userCode, password } = req.body;
    if (!userCode || !password) return res.status(400).json({ error: 'userCode and password required' });

    const result = await db.query('SELECT id, usercode, password FROM workers.users WHERE usercode = $1', [userCode]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const isAdmin = ADMIN_USER_CODES.has(Number(user.usercode));
    const payload = { userId: user.id, userCode: user.usercode, isAdmin };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user: { id: user.id, userCode: user.usercode, job: user.job, isAdmin } });
  } catch (err) {
    await reportError({ partOfService: `${req.method} ${req.originalUrl}`, error: err?.stack || err?.message || String(err) });
    console.error(err);
    res.status(500).json({ error: friendlyErrorMessage(500) });
  }
});

app.get('/me', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing_token' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ user: payload });
  } catch (err) {
    void reportError({ partOfService: `${req.method} ${req.originalUrl}`, error: err?.stack || err?.message || String(err) });
    res.status(401).json({ error: friendlyErrorMessage(401) });
  }
});

// Development helper removed for production safety.
// The /dev/token endpoint was intentionally removed to prevent accidental
// issuance of tokens in production builds. Use the real authentication flow
// (POST /login) or re-enable this code only in local development branches.

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Auth API listening on ${PORT}`));

module.exports = app;
