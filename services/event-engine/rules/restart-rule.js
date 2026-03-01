'use strict';

const { ROLES, SAFETY_STATES } = require('../../shared/constants');

const AUTHORIZED_ROLES = [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.OPERATOR];
const SUPERVISOR_ROLES = [ROLES.ADMIN, ROLES.SUPERVISOR];

/**
 * Evaluate restart authorization request. Pure function.
 * @param {object} params
 * @param {string} params.currentState - Current safety state
 * @param {boolean} params.physicalResetComplete - E-stop cleared signal received
 * @param {string} params.userRole - Role of the requesting user
 * @param {number} params.activeCriticalAlarms - Count of active critical alarms
 * @param {string} params.authorizationType - 'operator' or 'supervisor'
 * @returns {{ approved: boolean, reason: string }}
 */
function evaluate({ currentState, physicalResetComplete, userRole, activeCriticalAlarms, authorizationType }) {
  // LOCKOUT always requires supervisor
  if (currentState === SAFETY_STATES.LOCKOUT) {
    if (!SUPERVISOR_ROLES.includes(userRole)) {
      return { approved: false, reason: 'LOCKOUT state requires supervisor or admin authorization' };
    }
  } else if (authorizationType === 'supervisor') {
    if (!SUPERVISOR_ROLES.includes(userRole)) {
      return { approved: false, reason: 'Supervisor authorization requires supervisor or admin role' };
    }
  } else {
    if (!AUTHORIZED_ROLES.includes(userRole)) {
      return { approved: false, reason: 'Unauthorized role for restart' };
    }
  }

  if (!physicalResetComplete) {
    return { approved: false, reason: 'Physical reset not complete (E-stop must be cleared)' };
  }

  if (activeCriticalAlarms > 0) {
    return { approved: false, reason: `Cannot restart with ${activeCriticalAlarms} active critical alarm(s)` };
  }

  return { approved: true, reason: 'Restart authorized' };
}

module.exports = { evaluate, AUTHORIZED_ROLES, SUPERVISOR_ROLES };
