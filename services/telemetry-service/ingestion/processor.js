'use strict';

const pool = require('../src/db');
const { EVENT_TYPES, SBC_STATUS } = require('../../shared/constants');
const { createLogger } = require('../../shared/logging');
const { generateId } = require('../../shared/utils');

const logger = createLogger('telemetry-ingestion');

const TANK_ALERT_LOW_PERCENT = parseFloat(process.env.TANK_ALERT_LOW_PERCENT) || 15;
const TANK_ALERT_HIGH_PERCENT = parseFloat(process.env.TANK_ALERT_HIGH_PERCENT) || 95;

const CRITICAL_EVENT_TYPES = [
  EVENT_TYPES.ESTOP_ACTIVATED,
  EVENT_TYPES.TANK_ALARM,
  EVENT_TYPES.SBC_OFFLINE,
];

async function processHeartbeat(data) {
  const { sbc_id, site_id, timestamp, status, pump_state, estop_active, tank_alarm } = data;

  // Get previous status to detect changes
  const prev = await pool.query(
    'SELECT status FROM sbc_devices WHERE sbc_id = $1',
    [sbc_id]
  );
  const previousStatus = prev.rows.length > 0 ? prev.rows[0].status : null;

  // Store heartbeat
  const hbResult = await pool.query(
    `INSERT INTO heartbeats (sbc_id, site_id, timestamp, status, pump_state, estop_active, tank_alarm)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [sbc_id, site_id, timestamp, status, pump_state, estop_active, tank_alarm]
  );

  // Upsert sbc_devices last_heartbeat
  await pool.query(
    `INSERT INTO sbc_devices (sbc_id, site_id, status, last_heartbeat)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (sbc_id) DO UPDATE SET status = $3, last_heartbeat = $4`,
    [sbc_id, site_id, status, timestamp]
  );

  // Emit event if status changed
  if (previousStatus && previousStatus !== status) {
    const eventType = status === SBC_STATUS.OFFLINE
      ? EVENT_TYPES.SBC_OFFLINE
      : EVENT_TYPES.SBC_ONLINE;

    logger.info('SBC status changed', { sbc_id, from: previousStatus, to: status });

    await pool.query(
      `INSERT INTO events (sbc_id, site_id, timestamp, event_type, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [sbc_id, site_id, timestamp, eventType, JSON.stringify({ previous: previousStatus, current: status })]
    );
  }

  return hbResult.rows[0];
}

async function processTransaction(data) {
  const {
    sbc_id, site_id, transaction_id, user_rfid,
    pump_id, start_time, end_time, gallons, vehicle_plate, company_id,
  } = data;

  const result = await pool.query(
    `INSERT INTO transactions
       (sbc_id, site_id, transaction_id, user_rfid, pump_id, start_time, end_time, gallons, vehicle_plate, company_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [sbc_id, site_id, transaction_id, user_rfid, pump_id, start_time, end_time, gallons, vehicle_plate || null, company_id || null]
  );

  logger.info('Transaction recorded', { transaction_id, sbc_id, gallons });

  return result.rows[0];
}

async function processEvent(data) {
  const { sbc_id, site_id, timestamp, event_type, details } = data;

  const result = await pool.query(
    `INSERT INTO events (sbc_id, site_id, timestamp, event_type, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [sbc_id, site_id, timestamp, event_type, details ? JSON.stringify(details) : null]
  );

  // Flag critical events
  if (CRITICAL_EVENT_TYPES.includes(event_type)) {
    logger.warn('Critical event received', { sbc_id, event_type, details });
    await pool.query(
      `UPDATE events SET flagged = true WHERE id = $1`,
      [result.rows[0].id]
    );
    result.rows[0].flagged = true;
  }

  return result.rows[0];
}

async function processTankReading(data) {
  const { device_id, site_id, timestamp, level_gallons, capacity_gallons, temperature_f, status, alerts } = data;

  const result = await pool.query(
    `INSERT INTO tank_readings (device_id, site_id, timestamp, level_gallons, capacity_gallons, temperature_f, status, alerts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [device_id, site_id, timestamp, level_gallons, capacity_gallons, temperature_f, status, alerts ? JSON.stringify(alerts) : null]
  );

  // Check against thresholds
  const levelPercent = (level_gallons / capacity_gallons) * 100;

  if (levelPercent <= TANK_ALERT_LOW_PERCENT) {
    logger.warn('Tank level LOW', { device_id, levelPercent, threshold: TANK_ALERT_LOW_PERCENT });
    result.rows[0].alert = 'low_level';
  } else if (levelPercent >= TANK_ALERT_HIGH_PERCENT) {
    logger.warn('Tank level HIGH', { device_id, levelPercent, threshold: TANK_ALERT_HIGH_PERCENT });
    result.rows[0].alert = 'high_level';
  }

  return result.rows[0];
}

module.exports = {
  processHeartbeat,
  processTransaction,
  processEvent,
  processTankReading,
};
