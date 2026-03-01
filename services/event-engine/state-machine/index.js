'use strict';

const { EVENT_TYPES, SAFETY_STATES } = require('../../shared/constants');
const { lookupTransition } = require('./transitions');
const estopRule = require('../rules/estop-rule');
const alarmRule = require('../rules/alarm-rule');
const restartRule = require('../rules/restart-rule');

// Ordered rule chain — first match wins
const RULES = [estopRule, alarmRule];

/**
 * Deterministic state machine. Pure function.
 * Given a current state and an event, returns the next state and metadata.
 *
 * @param {string} currentState - One of SAFETY_STATES values
 * @param {string} eventType - One of EVENT_TYPES values
 * @param {object} [context={}] - Additional context for rule evaluation
 * @returns {{ previousState: string, newState: string, eventType: string, reason: string, transitioned: boolean }}
 */
function transition(currentState, eventType, context) {
  if (!Object.values(SAFETY_STATES).includes(currentState)) {
    throw new Error(`Invalid state: ${currentState}`);
  }
  if (!Object.values(EVENT_TYPES).includes(eventType)) {
    throw new Error(`Invalid event type: ${eventType}`);
  }

  // Handle RESTART_AUTHORIZED for LOCKOUT
  if (eventType === EVENT_TYPES.RESTART_AUTHORIZED && currentState === SAFETY_STATES.LOCKOUT) {
    const restartResult = restartRule.evaluate({
      currentState,
      physicalResetComplete: context.physicalResetComplete || false,
      userRole: context.userRole,
      activeCriticalAlarms: context.activeCriticalAlarms || 0,
      authorizationType: 'supervisor',
    });

    if (restartResult.approved) {
      return {
        previousState: currentState,
        newState: SAFETY_STATES.SAFE,
        eventType,
        reason: restartResult.reason,
        transitioned: true,
      };
    }

    return {
      previousState: currentState,
      newState: SAFETY_STATES.LOCKOUT,
      eventType,
      reason: restartResult.reason,
      transitioned: false,
    };
  }

  // Evaluate ordered rule chain
  for (const rule of RULES) {
    const result = rule.evaluate(currentState, eventType, context);
    if (result.handled) {
      return {
        previousState: currentState,
        newState: result.newState,
        eventType,
        reason: result.reason,
        transitioned: result.newState !== currentState,
      };
    }
  }

  // Fall back to transition table for any remaining valid transitions
  const lookup = lookupTransition(currentState, eventType);
  if (lookup.allowed && lookup.targetState) {
    return {
      previousState: currentState,
      newState: lookup.targetState,
      eventType,
      reason: 'Transition table',
      transitioned: lookup.targetState !== currentState,
    };
  }

  // No transition defined — stay in current state
  return {
    previousState: currentState,
    newState: currentState,
    eventType,
    reason: `No transition from ${currentState} on ${eventType}`,
    transitioned: false,
  };
}

module.exports = { transition };
