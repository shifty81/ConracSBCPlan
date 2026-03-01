'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'nexus',
  user: process.env.DB_USER || 'nexus',
  password: process.env.DB_PASSWORD || 'nexus',
  max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
});

module.exports = pool;
