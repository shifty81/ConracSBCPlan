'use strict';

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const { generateId } = require('../../shared/utils');
const { EVENT_TYPES } = require('../../shared/constants');
const { createLogger } = require('../../shared/logging');

const router = express.Router();
const logger = createLogger('formforce-service');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

router.use(apiLimiter);

// Event type to form template mapping
const EVENT_FORM_MAP = {
  [EVENT_TYPES.ESTOP_ACTIVATED]: 'estop-incident-report',
  [EVENT_TYPES.ESTOP_CLEARED]: 'estop-clearance-report',
  [EVENT_TYPES.TANK_ALARM]: 'tank-alarm-report',
  [EVENT_TYPES.TANK_ALARM_CLEARED]: 'tank-alarm-clearance-report',
  [EVENT_TYPES.TRANSACTION_COMPLETE]: 'transaction-receipt',
  [EVENT_TYPES.PUMP_AUTHORIZED]: 'pump-authorization-form',
  [EVENT_TYPES.PUMP_STOPPED]: 'pump-stop-report',
  [EVENT_TYPES.SBC_ONLINE]: 'sbc-online-report',
  [EVENT_TYPES.SBC_OFFLINE]: 'sbc-offline-report',
  [EVENT_TYPES.RESTART_AUTHORIZED]: 'restart-authorization-form',
};

// POST /submissions — Submit a form entry
router.post('/submissions', async (req, res) => {
  try {
    const { form_id, site_id, submitted_by, data } = req.body;

    if (!form_id || !site_id) {
      return res.status(400).json({ error: 'form_id and site_id are required' });
    }

    const submission_id = req.body.submission_id || generateId('form');
    const timestamp = req.body.timestamp || new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO form_submissions (submission_id, form_id, site_id, submitted_by, timestamp, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [submission_id, form_id, site_id, submitted_by || null, timestamp, JSON.stringify(data || {})]
    );

    logger.info('Form submission created', { submission_id, form_id, site_id });
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Submission ID already exists' });
    }
    logger.error('Error creating submission', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /submissions — List submissions with filters
router.get('/submissions', async (req, res) => {
  try {
    const { site_id, form_id, synced, since, until } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (site_id) {
      conditions.push(`site_id = $${idx++}`);
      params.push(site_id);
    }
    if (form_id) {
      conditions.push(`form_id = $${idx++}`);
      params.push(form_id);
    }
    if (synced !== undefined) {
      conditions.push(`synced = $${idx++}`);
      params.push(synced === 'true');
    }
    if (since) {
      conditions.push(`timestamp >= $${idx++}`);
      params.push(since);
    }
    if (until) {
      conditions.push(`timestamp <= $${idx++}`);
      params.push(until);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM form_submissions ${where} ORDER BY timestamp DESC`,
      params
    );

    return res.json(result.rows);
  } catch (err) {
    logger.error('Error listing submissions', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /submissions/:submission_id — Get single submission
router.get('/submissions/:submission_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM form_submissions WHERE submission_id = $1',
      [req.params.submission_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error fetching submission', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /submissions/:submission_id/sync — Mark submission as synced
router.put('/submissions/:submission_id/sync', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE form_submissions SET synced = true WHERE submission_id = $1 RETURNING *',
      [req.params.submission_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    logger.info('Submission marked as synced', { submission_id: req.params.submission_id });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('Error syncing submission', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /webhook — Receive external webhook notifications
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.NEXUS_FORMS_WEBHOOK_SECRET;
    const headerSecret = req.headers['x-webhook-secret'];

    if (!secret || !headerSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const secretBuf = Buffer.from(secret);
    const headerBuf = Buffer.from(headerSecret);

    if (secretBuf.length !== headerBuf.length || !crypto.timingSafeEqual(secretBuf, headerBuf)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { form_id, site_id, submitted_by, data } = req.body;

    if (!form_id || !site_id) {
      return res.status(400).json({ error: 'form_id and site_id are required' });
    }

    const submission_id = req.body.submission_id || generateId('wh');
    const timestamp = req.body.timestamp || new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO form_submissions (submission_id, form_id, site_id, submitted_by, timestamp, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [submission_id, form_id, site_id, submitted_by || null, timestamp, JSON.stringify(data || {})]
    );

    logger.info('Webhook submission created', { submission_id, form_id, site_id });
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Submission ID already exists' });
    }
    logger.error('Error processing webhook', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /generate — Generate a form entry from a platform event
router.post('/generate', async (req, res) => {
  try {
    const { event_type, site_id, details } = req.body;

    if (!event_type || !site_id) {
      return res.status(400).json({ error: 'event_type and site_id are required' });
    }

    const form_id = EVENT_FORM_MAP[event_type];
    if (!form_id) {
      return res.status(400).json({ error: `Unknown event type: ${event_type}` });
    }

    const submission_id = generateId('evt');
    const timestamp = new Date().toISOString();
    const data = {
      event_type,
      generated: true,
      details: details || {},
    };

    const result = await pool.query(
      `INSERT INTO form_submissions (submission_id, form_id, site_id, submitted_by, timestamp, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [submission_id, form_id, site_id, 'system', timestamp, JSON.stringify(data)]
    );

    logger.info('Form generated from event', { submission_id, form_id, event_type, site_id });
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Error generating form', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /compliance/summary — Compliance summary for a site
router.get('/compliance/summary', async (req, res) => {
  try {
    const { site_id } = req.query;

    if (!site_id) {
      return res.status(400).json({ error: 'site_id query parameter is required' });
    }

    const totalResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM form_submissions WHERE site_id = $1',
      [site_id]
    );

    const unsyncedResult = await pool.query(
      'SELECT COUNT(*)::int AS unsynced FROM form_submissions WHERE site_id = $1 AND synced = false',
      [site_id]
    );

    const byFormResult = await pool.query(
      'SELECT form_id, COUNT(*)::int AS count FROM form_submissions WHERE site_id = $1 GROUP BY form_id ORDER BY form_id',
      [site_id]
    );

    const rangeResult = await pool.query(
      'SELECT MIN(timestamp) AS earliest, MAX(timestamp) AS latest FROM form_submissions WHERE site_id = $1',
      [site_id]
    );

    return res.json({
      site_id,
      total: totalResult.rows[0].total,
      unsynced: unsyncedResult.rows[0].unsynced,
      by_form: byFormResult.rows,
      date_range: {
        earliest: rangeResult.rows[0].earliest,
        latest: rangeResult.rows[0].latest,
      },
    });
  } catch (err) {
    logger.error('Error fetching compliance summary', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
