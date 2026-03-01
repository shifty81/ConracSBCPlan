'use strict';

const pool = require('../src/db');

const SAFE_COLUMNS = 'id, site_id, system_type, title, description, priority, status, assigned_to, notes, resolution, labor_hours, created_at, updated_at, completed_at';

const Task = {
  async create(data) {
    const { rows } = await pool.query(
      `INSERT INTO tasks (site_id, system_type, title, description, priority, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SAFE_COLUMNS}`,
      [data.site_id, data.system_type, data.title, data.description, data.priority || 'medium', data.assigned_to]
    );
    return rows[0];
  },

  async list(filters) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.site_id) {
      conditions.push(`site_id = $${paramIndex++}`);
      values.push(filters.site_id);
    }
    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }
    if (filters.assigned_to) {
      conditions.push(`assigned_to = $${paramIndex++}`);
      values.push(filters.assigned_to);
    }
    if (filters.system_type) {
      conditions.push(`system_type = $${paramIndex++}`);
      values.push(filters.system_type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = parseInt(filters.page, 10) || 1;
    const perPage = Math.min(parseInt(filters.per_page, 10) || 25, 100);
    const offset = (page - 1) * perPage;

    values.push(perPage);
    values.push(offset);

    const { rows } = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM tasks ${where}
       ORDER BY CASE priority
         WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
         WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5
       END, created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      values
    );
    return rows;
  },

  async getById(id) {
    const { rows } = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM tasks WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async update(id, fields) {
    const allowed = ['title', 'description', 'priority', 'status', 'assigned_to', 'system_type', 'notes'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        setClauses.push(`${key} = $${paramIndex++}`);
        values.push(fields[key]);
      }
    }

    if (setClauses.length === 0) {
      return Task.getById(id);
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIndex}
       RETURNING ${SAFE_COLUMNS}`,
      values
    );
    return rows[0] || null;
  },

  async complete(id, completionData) {
    const { rows } = await pool.query(
      `UPDATE tasks
       SET status = 'completed', notes = COALESCE($2, notes),
           resolution = $3, labor_hours = $4,
           completed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING ${SAFE_COLUMNS}`,
      [id, completionData.notes || null, completionData.resolution || null, completionData.labor_hours || null]
    );
    return rows[0] || null;
  },
};

module.exports = Task;
