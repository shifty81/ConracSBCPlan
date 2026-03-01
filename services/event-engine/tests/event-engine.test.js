'use strict';

const { transition } = require('../state-machine');
const estopRule = require('../rules/estop-rule');
const alarmRule = require('../rules/alarm-rule');
const restartRule = require('../rules/restart-rule');
const { EVENT_TYPES, SAFETY_STATES, ROLES } = require('../../shared/constants');

// ---------------------------------------------------------------------------
// State machine — deterministic transition tests
// ---------------------------------------------------------------------------
describe('State Machine — transition()', () => {

  // SAFE transitions
  describe('from SAFE state', () => {
    test('SAFE + ESTOP_ACTIVATED → ESTOP_ACTIVE', () => {
      const result = transition(SAFETY_STATES.SAFE, EVENT_TYPES.ESTOP_ACTIVATED, {});
      expect(result.newState).toBe(SAFETY_STATES.ESTOP_ACTIVE);
      expect(result.previousState).toBe(SAFETY_STATES.SAFE);
      expect(result.transitioned).toBe(true);
    });

    test('SAFE + TANK_ALARM → ALARM_ACTIVE', () => {
      const result = transition(SAFETY_STATES.SAFE, EVENT_TYPES.TANK_ALARM, { severity: 'high' });
      expect(result.newState).toBe(SAFETY_STATES.ALARM_ACTIVE);
      expect(result.transitioned).toBe(true);
    });

    test('SAFE + unrelated event stays SAFE', () => {
      const result = transition(SAFETY_STATES.SAFE, EVENT_TYPES.PUMP_AUTHORIZED, {});
      expect(result.newState).toBe(SAFETY_STATES.SAFE);
      expect(result.transitioned).toBe(false);
    });
  });

  // ESTOP_ACTIVE transitions
  describe('from ESTOP_ACTIVE state', () => {
    test('ESTOP_ACTIVE + ESTOP_CLEARED without authorization stays ESTOP_ACTIVE', () => {
      const result = transition(SAFETY_STATES.ESTOP_ACTIVE, EVENT_TYPES.ESTOP_CLEARED, {});
      expect(result.newState).toBe(SAFETY_STATES.ESTOP_ACTIVE);
      expect(result.transitioned).toBe(false);
    });

    test('ESTOP_ACTIVE + ESTOP_CLEARED with authorization → SAFE', () => {
      const result = transition(SAFETY_STATES.ESTOP_ACTIVE, EVENT_TYPES.ESTOP_CLEARED, { restartAuthorized: true });
      expect(result.newState).toBe(SAFETY_STATES.SAFE);
      expect(result.transitioned).toBe(true);
    });

    test('ESTOP_ACTIVE + TANK_ALARM → LOCKOUT', () => {
      const result = transition(SAFETY_STATES.ESTOP_ACTIVE, EVENT_TYPES.TANK_ALARM, { severity: 'critical' });
      expect(result.newState).toBe(SAFETY_STATES.LOCKOUT);
      expect(result.transitioned).toBe(true);
    });
  });

  // ALARM_ACTIVE transitions
  describe('from ALARM_ACTIVE state', () => {
    test('ALARM_ACTIVE + TANK_ALARM_CLEARED (no remaining) → SAFE', () => {
      const result = transition(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.TANK_ALARM_CLEARED, { activeAlarmCount: 0 });
      expect(result.newState).toBe(SAFETY_STATES.SAFE);
      expect(result.transitioned).toBe(true);
    });

    test('ALARM_ACTIVE + TANK_ALARM_CLEARED (remaining alarms) stays ALARM_ACTIVE', () => {
      const result = transition(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.TANK_ALARM_CLEARED, { activeAlarmCount: 2 });
      expect(result.newState).toBe(SAFETY_STATES.ALARM_ACTIVE);
      expect(result.transitioned).toBe(false);
    });

    test('ALARM_ACTIVE + ESTOP_ACTIVATED → LOCKOUT', () => {
      const result = transition(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.ESTOP_ACTIVATED, {});
      expect(result.newState).toBe(SAFETY_STATES.LOCKOUT);
      expect(result.transitioned).toBe(true);
    });

    test('ALARM_ACTIVE + additional TANK_ALARM stays ALARM_ACTIVE', () => {
      const result = transition(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.TANK_ALARM, { severity: 'low' });
      expect(result.newState).toBe(SAFETY_STATES.ALARM_ACTIVE);
      expect(result.transitioned).toBe(false);
    });
  });

  // LOCKOUT transitions
  describe('from LOCKOUT state', () => {
    test('LOCKOUT + RESTART_AUTHORIZED (supervisor, all clear) → SAFE', () => {
      const result = transition(SAFETY_STATES.LOCKOUT, EVENT_TYPES.RESTART_AUTHORIZED, {
        physicalResetComplete: true,
        userRole: ROLES.SUPERVISOR,
        activeCriticalAlarms: 0,
      });
      expect(result.newState).toBe(SAFETY_STATES.SAFE);
      expect(result.transitioned).toBe(true);
    });

    test('LOCKOUT + RESTART_AUTHORIZED (operator, not supervisor) stays LOCKOUT', () => {
      const result = transition(SAFETY_STATES.LOCKOUT, EVENT_TYPES.RESTART_AUTHORIZED, {
        physicalResetComplete: true,
        userRole: ROLES.OPERATOR,
        activeCriticalAlarms: 0,
      });
      expect(result.newState).toBe(SAFETY_STATES.LOCKOUT);
      expect(result.transitioned).toBe(false);
    });

    test('LOCKOUT + RESTART_AUTHORIZED (active alarms) stays LOCKOUT', () => {
      const result = transition(SAFETY_STATES.LOCKOUT, EVENT_TYPES.RESTART_AUTHORIZED, {
        physicalResetComplete: true,
        userRole: ROLES.SUPERVISOR,
        activeCriticalAlarms: 1,
      });
      expect(result.newState).toBe(SAFETY_STATES.LOCKOUT);
      expect(result.transitioned).toBe(false);
    });

    test('LOCKOUT + RESTART_AUTHORIZED (no physical reset) stays LOCKOUT', () => {
      const result = transition(SAFETY_STATES.LOCKOUT, EVENT_TYPES.RESTART_AUTHORIZED, {
        physicalResetComplete: false,
        userRole: ROLES.SUPERVISOR,
        activeCriticalAlarms: 0,
      });
      expect(result.newState).toBe(SAFETY_STATES.LOCKOUT);
      expect(result.transitioned).toBe(false);
    });
  });

  // Invalid inputs
  describe('error handling', () => {
    test('throws on invalid state', () => {
      expect(() => transition('BOGUS', EVENT_TYPES.ESTOP_ACTIVATED, {})).toThrow('Invalid state');
    });

    test('throws on invalid event type', () => {
      expect(() => transition(SAFETY_STATES.SAFE, 'BOGUS_EVENT', {})).toThrow('Invalid event type');
    });
  });
});

