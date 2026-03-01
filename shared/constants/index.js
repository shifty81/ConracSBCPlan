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

const SYSTEM_TYPES = Object.freeze({
  FUEL: 'fuel',
  CARWASH: 'carwash',
  HVAC: 'hvac',
  ELECTRICAL: 'electrical',
  PLUMBING: 'plumbing',
  FIRE_SUPPRESSION: 'fire_suppression',
  SECURITY: 'security',
  OTHER: 'other',
});

const VENDOR_VISIT_STATUS = Object.freeze({
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  ESCORTED: 'escorted',
});

const SERVICE_ORDER_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  INVOICED: 'invoiced',
  VERIFIED: 'verified',
  DISPUTED: 'disputed',
});

const CARWASH_CYCLE_TYPES = Object.freeze({
  BASIC: 'basic',
  FULL: 'full',
  RINSE: 'rinse',
  WAX: 'wax',
});

module.exports = {
  ROLES,
  PUMP_STATES,
  EVENT_TYPES,
  SBC_STATUS,
  SAFETY_STATES,
  SYSTEM_TYPES,
  VENDOR_VISIT_STATUS,
  SERVICE_ORDER_STATUS,
  CARWASH_CYCLE_TYPES,
};
