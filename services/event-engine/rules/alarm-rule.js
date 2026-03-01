'use strict';

const { EVENT_TYPES, SAFETY_STATES } = require('../../shared/constants');

/**
 * Evaluate tank alarm events. Pure function.
 * @param {string} currentState - Current safety state
 * @param {string} eventType - EVENT_TYPES value
 * @param {object} context - { activeAlarmCount, severity }
 * @returns {{ handled: boolean, newState?: string, reason?: string }}
 */
function evaluate(currentState, eventType, context) {
  if (eventType === EVENT_TYPES.TANK_ALARM) {
    if (currentState === SAFETY_STATES.SAFE) {
      return { handled: true, newState: SAFETY_STATES.ALARM_ACTIVE, reason: `Tank alarm triggered (severity: ${context && context.severity || 'unknown'})` };
    }
    if (currentState === SAFETY_STATES.ALARM_ACTIVE) {
      return { handled: true, newState: SAFETY_STATES.ALARM_ACTIVE, reason: 'Additional tank alarm' };
    }
    if (currentState === SAFETY_STATES.ESTOP_ACTIVE) {
      return { handled: true, newState: SAFETY_STATES.LOCKOUT, reason: 'Tank alarm during E-stop' };
    }
    // Already in LOCKOUT
    return { handled: true, newState: SAFETY_STATES.LOCKOUT, reason: 'Tank alarm during lockout' };
  }

  if (eventType === EVENT_TYPES.TANK_ALARM_CLEARED) {
    if (currentState !== SAFETY_STATES.ALARM_ACTIVE) {
      return { handled: false };
    }
    const activeCount = (context && typeof context.activeAlarmCount === 'number')
      ? context.activeAlarmCount
      : 0;

    if (activeCount > 0) {
      return { handled: true, newState: SAFETY_STATES.ALARM_ACTIVE, reason: `Alarm cleared but ${activeCount} alarm(s) still active` };
    }
    return { handled: true, newState: SAFETY_STATES.SAFE, reason: 'All tank alarms cleared' };
  }

  return { handled: false };
}

module.exports = { evaluate };
