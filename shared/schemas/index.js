'use strict';

const { EVENT_TYPES } = require('../constants');

function collectErrors(data, fields) {
  const errors = [];
  for (const field of fields) {
    const { name, type, check } = field;
    const value = data[name];
    if (value === undefined || value === null) {
      errors.push(`Missing required field: ${name}`);
      continue;
    }
    if (type && typeof value !== type) {
      errors.push(`Field '${name}' must be of type ${type}, got ${typeof value}`);
      continue;
    }
    if (check) {
      const msg = check(value);
      if (msg) errors.push(msg);
    }
  }
  return errors;
}

function result(errors) {
  if (errors.length === 0) return { valid: true };
  return { valid: false, errors };
}

function validateHeartbeat(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors = collectErrors(data, [
    { name: 'sbc_id', type: 'string' },
    { name: 'site_id', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'pump_state', type: 'string' },
    { name: 'estop_active', type: 'boolean' },
    { name: 'tank_alarm', type: 'boolean' },
  ]);
  return result(errors);
}

function validateTransaction(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors = collectErrors(data, [
    { name: 'sbc_id', type: 'string' },
    { name: 'site_id', type: 'string' },
    { name: 'transaction_id', type: 'string' },
    { name: 'user_rfid', type: 'string' },
    { name: 'pump_id', type: 'string' },
    { name: 'start_time', type: 'string' },
    { name: 'end_time', type: 'string' },
    {
      name: 'gallons',
      type: 'number',
      check: (v) => (v > 0 ? null : "Field 'gallons' must be greater than 0"),
    },
  ]);
  return result(errors);
}

function validateEvent(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const validEventTypes = Object.values(EVENT_TYPES);
  const errors = collectErrors(data, [
    { name: 'sbc_id', type: 'string' },
    { name: 'site_id', type: 'string' },
    { name: 'timestamp', type: 'string' },
    {
      name: 'event_type',
      type: 'string',
      check: (v) =>
        validEventTypes.includes(v)
          ? null
          : `Field 'event_type' must be one of: ${validEventTypes.join(', ')}`,
    },
  ]);
  return result(errors);
}

function validateLogin(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors = collectErrors(data, [
    { name: 'username', type: 'string' },
    { name: 'password', type: 'string' },
  ]);
  return result(errors);
}

function validateTankStatus(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors = collectErrors(data, [
    { name: 'device_id', type: 'string' },
    { name: 'site_id', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'level_gallons', type: 'number' },
    { name: 'capacity_gallons', type: 'number' },
    { name: 'temperature_f', type: 'number' },
    { name: 'status', type: 'string' },
  ]);
  return result(errors);
}

module.exports = {
  validateHeartbeat,
  validateTransaction,
  validateEvent,
  validateLogin,
  validateTankStatus,
};
