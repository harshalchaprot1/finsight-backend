
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'finsight',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

pool.query('SELECT current_database() AS database_name, current_user AS database_user')
  .then(({ rows }) => {
    console.log('✅ Connected to PostgreSQL:', rows[0]);
  })
  .catch((err) => {
    console.error('❌ PostgreSQL connection failed:', err.message);
  });

module.exports = pool;
