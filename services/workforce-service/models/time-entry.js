'use strict';

const pool = require('../src/db');

const TimeEntry = {
  async clockIn(employeeId, siteId, workCategory) {
    const { rows } = await pool.query(
      `INSERT INTO employee_time_entries (employee_id, site_id, clock_in, work_category)
       VALUES ($1, $2, NOW(), $3)
       RETURNING *`,
      [employeeId, siteId, workCategory]
    );
    return rows[0];
  },

  async clockOut(entryId, notes) {
    const { rows } = await pool.query(
      `UPDATE employee_time_entries
       SET clock_out = NOW(), notes = $2, updated_at = NOW()
       WHERE id = $1 AND clock_out IS NULL
       RETURNING *`,
      [entryId, notes || null]
    );
    return rows[0] || null;
  },

  async getCurrentStatus(employeeId) {
    const { rows } = await pool.query(
      `SELECT * FROM employee_time_entries
       WHERE employee_id = $1 AND clock_out IS NULL
       ORDER BY clock_in DESC LIMIT 1`,
      [employeeId]
    );
    return rows[0] || null;
  },

  async getEntries(filters) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.employee_id) {
      conditions.push(`employee_id = $${paramIndex++}`);
      values.push(filters.employee_id);
    }
    if (filters.site_id) {
      conditions.push(`site_id = $${paramIndex++}`);
      values.push(filters.site_id);
    }
    if (filters.from) {
      conditions.push(`clock_in >= $${paramIndex++}`);
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`clock_in <= $${paramIndex++}`);
      values.push(filters.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = parseInt(filters.page, 10) || 1;
    const perPage = Math.min(parseInt(filters.per_page, 10) || 25, 100);
    const offset = (page - 1) * perPage;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM employee_time_entries ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(perPage);
    values.push(offset);

    const { rows } = await pool.query(
      `SELECT * FROM employee_time_entries ${where}
       ORDER BY clock_in DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      values
    );

    return { entries: rows, total, page, per_page: perPage };
  },

  async getSummary(filters) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.employee_id) {
      conditions.push(`employee_id = $${paramIndex++}`);
      values.push(filters.employee_id);
    }
    if (filters.site_id) {
      conditions.push(`site_id = $${paramIndex++}`);
      values.push(filters.site_id);
    }
    if (filters.from) {
      conditions.push(`clock_in >= $${paramIndex++}`);
      values.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`clock_in <= $${paramIndex++}`);
      values.push(filters.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalResult = await pool.query(
      `SELECT
         COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(clock_out, NOW()) - clock_in)) / 3600), 0) AS total_hours
       FROM employee_time_entries ${where}`,
      values
    );

    const categoryResult = await pool.query(
      `SELECT work_category,
         COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(clock_out, NOW()) - clock_in)) / 3600), 0) AS hours
       FROM employee_time_entries ${where}
       GROUP BY work_category
       ORDER BY work_category`,
      values
    );

    const entriesResult = await pool.query(
      `SELECT * FROM employee_time_entries ${where} ORDER BY clock_in DESC`,
      values
    );

    const totalHours = parseFloat(totalResult.rows[0].total_hours) || 0;
    const overtimeHours = Math.max(0, totalHours - 40);

    return {
      total_hours: Math.round(totalHours * 100) / 100,
      overtime_hours: Math.round(overtimeHours * 100) / 100,
      hours_by_category: categoryResult.rows.map((r) => ({
        category: r.work_category,
        hours: Math.round(parseFloat(r.hours) * 100) / 100,
      })),
      entries: entriesResult.rows,
    };
  },
};

module.exports = TimeEntry;
