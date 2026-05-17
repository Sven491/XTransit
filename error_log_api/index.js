const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./db');

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(cors());

const PORT = Number(process.env.PORT || 5003);
const JWT_SECRET = process.env.JWT_SECRET || '';
// Admin verification is done by `auth_api` and carried in the JWT as `isAdmin`.

function toFriendlyError(statusCode) {
  if (statusCode === 400) return 'Controleer je invoer en probeer opnieuw.';
  if (statusCode === 401) return 'Je sessie is verlopen. Log opnieuw in.';
  if (statusCode === 403) return 'Je hebt hier geen toegang toe.';
  if (statusCode === 404) return 'Niet gevonden.';
  return 'Er ging iets mis. Probeer het later opnieuw.';
}

function normalizeErrorText(value) {
  if (!value) return 'Unknown error';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

async function insertErrorLog({ service, partOfService, error }) {
  const serviceName = String(service || 'unknown_service').slice(0, 120);
  const part = partOfService ? String(partOfService).slice(0, 240) : null;
  const errorText = String(normalizeErrorText(error)).slice(0, 8000);

  await db.query(
    'INSERT INTO data.errors ("service", "partOfService", "error") VALUES ($1, $2, $3)',
    [serviceName, part, errorText]
  );
}

function verifyAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: toFriendlyError(401) });
  }

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    if (!payload?.isAdmin) {
      return res.status(403).json({ error: toFriendlyError(403) });
    }

    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: toFriendlyError(401) });
  }
}

app.get('/health', async (_req, res) => {
  res.json({ status: 'ok', service: 'error_log_api' });
});

app.post('/error_log', async (req, res) => {
  try {
    const service = req.body?.service;
    const partOfService = req.body?.partOfService || null;
    const error = req.body?.error;

    if (!service || !error) {
      return res.status(400).json({ error: toFriendlyError(400) });
    }

    await insertErrorLog({ service, partOfService, error });
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /error_log failed:', err);
    return res.status(500).json({ error: toFriendlyError(500) });
  }
});

app.get('/error_log', verifyAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const service = req.query.service ? String(req.query.service) : null;
    const partOfService = req.query.partOfService ? String(req.query.partOfService) : null;

    const where = [];
    const params = [];

    if (service) {
      params.push(service);
      where.push(`"service" = $${params.length}`);
    }
    if (partOfService) {
      params.push(partOfService);
      where.push(`"partOfService" ILIKE $${params.length}`);
      params[params.length - 1] = `%${partOfService}%`;
    }

    params.push(limit);
    const rows = await db.query(
      `SELECT id, "date", "service", "partOfService", "error"
       FROM data.errors
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY "date" DESC, id DESC
       LIMIT $${params.length}`,
      params
    );

    return res.json({ errors: rows.rows });
  } catch (err) {
    console.error('GET /error_log failed:', err);
    return res.status(500).json({ error: toFriendlyError(500) });
  }
});

app.use(async (err, req, res, _next) => {
  try {
    await insertErrorLog({
      service: 'error_log_api',
      partOfService: `${req.method} ${req.originalUrl}`,
      error: err?.stack || err?.message || String(err),
    });
  } catch (logErr) {
    console.error('Failed to log internal error:', logErr);
  }

  if (res.headersSent) return;
  return res.status(500).json({ error: toFriendlyError(500) });
});

app.listen(PORT, () => console.log(`Error Log API listening on ${PORT}`));

module.exports = app;
