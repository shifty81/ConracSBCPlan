'use strict';

const { EVENT_TYPES, SAFETY_STATES } = require('../../shared/constants');

/**
 * Evaluate E-stop events. Pure function.
 * @param {string} currentState - Current safety state
 * @param {string} eventType - EVENT_TYPES value
 * @param {object} context - { restartAuthorized }
 * @returns {{ handled: boolean, newState?: string, reason?: string }}
 */
function evaluate(currentState, eventType, context) {
  if (eventType === EVENT_TYPES.ESTOP_ACTIVATED) {
    if (currentState === SAFETY_STATES.SAFE) {
      return { handled: true, newState: SAFETY_STATES.ESTOP_ACTIVE, reason: 'E-stop activated' };
    }
    // From ALARM_ACTIVE → LOCKOUT (multiple alarm sources)
    if (currentState === SAFETY_STATES.ALARM_ACTIVE) {
      return { handled: true, newState: SAFETY_STATES.LOCKOUT, reason: 'E-stop activated during alarm' };
    }
    // Already in ESTOP_ACTIVE or LOCKOUT — no change
    return { handled: true, newState: currentState, reason: 'E-stop already active' };
  }

  if (eventType === EVENT_TYPES.ESTOP_CLEARED) {
    if (currentState !== SAFETY_STATES.ESTOP_ACTIVE) {
      return { handled: false };
    }
    if (!context || !context.restartAuthorized) {
      return { handled: true, newState: SAFETY_STATES.ESTOP_ACTIVE, reason: 'Restart authorization required to clear E-stop' };
    }
    return { handled: true, newState: SAFETY_STATES.SAFE, reason: 'E-stop cleared with authorization' };
  }

  return { handled: false };
}

module.exports = { evaluate };
