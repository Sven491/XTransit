const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  database: process.env.PG_DB,
  options: '-c search_path=data,public',
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.query('SELECT 1')
  .then(() => console.log('PostgreSQL connection OK'))
  .catch(err => {
    console.error('PostgreSQL connection FAILED');
    console.error(err);
    process.exit(1);
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
