'use strict';

const express = require('express');
const { validateHeartbeat, validateTransaction, validateEvent, validateTankStatus } = require('../../shared/schemas');
const { processHeartbeat, processTransaction, processEvent, processTankReading } = require('../ingestion/processor');
const pool = require('./db');

const router = express.Router();

// POST /heartbeat
router.post('/heartbeat', async (req, res) => {
  try {
    const validation = validateHeartbeat(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }
    const result = await processHeartbeat(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// POST /transaction
router.post('/transaction', async (req, res) => {
  try {
    const validation = validateTransaction(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }
    const result = await processTransaction(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// POST /event
router.post('/event', async (req, res) => {
  try {
    const validation = validateEvent(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }
    const result = await processEvent(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// POST /tanks/status
router.post('/tanks/status', async (req, res) => {
  try {
    const validation = validateTankStatus(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }
    const result = await processTankReading(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// GET /devices
router.get('/devices', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT sbc_id, site_id, status, last_heartbeat, created_at FROM sbc_devices ORDER BY last_heartbeat DESC'
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// GET /devices/:sbc_id/history
router.get('/devices/:sbc_id/history', async (req, res) => {
  try {
    const { sbc_id } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const { rows } = await pool.query(
      'SELECT * FROM heartbeats WHERE sbc_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [sbc_id, limit]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

module.exports = router;