// ---------------------------------------------------------------------------
// E-stop rule
// ---------------------------------------------------------------------------
describe('E-stop Rule', () => {
  test('ESTOP_ACTIVATED always transitions SAFE → ESTOP_ACTIVE', () => {
    const result = estopRule.evaluate(SAFETY_STATES.SAFE, EVENT_TYPES.ESTOP_ACTIVATED, {});
    expect(result.handled).toBe(true);
    expect(result.newState).toBe(SAFETY_STATES.ESTOP_ACTIVE);
  });

  test('ESTOP_ACTIVATED from ALARM_ACTIVE → LOCKOUT', () => {
    const result = estopRule.evaluate(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.ESTOP_ACTIVATED, {});
    expect(result.handled).toBe(true);
    expect(result.newState).toBe(SAFETY_STATES.LOCKOUT);
  });

  test('ESTOP_CLEARED without auth stays ESTOP_ACTIVE', () => {
    const result = estopRule.evaluate(SAFETY_STATES.ESTOP_ACTIVE, EVENT_TYPES.ESTOP_CLEARED, {});
    expect(result.handled).toBe(true);
    expect(result.newState).toBe(SAFETY_STATES.ESTOP_ACTIVE);
  });

  test('ESTOP_CLEARED with auth → SAFE', () => {
    const result = estopRule.evaluate(SAFETY_STATES.ESTOP_ACTIVE, EVENT_TYPES.ESTOP_CLEARED, { restartAuthorized: true });
    expect(result.handled).toBe(true);
    expect(result.newState).toBe(SAFETY_STATES.SAFE);
  });

  test('unrelated event returns handled=false', () => {
    const result = estopRule.evaluate(SAFETY_STATES.SAFE, EVENT_TYPES.PUMP_AUTHORIZED, {});
    expect(result.handled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tank alarm rule
// ---------------------------------------------------------------------------
describe('Tank Alarm Rule', () => {
  test('TANK_ALARM from SAFE → ALARM_ACTIVE', () => {
    const result = alarmRule.evaluate(SAFETY_STATES.SAFE, EVENT_TYPES.TANK_ALARM, { severity: 'high' });
    expect(result.handled).toBe(true);
    expect(result.newState).toBe(SAFETY_STATES.ALARM_ACTIVE);
  });

  test('TANK_ALARM from ESTOP_ACTIVE → LOCKOUT', () => {
    const result = alarmRule.evaluate(SAFETY_STATES.ESTOP_ACTIVE, EVENT_TYPES.TANK_ALARM, {});
    expect(result.handled).toBe(true);
    expect(result.newState).toBe(SAFETY_STATES.LOCKOUT);
  });

  test('TANK_ALARM_CLEARED with no remaining alarms → SAFE', () => {
    const result = alarmRule.evaluate(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.TANK_ALARM_CLEARED, { activeAlarmCount: 0 });
    expect(result.handled).toBe(true);
    expect(result.newState).toBe(SAFETY_STATES.SAFE);
  });

  test('TANK_ALARM_CLEARED with remaining alarms stays ALARM_ACTIVE', () => {
    const result = alarmRule.evaluate(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.TANK_ALARM_CLEARED, { activeAlarmCount: 3 });
    expect(result.handled).toBe(true);
    expect(result.newState).toBe(SAFETY_STATES.ALARM_ACTIVE);
  });
});

// ---------------------------------------------------------------------------
// Restart authorization rule
// ---------------------------------------------------------------------------
describe('Restart Authorization Rule', () => {
  test('approves when all conditions met (operator)', () => {
    const result = restartRule.evaluate({
      currentState: SAFETY_STATES.ESTOP_ACTIVE,
      physicalResetComplete: true,
      userRole: ROLES.OPERATOR,
      activeCriticalAlarms: 0,
      authorizationType: 'operator',
    });
    expect(result.approved).toBe(true);
  });

  test('denies when physical reset not complete', () => {
    const result = restartRule.evaluate({
      currentState: SAFETY_STATES.ESTOP_ACTIVE,
      physicalResetComplete: false,
      userRole: ROLES.OPERATOR,
      activeCriticalAlarms: 0,
      authorizationType: 'operator',
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/Physical reset/);
  });

  test('denies when active critical alarms exist', () => {
    const result = restartRule.evaluate({
      currentState: SAFETY_STATES.ESTOP_ACTIVE,
      physicalResetComplete: true,
      userRole: ROLES.OPERATOR,
      activeCriticalAlarms: 2,
      authorizationType: 'operator',
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/critical alarm/);
  });

  test('denies viewer role', () => {
    const result = restartRule.evaluate({
      currentState: SAFETY_STATES.ESTOP_ACTIVE,
      physicalResetComplete: true,
      userRole: ROLES.VIEWER,
      activeCriticalAlarms: 0,
      authorizationType: 'operator',
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/Unauthorized/);
  });

  test('LOCKOUT requires supervisor — operator denied', () => {
    const result = restartRule.evaluate({
      currentState: SAFETY_STATES.LOCKOUT,
      physicalResetComplete: true,
      userRole: ROLES.OPERATOR,
      activeCriticalAlarms: 0,
      authorizationType: 'supervisor',
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/supervisor/i);
  });

  test('LOCKOUT approved by supervisor', () => {
    const result = restartRule.evaluate({
      currentState: SAFETY_STATES.LOCKOUT,
      physicalResetComplete: true,
      userRole: ROLES.SUPERVISOR,
      activeCriticalAlarms: 0,
      authorizationType: 'supervisor',
    });
    expect(result.approved).toBe(true);
  });

  test('LOCKOUT approved by admin', () => {
    const result = restartRule.evaluate({
      currentState: SAFETY_STATES.LOCKOUT,
      physicalResetComplete: true,
      userRole: ROLES.ADMIN,
      activeCriticalAlarms: 0,
      authorizationType: 'supervisor',
    });
    expect(result.approved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Determinism — same inputs always produce same outputs
// ---------------------------------------------------------------------------
describe('Determinism', () => {
  const testCases = [
    { state: SAFETY_STATES.SAFE, event: EVENT_TYPES.ESTOP_ACTIVATED, ctx: {} },
    { state: SAFETY_STATES.SAFE, event: EVENT_TYPES.TANK_ALARM, ctx: { severity: 'high' } },
    { state: SAFETY_STATES.ESTOP_ACTIVE, event: EVENT_TYPES.ESTOP_CLEARED, ctx: { restartAuthorized: true } },
    { state: SAFETY_STATES.ALARM_ACTIVE, event: EVENT_TYPES.TANK_ALARM_CLEARED, ctx: { activeAlarmCount: 0 } },
    { state: SAFETY_STATES.ALARM_ACTIVE, event: EVENT_TYPES.ESTOP_ACTIVATED, ctx: {} },
    { state: SAFETY_STATES.LOCKOUT, event: EVENT_TYPES.RESTART_AUTHORIZED, ctx: { physicalResetComplete: true, userRole: ROLES.SUPERVISOR, activeCriticalAlarms: 0 } },
  ];

  test.each(testCases)(
    'transition($state, $event) is deterministic',
    ({ state, event, ctx }) => {
      const a = transition(state, event, ctx);
      const b = transition(state, event, ctx);
      expect(a).toEqual(b);
    },
  );

  test('100 identical calls produce identical results', () => {
    const results = Array.from({ length: 100 }, () =>
      transition(SAFETY_STATES.SAFE, EVENT_TYPES.ESTOP_ACTIVATED, {}),
    );
    const first = results[0];
    results.forEach((r) => expect(r).toEqual(first));
  });
});

// ---------------------------------------------------------------------------
// HTTP API smoke tests
// ---------------------------------------------------------------------------
const request = require('supertest');
const app = require('../src/index');

describe('HTTP API', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('event-engine');
  });

  test('POST /api/events/evaluate rejects missing sbc_id', async () => {
    const res = await request(app)
      .post('/api/events/evaluate')
      .send({ event_type: EVENT_TYPES.ESTOP_ACTIVATED });
    expect(res.status).toBe(400);
  });

  test('POST /api/events/evaluate rejects invalid event_type', async () => {
    const res = await request(app)
      .post('/api/events/evaluate')
      .send({ sbc_id: 'sbc-1', event_type: 'INVALID' });
    expect(res.status).toBe(400);
  });

  test('GET /unknown returns 404', async () => {
    const res = await request(app).get('/unknown');
    expect(res.status).toBe(404);
  });
});
