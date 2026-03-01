'use strict';

const EventEmitter = require('events');
const { SAFETY_STATES, EVENT_TYPES, ROLES } = require('../../shared/constants');

const SUPERVISOR_ROLES = [ROLES.ADMIN, ROLES.SUPERVISOR];

/**
 * Deterministic safety state transition. Pure function.
 * Mirrors the server-side event-engine state machine exactly.
 */
function transition(currentState, eventType, context = {}) {
  if (!Object.values(SAFETY_STATES).includes(currentState)) {
    throw new Error(`Invalid state: ${currentState}`);
  }
  if (!Object.values(EVENT_TYPES).includes(eventType)) {
    throw new Error(`Invalid event type: ${eventType}`);
  }

  // LOCKOUT + RESTART_AUTHORIZED
  if (currentState === SAFETY_STATES.LOCKOUT && eventType === EVENT_TYPES.RESTART_AUTHORIZED) {
    const canRestart =
      context.physicalResetComplete === true &&
      SUPERVISOR_ROLES.includes(context.userRole) &&
      (context.activeCriticalAlarms || 0) === 0;

    return {
      previousState: currentState,
      newState: canRestart ? SAFETY_STATES.SAFE : SAFETY_STATES.LOCKOUT,
      eventType,
      transitioned: canRestart,
    };
  }

  // E-stop events
  if (eventType === EVENT_TYPES.ESTOP_ACTIVATED) {
    if (currentState === SAFETY_STATES.SAFE) {
      return { previousState: currentState, newState: SAFETY_STATES.ESTOP_ACTIVE, eventType, transitioned: true };
    }
    if (currentState === SAFETY_STATES.ALARM_ACTIVE) {
      return { previousState: currentState, newState: SAFETY_STATES.LOCKOUT, eventType, transitioned: true };
    }
    return { previousState: currentState, newState: currentState, eventType, transitioned: false };
  }

  if (eventType === EVENT_TYPES.ESTOP_CLEARED) {
    if (currentState === SAFETY_STATES.ESTOP_ACTIVE) {
      if (context.restartAuthorized) {
        return { previousState: currentState, newState: SAFETY_STATES.SAFE, eventType, transitioned: true };
      }
      return { previousState: currentState, newState: SAFETY_STATES.ESTOP_ACTIVE, eventType, transitioned: false };
    }
    return { previousState: currentState, newState: currentState, eventType, transitioned: false };
  }

  // Tank alarm events
  if (eventType === EVENT_TYPES.TANK_ALARM) {
    if (currentState === SAFETY_STATES.SAFE) {
      return { previousState: currentState, newState: SAFETY_STATES.ALARM_ACTIVE, eventType, transitioned: true };
    }
    if (currentState === SAFETY_STATES.ESTOP_ACTIVE) {
      return { previousState: currentState, newState: SAFETY_STATES.LOCKOUT, eventType, transitioned: true };
    }
    return { previousState: currentState, newState: currentState, eventType, transitioned: false };
  }

  if (eventType === EVENT_TYPES.TANK_ALARM_CLEARED) {
    if (currentState === SAFETY_STATES.ALARM_ACTIVE) {
      const activeCount = typeof context.activeAlarmCount === 'number' ? context.activeAlarmCount : 0;
      if (activeCount === 0) {
        return { previousState: currentState, newState: SAFETY_STATES.SAFE, eventType, transitioned: true };
      }
      return { previousState: currentState, newState: SAFETY_STATES.ALARM_ACTIVE, eventType, transitioned: false };
    }
    return { previousState: currentState, newState: currentState, eventType, transitioned: false };
  }

  // No transition for other events
  return { previousState: currentState, newState: currentState, eventType, transitioned: false };
}

/**
 * SafetyEngine — local safety enforcement running on SBC.
 * Hardware always overrides software: E-stop and alarm inputs
 * trigger immediate shutdown without network dependency.
 */
class SafetyEngine extends EventEmitter {
  constructor() {
    super();
    this._state = SAFETY_STATES.SAFE;
  }

  get state() {
    return this._state;
  }

  /**
   * Process a safety event and return the transition result.
   * Emits 'stateChange' when a transition occurs.
   */
  processEvent(eventType, context = {}) {
    const result = transition(this._state, eventType, context);
    if (result.transitioned) {
      this._state = result.newState;
      this.emit('stateChange', result);
    }
    return result;
  }

  /** Reset to a known state (for testing or controlled restart). */
  reset() {
    this._state = SAFETY_STATES.SAFE;
  }
}

module.exports = { SafetyEngine, transition };
