const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

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
                service: 'employee_api',
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

// Employee onboarding
app.post('/createemployee', async (req, res) => {
    try {
        const {firstname, lastname, job, password} = req.body;
        if (!firstname || !lastname || !job || !password) return res.status(400).json({error: 'Firstname, Lastname, Job title and password are required'});

        const resultCreateEmployee = await db.query('INSERT INTO workers.employees (firstname, lastname, job) VALUES ($1, $2, $3) RETURNING id', [firstname, lastname, job]);
        const newEmployee = resultCreateEmployee.rows[0];
        const encryptedpassword = await bcrypt.hash(password, 12);
        const resultCreateUser = await db.query('INSERT INTO workers.users (employee, password) VALUES ($1, $2) RETURNING usercode', [newEmployee.id, encryptedpassword]);
        const newUser = resultCreateUser.rows[0];
        return res.status(201).json({ employee: firstname, code: newUser.usercoden });
    }
    catch (err) {
        void reportError({ partOfService: `${req.method} ${req.originalUrl}`, error: err?.stack || err?.message || String(err) });
        console.error(err);
        res.status(500).json({ error: friendlyErrorMessage(500) });
  }
})

app.get('/health', async (_req, res, _next) => {
    try {
    return res.status(200).json({endpoint: 'reachable'})
    }
    catch (err) {
        void reportError({ partOfService: `${req.method} ${req.originalUrl}`, error: err?.stack || err?.message || String(err) });
        console.error(err);
        res.status(500).json({ endpoint: 'unreachable', error: friendlyErrorMessage(500) })
    }
})

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Auth API listening on ${PORT}`));

module.exports = app;