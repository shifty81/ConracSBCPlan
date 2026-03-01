const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'nexus',
  user: process.env.DB_USER || 'nexus_admin',
  password: process.env.DB_PASSWORD || '',
});

// GET /api/dashboard/overview
router.get('/overview', async (req, res, next) => {
  try {
    const pumps = await pool.query(
      'SELECT status, COUNT(*)::int AS count FROM sbc_devices GROUP BY status'
    ).catch(() => ({ rows: [] }));

    const alarms = await pool.query(
      "SELECT COUNT(*)::int AS count FROM events WHERE acknowledged = false"
    ).catch(() => ({ rows: [{ count: 0 }] }));

    res.json({
      pumps: pumps.rows.length > 0 ? pumps.rows : [
        { status: 'online', count: 0 },
        { status: 'offline', count: 0 },
      ],
      active_alarms: alarms.rows[0]?.count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/transactions
router.get('/transactions', async (req, res, next) => {
  try {
    const {
      site_id,
      from,
      to,
      page = 1,
      per_page = 25,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(per_page, 10) || 25));
    const offset = (pageNum - 1) * perPage;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (site_id) {
      conditions.push(`site_id = $${idx++}`);
      params.push(site_id);
    }
    if (from) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM transactions ${where}`,
      params
    ).catch(() => ({ rows: [{ total: 0 }] }));

    params.push(perPage, offset);
    const dataResult = await pool.query(
      `SELECT * FROM transactions ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      params
    ).catch(() => ({ rows: [] }));

    res.json({
      data: dataResult.rows,
      pagination: {
        page: pageNum,
        per_page: perPage,
        total: countResult.rows[0]?.total ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/tanks
router.get('/tanks', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (device_id) device_id, site_id, level_gallons,
              capacity_gallons, temperature_f, status, alerts, timestamp
       FROM tank_readings ORDER BY device_id, timestamp DESC`
    ).catch(() => ({ rows: [] }));

    res.json({ tanks: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/alarms
router.get('/alarms', async (req, res, next) => {
  try {
    const { status = 'active', page = 1, per_page = 25 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(per_page, 10) || 25));
    const offset = (pageNum - 1) * perPage;

    const acknowledged = status === 'active' ? false : true;
    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM events WHERE acknowledged = $1',
      [acknowledged]
    ).catch(() => ({ rows: [{ total: 0 }] }));

    const dataResult = await pool.query(
      'SELECT * FROM events WHERE acknowledged = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [acknowledged, perPage, offset]
    ).catch(() => ({ rows: [] }));

    res.json({
      data: dataResult.rows,
      pagination: {
        page: pageNum,
        per_page: perPage,
        total: countResult.rows[0]?.total ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
