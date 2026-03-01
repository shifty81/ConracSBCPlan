'use strict';

const bcrypt = require('bcrypt');
const pool = require('../src/db');

const SALT_ROUNDS = 10;

const SAFE_COLUMNS = 'id, username, role, site_id, full_name, email, active, created_at, updated_at';

const User = {
  async findByUsername(username) {
    const { rows } = await pool.query(
      'SELECT id, username, password_hash, role, site_id, full_name, email, active FROM users WHERE username = $1',
      [username]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ username, password, role, site_id, full_name, email }) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, role, site_id, full_name, email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SAFE_COLUMNS}`,
      [username, passwordHash, role, site_id, full_name, email]
    );
    return rows[0];
  },

  async list(siteId) {
    if (siteId) {
      const { rows } = await pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users WHERE site_id = $1 ORDER BY username`,
        [siteId]
      );
      return rows;
    }
    const { rows } = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM users ORDER BY username`
    );
    return rows;
  },

  async update(id, fields) {
    const allowed = ['full_name', 'email', 'role', 'site_id'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(fields[key]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return User.findById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING ${SAFE_COLUMNS}`,
      values
    );
    return rows[0] || null;
  },

  async deactivate(id) {
    const { rows } = await pool.query(
      `UPDATE users SET active = false, updated_at = NOW() WHERE id = $1 RETURNING ${SAFE_COLUMNS}`,
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = User;
