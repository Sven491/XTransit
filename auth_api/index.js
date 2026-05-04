const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;


app.post('/login', async (req, res) => {
  try {
    const { userCode, password } = req.body;
    if (!userCode || !password) return res.status(400).json({ error: 'userCode and password required' });

    const result = await db.query('SELECT id, usercode, password FROM workers.users WHERE usercode = $1', [userCode]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const payload = { userId: user.id, userCode: user.usercode };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user: { id: user.id, userCode: user.userCode, job: user.job } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
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
    res.status(401).json({ error: 'invalid_token' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Auth API listening on ${PORT}`));

module.exports = app;
