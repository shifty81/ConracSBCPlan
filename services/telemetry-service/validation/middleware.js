'use strict';

const pool = require('../src/db');
const crypto = require('crypto');
const { createLogger } = require('../../shared/logging');

const logger = createLogger('telemetry-validation');

/**
 * Validates X-SBC-API-Key header against sbc_devices.api_key_hash.
 */
async function validateSbcApiKey(req, res, next) {
  const apiKey = req.headers['x-sbc-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-SBC-API-Key header' });
  }

  try {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const { rows } = await pool.query(
      'SELECT sbc_id FROM sbc_devices WHERE api_key_hash = $1',
      [keyHash]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    req.sbcDevice = rows[0];
    next();
  } catch (err) {
    logger.error('API key validation failed', { error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { validateSbcApiKey };
