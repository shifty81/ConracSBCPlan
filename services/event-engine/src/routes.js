'use strict';

const express = require('express');
const pool = require('./db');
const { transition } = require('../state-machine');
const restartRule = require('../rules/restart-rule');
const { EVENT_TYPES, SAFETY_STATES } = require('../../shared/constants');

const router = express.Router();

// POST /api/events/evaluate — Evaluate an incoming event against the state machine
router.post('/evaluate', async (req, res) => {
  try {
    const { sbc_id, site_id, event_type, context } = req.body;

    if (!sbc_id || !event_type) {
      return res.status(400).json({ error: 'sbc_id and event_type are required' });
    }

    if (!Object.values(EVENT_TYPES).includes(event_type)) {
      return res.status(400).json({ error: `Invalid event_type: ${event_type}` });
    }

    // Get current state for this SBC
    const stateRow = await pool.query(
      'SELECT safety_state FROM sbc_safety_state WHERE sbc_id = $1',
      [sbc_id]
    );

    const currentState = stateRow.rows.length > 0
      ? stateRow.rows[0].safety_state
      : SAFETY_STATES.SAFE;

    // Run deterministic state machine
    const result = transition(currentState, event_type, context || {});

    // Persist new state
    await pool.query(
      `INSERT INTO sbc_safety_state (sbc_id, site_id, safety_state, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (sbc_id) DO UPDATE SET safety_state = $3, site_id = $2, updated_at = NOW()`,
      [sbc_id, site_id, result.newState]
    );

    // Log the transition as an event
    await pool.query(
      `INSERT INTO events (sbc_id, site_id, event_type, previous_state, new_state, reason, context, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [sbc_id, site_id, event_type, result.previousState, result.newState, result.reason, JSON.stringify(context || {})]
    );

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events/state/:sbc_id — Get current safety state for an SBC
router.get('/state/:sbc_id', async (req, res) => {
  try {
    const { sbc_id } = req.params;
    const result = await pool.query(
      'SELECT sbc_id, site_id, safety_state, updated_at FROM sbc_safety_state WHERE sbc_id = $1',
      [sbc_id]
    );

    if (result.rows.length === 0) {
      return res.json({ sbc_id, safety_state: SAFETY_STATES.SAFE, message: 'No state record; default SAFE' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/events/restart-authorize — Request restart authorization
router.post('/restart-authorize', async (req, res) => {
  try {
    const { sbc_id, site_id, user_rfid, authorization_type } = req.body;

    if (!sbc_id || !user_rfid) {
      return res.status(400).json({ error: 'sbc_id and user_rfid are required' });
    }

    // Look up current state
    const stateRow = await pool.query(
      'SELECT safety_state FROM sbc_safety_state WHERE sbc_id = $1',
      [sbc_id]
    );
    const currentState = stateRow.rows.length > 0
      ? stateRow.rows[0].safety_state
      : SAFETY_STATES.SAFE;

    // Look up user by RFID
    const userRow = await pool.query(
      'SELECT id, role FROM users WHERE rfid_tag = $1 AND active = true',
      [user_rfid]
    );
    if (userRow.rows.length === 0) {
      return res.status(403).json({ approved: false, reason: 'Unknown or inactive RFID badge' });
    }
    const user = userRow.rows[0];

    // Check physical reset and active alarms
    const alarmRow = await pool.query(
      "SELECT COUNT(*) AS cnt FROM events WHERE sbc_id = $1 AND event_type = $2 AND acknowledged = false",
      [sbc_id, EVENT_TYPES.TANK_ALARM]
    );
    const activeCriticalAlarms = parseInt(alarmRow.rows[0].cnt, 10);

    // Physical reset is inferred from there being no un-cleared E-stop event
    const estopRow = await pool.query(
      `SELECT COUNT(*) AS cnt FROM events
       WHERE sbc_id = $1 AND event_type = $2
       AND created_at > COALESCE(
         (SELECT MAX(created_at) FROM events WHERE sbc_id = $1 AND event_type = $3), '1970-01-01'
       )`,
      [sbc_id, EVENT_TYPES.ESTOP_ACTIVATED, EVENT_TYPES.ESTOP_CLEARED]
    );
    const physicalResetComplete = parseInt(estopRow.rows[0].cnt, 10) === 0;

    const result = restartRule.evaluate({
      currentState,
      physicalResetComplete,
      userRole: user.role,
      activeCriticalAlarms,
      authorizationType: authorization_type || 'operator',
    });

    // Log the authorization attempt
    await pool.query(
      `INSERT INTO events (sbc_id, site_id, event_type, previous_state, new_state, reason, context, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        sbc_id, site_id, EVENT_TYPES.RESTART_AUTHORIZED, currentState,
        result.approved ? SAFETY_STATES.SAFE : currentState,
        result.reason,
        JSON.stringify({ user_rfid, authorization_type, approved: result.approved }),
      ]
    );

    // If approved, update the SBC state to SAFE
    if (result.approved) {
      await pool.query(
        `UPDATE sbc_safety_state SET safety_state = $1, updated_at = NOW() WHERE sbc_id = $2`,
        [SAFETY_STATES.SAFE, sbc_id]
      );
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/events — List events with filters
router.get('/', async (req, res) => {
  try {
    const { site_id, event_type, from, to, acknowledged, page, per_page } = req.query;
    const limit = Math.min(parseInt(per_page, 10) || 50, 200);
    const offset = ((parseInt(page, 10) || 1) - 1) * limit;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (site_id) {
      conditions.push(`site_id = $${idx++}`);
      params.push(site_id);
    }
    if (event_type) {
      conditions.push(`event_type = $${idx++}`);
      params.push(event_type);
    }
    if (from) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(to);
    }
    if (acknowledged !== undefined) {
      conditions.push(`acknowledged = $${idx++}`);
      params.push(acknowledged === 'true');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM events ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(`SELECT COUNT(*) AS total FROM events ${where}`, params.slice(0, -2));

    return res.json({
      events: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
      page: parseInt(page, 10) || 1,
      per_page: limit,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/events/:id/acknowledge — Acknowledge an event
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE events SET acknowledged = true, acknowledged_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
