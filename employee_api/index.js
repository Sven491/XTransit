const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

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
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
})

app.get('/health', async (_req, res, _next) => {
    try {
    return res.status(200).json({endpoint: 'reachable'})
    }
    catch (err) {
        console.error(err);
        res.status(500).json({endpoint: 'unreachable'})
    }
})

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Auth API listening on ${PORT}`));

module.exports = app;