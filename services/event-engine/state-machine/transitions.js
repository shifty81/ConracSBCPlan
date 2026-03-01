'use strict';

const { EVENT_TYPES, SAFETY_STATES } = require('../../shared/constants');

/**
 * Transition table: maps (currentState, eventType) → nextState.
 * A value of null means the transition requires additional authorization logic.
 * Missing entries mean the transition is not allowed.
 */
const TRANSITION_TABLE = Object.freeze({
  [SAFETY_STATES.SAFE]: {
    [EVENT_TYPES.ESTOP_ACTIVATED]: SAFETY_STATES.ESTOP_ACTIVE,
    [EVENT_TYPES.TANK_ALARM]: SAFETY_STATES.ALARM_ACTIVE,
  },
  [SAFETY_STATES.ESTOP_ACTIVE]: {
    [EVENT_TYPES.ESTOP_CLEARED]: null, // requires restart authorization
    [EVENT_TYPES.TANK_ALARM]: SAFETY_STATES.LOCKOUT,
  },
  [SAFETY_STATES.ALARM_ACTIVE]: {
    [EVENT_TYPES.TANK_ALARM_CLEARED]: null, // conditional: check remaining alarms
    [EVENT_TYPES.ESTOP_ACTIVATED]: SAFETY_STATES.LOCKOUT,
    [EVENT_TYPES.TANK_ALARM]: SAFETY_STATES.ALARM_ACTIVE, // additional alarm
  },
  [SAFETY_STATES.LOCKOUT]: {
    [EVENT_TYPES.RESTART_AUTHORIZED]: null, // requires supervisor + all clear
  },
});

/**
 * Look up the target state for a given (currentState, eventType).
 * Returns { allowed, targetState } where:
 *   allowed=false   → transition not defined
 *   targetState=null → transition requires authorization logic
 */
function lookupTransition(currentState, eventType) {
  const stateTransitions = TRANSITION_TABLE[currentState];
  if (!stateTransitions || !(eventType in stateTransitions)) {
    return { allowed: false, targetState: undefined };
  }
  return { allowed: true, targetState: stateTransitions[eventType] };
}

module.exports = { TRANSITION_TABLE, lookupTransition };
