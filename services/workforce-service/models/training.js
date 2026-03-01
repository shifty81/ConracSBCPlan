'use strict';

const pool = require('../src/db');

const Training = {
  async getModules(siteId) {
    const conditions = ['mandatory = true'];
    const values = [];
    let paramIndex = 1;

    if (siteId) {
      conditions.push(`(site_id = $${paramIndex++} OR site_id IS NULL)`);
      values.push(siteId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await pool.query(
      `SELECT * FROM training_modules ${where} ORDER BY title`,
      values
    );
    return rows;
  },

  async getEmployeeStatus(employeeId) {
    const { rows } = await pool.query(
      `SELECT
         tm.id AS module_id, tm.title, tm.renewal_period_days, tm.mandatory,
         etr.completed_at, etr.expires_at,
         CASE
           WHEN etr.id IS NULL THEN 'not_completed'
           WHEN etr.expires_at < NOW() THEN 'expired'
           WHEN etr.expires_at < NOW() + INTERVAL '30 days' THEN 'expiring_soon'
           ELSE 'current'
         END AS status
       FROM training_modules tm
       LEFT JOIN (
         SELECT DISTINCT ON (module_id) *
         FROM employee_training_records
         WHERE employee_id = $1
         ORDER BY module_id, completed_at DESC
       ) etr ON etr.module_id = tm.id
       WHERE tm.mandatory = true
       ORDER BY tm.title`,
      [employeeId]
    );
    return rows;
  },

  async recordCompletion(employeeId, moduleId, signature) {
    // Look up the module's renewal period
    const moduleResult = await pool.query(
      'SELECT renewal_period_days FROM training_modules WHERE id = $1',
      [moduleId]
    );

    if (moduleResult.rows.length === 0) {
      return null;
    }

    const renewalDays = parseInt(moduleResult.rows[0].renewal_period_days, 10);
    if (!Number.isFinite(renewalDays) || renewalDays <= 0) {
      return null;
    }

    const { rows } = await pool.query(
      `INSERT INTO employee_training_records
         (employee_id, module_id, completed_at, expires_at, digital_signature_hash)
       VALUES ($1, $2, NOW(), NOW() + ($3 || ' days')::INTERVAL, $4)
       RETURNING *`,
      [employeeId, moduleId, renewalDays, signature]
    );
    return rows[0];
  },

  async getExpiredCertifications(siteId) {
    const conditions = ['etr.expires_at < NOW()', 'tm.mandatory = true'];
    const values = [];
    let paramIndex = 1;

    if (siteId) {
      conditions.push(`(tm.site_id = $${paramIndex++} OR tm.site_id IS NULL)`);
      values.push(siteId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const { rows } = await pool.query(
      `SELECT etr.employee_id, tm.title AS module_title, etr.expires_at, etr.completed_at
       FROM employee_training_records etr
       JOIN training_modules tm ON tm.id = etr.module_id
       ${where}
       ORDER BY etr.expires_at ASC`,
      values
    );
    return rows;
  },

  async hasExpiredTraining(employeeId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS expired_count
       FROM training_modules tm
       LEFT JOIN (
         SELECT DISTINCT ON (module_id) *
         FROM employee_training_records
         WHERE employee_id = $1
         ORDER BY module_id, completed_at DESC
       ) etr ON etr.module_id = tm.id
       WHERE tm.mandatory = true
         AND (etr.id IS NULL OR etr.expires_at < NOW())`,
      [employeeId]
    );
    return parseInt(rows[0].expired_count, 10) > 0;
  },
};

module.exports = Training;
