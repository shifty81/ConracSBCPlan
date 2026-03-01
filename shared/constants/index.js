'use strict';

const ROLES = Object.freeze({
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
});

const PUMP_STATES = Object.freeze({
  IDLE: 'idle',
  AUTHORIZED: 'authorized',
  DISPENSING: 'dispensing',
  STOPPED: 'stopped',
  LOCKED: 'locked',
});

const EVENT_TYPES = Object.freeze({
  ESTOP_ACTIVATED: 'ESTOP_ACTIVATED',
  ESTOP_CLEARED: 'ESTOP_CLEARED',
  TANK_ALARM: 'TANK_ALARM',
  TANK_ALARM_CLEARED: 'TANK_ALARM_CLEARED',
  PUMP_AUTHORIZED: 'PUMP_AUTHORIZED',
  PUMP_STOPPED: 'PUMP_STOPPED',
  TRANSACTION_COMPLETE: 'TRANSACTION_COMPLETE',
  SBC_ONLINE: 'SBC_ONLINE',
  SBC_OFFLINE: 'SBC_OFFLINE',
  RESTART_AUTHORIZED: 'RESTART_AUTHORIZED',
});

const SBC_STATUS = Object.freeze({
  OK: 'OK',
  ALARM: 'ALARM',
  ESTOP: 'ESTOP',
  OFFLINE: 'OFFLINE',
});

const SAFETY_STATES = Object.freeze({
  SAFE: 'safe',
  ESTOP_ACTIVE: 'estop_active',
  ALARM_ACTIVE: 'alarm_active',
  LOCKOUT: 'lockout',
});

module.exports = {
  ROLES,
  PUMP_STATES,
  EVENT_TYPES,
  SBC_STATUS,
  SAFETY_STATES,
};
