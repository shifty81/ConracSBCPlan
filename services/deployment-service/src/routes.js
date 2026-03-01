'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const { generateId } = require('../../shared/utils');
const { createLogger } = require('../../shared/logging');
const { hashApiKey, isHeartbeatStale, buildDeploymentSummary } = require('../update-manager');

const logger = createLogger('deployment-service');
const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

router.use(apiLimiter);

// In-memory store for update packages
const updates = [];

// --- Device Management ---

// POST /devices — Register new SBC device
router.post('/devices', async (req, res) => {
  try {
    const { sbc_id, site_id, api_key, pump_id, location_description } = req.body;

    if (!sbc_id || !site_id || !api_key) {
      return res.status(400).json({ error: 'sbc_id, site_id, and api_key are required' });
    }

    const api_key_hash = hashApiKey(api_key);
    const now = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO sbc_devices (sbc_id, site_id, pump_id, location_description, api_key_hash, status, firmware_version, last_heartbeat, registered_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [sbc_id, site_id, pump_id || null, location_description || null, api_key_hash, 'online', '1.0.0', now, now, now]
    );

    logger.info('Device registered', { sbc_id, site_id });
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Device already registered' });
    }
    logger.error('Failed to register device', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /devices — List all registered devices
router.get('/devices', async (req, res) => {
  try {
    const { site_id, status } = req.query;
    let query = 'SELECT * FROM sbc_devices WHERE 1=1';
    const params = [];

    if (site_id) {
      params.push(site_id);
      query += ` AND site_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY registered_at DESC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    logger.error('Failed to list devices', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /devices/:sbc_id — Get single device with version info
router.get('/devices/:sbc_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sbc_devices WHERE sbc_id = $1',
      [req.params.sbc_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to get device', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /devices/:sbc_id — Update device details
router.put('/devices/:sbc_id', async (req, res) => {
  try {
    const { location_description, pump_id, status } = req.body;
    const now = new Date().toISOString();

    const existing = await pool.query(
      'SELECT * FROM sbc_devices WHERE sbc_id = $1',
      [req.params.sbc_id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const result = await pool.query(
      `UPDATE sbc_devices
       SET location_description = COALESCE($1, location_description),
           pump_id = COALESCE($2, pump_id),
           status = COALESCE($3, status),
           updated_at = $4
       WHERE sbc_id = $5
       RETURNING *`,
      [location_description, pump_id, status, now, req.params.sbc_id]
    );

    logger.info('Device updated', { sbc_id: req.params.sbc_id });
    return res.json(result.rows[0]);
  } catch (err) {
    logger.error('Failed to update device', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Version & Update Management ---

// POST /updates — Create a new update package record
router.post('/updates', async (req, res) => {
  try {
    const { version, release_notes, target_site_id } = req.body;

    if (!version) {
      return res.status(400).json({ error: 'version is required' });
    }

    const update = {
      update_id: generateId('upd'),
      version,
      release_notes: release_notes || '',
      target_site: target_site_id || 'all',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    updates.push(update);
    logger.info('Update package created', { update_id: update.update_id, version });
    return res.status(201).json(update);
  } catch (err) {
    logger.error('Failed to create update', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /updates — List update packages
router.get('/updates', (req, res) => {
  return res.json(updates);
});

// POST /updates/:update_id/deploy — Deploy update to target devices
router.post('/updates/:update_id/deploy', async (req, res) => {
  try {
    const update = updates.find(u => u.update_id === req.params.update_id);
    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    if (update.status !== 'pending') {
      return res.status(400).json({ error: `Cannot deploy update with status '${update.status}'` });
    }

    update.status = 'rolling_out';
    const now = new Date().toISOString();

    let query;
    let params;
    if (update.target_site === 'all') {
      query = 'UPDATE sbc_devices SET firmware_version = $1, updated_at = $2';
      params = [update.version, now];
    } else {
      query = 'UPDATE sbc_devices SET firmware_version = $1, updated_at = $2 WHERE site_id = $3';
      params = [update.version, now, update.target_site];
    }

    const result = await pool.query(query, params);
    update.status = 'completed';
    update.deployed_at = now;
    update.devices_updated = result.rowCount;

    logger.info('Update deployed', { update_id: update.update_id, devices_updated: result.rowCount });
    return res.json(update);
  } catch (err) {
    logger.error('Failed to deploy update', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /updates/:update_id/rollback — Rollback an update
router.post('/updates/:update_id/rollback', async (req, res) => {
  try {
    const update = updates.find(u => u.update_id === req.params.update_id);
    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    if (update.status !== 'completed' && update.status !== 'rolling_out') {
      return res.status(400).json({ error: `Cannot rollback update with status '${update.status}'` });
    }

    const { previous_version } = req.body;
    if (!previous_version) {
      return res.status(400).json({ error: 'previous_version is required' });
    }

    const now = new Date().toISOString();
    let query;
    let params;
    if (update.target_site === 'all') {
      query = 'UPDATE sbc_devices SET firmware_version = $1, updated_at = $2 WHERE firmware_version = $3';
      params = [previous_version, now, update.version];
    } else {
      query = 'UPDATE sbc_devices SET firmware_version = $1, updated_at = $2 WHERE site_id = $3 AND firmware_version = $4';
      params = [previous_version, now, update.target_site, update.version];
    }

    const result = await pool.query(query, params);
    update.status = 'rolled_back';
    update.rolled_back_at = now;
    update.devices_reverted = result.rowCount;

    logger.info('Update rolled back', { update_id: update.update_id, devices_reverted: result.rowCount });
    return res.json(update);
  } catch (err) {
    logger.error('Failed to rollback update', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Health & Status ---

// GET /status — Deployment overview
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sbc_devices');
    const summary = buildDeploymentSummary(result.rows);
    return res.json(summary);
  } catch (err) {
    logger.error('Failed to get deployment status', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Export updates array for testing
router._updates = updates;

module.exports = router;
