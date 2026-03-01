'use strict';

const { SAFETY_STATES, EVENT_TYPES, ROLES, SBC_STATUS } = require('../../shared/constants');

// ---------------------------------------------------------------------------
// Safety Engine
// ---------------------------------------------------------------------------
const { SafetyEngine, transition } = require('../safety-engine');

describe('Safety Engine — transition()', () => {
  describe('from SAFE state', () => {
    test('SAFE + ESTOP_ACTIVATED → ESTOP_ACTIVE', () => {
      const r = transition(SAFETY_STATES.SAFE, EVENT_TYPES.ESTOP_ACTIVATED, {});
      expect(r.newState).toBe(SAFETY_STATES.ESTOP_ACTIVE);
      expect(r.previousState).toBe(SAFETY_STATES.SAFE);
      expect(r.transitioned).toBe(true);
    });

    test('SAFE + TANK_ALARM → ALARM_ACTIVE', () => {
      const r = transition(SAFETY_STATES.SAFE, EVENT_TYPES.TANK_ALARM, { severity: 'high' });
      expect(r.newState).toBe(SAFETY_STATES.ALARM_ACTIVE);
      expect(r.transitioned).toBe(true);
    });

    test('SAFE + unrelated event stays SAFE', () => {
      const r = transition(SAFETY_STATES.SAFE, EVENT_TYPES.PUMP_AUTHORIZED, {});
      expect(r.newState).toBe(SAFETY_STATES.SAFE);
      expect(r.transitioned).toBe(false);
    });
  });

  describe('from ESTOP_ACTIVE state', () => {
    test('ESTOP_ACTIVE + ESTOP_CLEARED without authorization stays ESTOP_ACTIVE', () => {
      const r = transition(SAFETY_STATES.ESTOP_ACTIVE, EVENT_TYPES.ESTOP_CLEARED, {});
      expect(r.newState).toBe(SAFETY_STATES.ESTOP_ACTIVE);
      expect(r.transitioned).toBe(false);
    });

    test('ESTOP_ACTIVE + ESTOP_CLEARED with authorization → SAFE', () => {
      const r = transition(SAFETY_STATES.ESTOP_ACTIVE, EVENT_TYPES.ESTOP_CLEARED, { restartAuthorized: true });
      expect(r.newState).toBe(SAFETY_STATES.SAFE);
      expect(r.transitioned).toBe(true);
    });

    test('ESTOP_ACTIVE + TANK_ALARM → LOCKOUT', () => {
      const r = transition(SAFETY_STATES.ESTOP_ACTIVE, EVENT_TYPES.TANK_ALARM, { severity: 'critical' });
      expect(r.newState).toBe(SAFETY_STATES.LOCKOUT);
      expect(r.transitioned).toBe(true);
    });
  });

  describe('from ALARM_ACTIVE state', () => {
    test('ALARM_ACTIVE + TANK_ALARM_CLEARED (no remaining) → SAFE', () => {
      const r = transition(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.TANK_ALARM_CLEARED, { activeAlarmCount: 0 });
      expect(r.newState).toBe(SAFETY_STATES.SAFE);
      expect(r.transitioned).toBe(true);
    });

    test('ALARM_ACTIVE + TANK_ALARM_CLEARED (remaining alarms) stays ALARM_ACTIVE', () => {
      const r = transition(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.TANK_ALARM_CLEARED, { activeAlarmCount: 2 });
      expect(r.newState).toBe(SAFETY_STATES.ALARM_ACTIVE);
      expect(r.transitioned).toBe(false);
    });

    test('ALARM_ACTIVE + ESTOP_ACTIVATED → LOCKOUT', () => {
      const r = transition(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.ESTOP_ACTIVATED, {});
      expect(r.newState).toBe(SAFETY_STATES.LOCKOUT);
      expect(r.transitioned).toBe(true);
    });

    test('ALARM_ACTIVE + additional TANK_ALARM stays ALARM_ACTIVE', () => {
      const r = transition(SAFETY_STATES.ALARM_ACTIVE, EVENT_TYPES.TANK_ALARM, { severity: 'low' });
      expect(r.newState).toBe(SAFETY_STATES.ALARM_ACTIVE);
      expect(r.transitioned).toBe(false);
    });
  });

  describe('from LOCKOUT state', () => {
    test('LOCKOUT + RESTART_AUTHORIZED (supervisor, all clear) → SAFE', () => {
      const r = transition(SAFETY_STATES.LOCKOUT, EVENT_TYPES.RESTART_AUTHORIZED, {
        physicalResetComplete: true,
        userRole: ROLES.SUPERVISOR,
        activeCriticalAlarms: 0,
      });
      expect(r.newState).toBe(SAFETY_STATES.SAFE);
      expect(r.transitioned).toBe(true);
    });

    test('LOCKOUT + RESTART_AUTHORIZED (operator) stays LOCKOUT', () => {
      const r = transition(SAFETY_STATES.LOCKOUT, EVENT_TYPES.RESTART_AUTHORIZED, {
        physicalResetComplete: true,
        userRole: ROLES.OPERATOR,
        activeCriticalAlarms: 0,
      });
      expect(r.newState).toBe(SAFETY_STATES.LOCKOUT);
      expect(r.transitioned).toBe(false);
    });

    test('LOCKOUT + RESTART_AUTHORIZED (active alarms) stays LOCKOUT', () => {
      const r = transition(SAFETY_STATES.LOCKOUT, EVENT_TYPES.RESTART_AUTHORIZED, {
        physicalResetComplete: true,
        userRole: ROLES.SUPERVISOR,
        activeCriticalAlarms: 1,
      });
      expect(r.newState).toBe(SAFETY_STATES.LOCKOUT);
      expect(r.transitioned).toBe(false);
    });

    test('LOCKOUT + RESTART_AUTHORIZED (no physical reset) stays LOCKOUT', () => {
      const r = transition(SAFETY_STATES.LOCKOUT, EVENT_TYPES.RESTART_AUTHORIZED, {
        physicalResetComplete: false,
        userRole: ROLES.SUPERVISOR,
        activeCriticalAlarms: 0,
      });
      expect(r.newState).toBe(SAFETY_STATES.LOCKOUT);
      expect(r.transitioned).toBe(false);
    });
  });

  describe('error handling', () => {
    test('throws on invalid state', () => {
      expect(() => transition('BOGUS', EVENT_TYPES.ESTOP_ACTIVATED, {})).toThrow('Invalid state');
    });
    test('throws on invalid event type', () => {
      expect(() => transition(SAFETY_STATES.SAFE, 'BOGUS_EVENT', {})).toThrow('Invalid event type');
    });
  });
});

describe('SafetyEngine class', () => {
  test('starts in SAFE state', () => {
    const engine = new SafetyEngine();
    expect(engine.state).toBe(SAFETY_STATES.SAFE);
  });

  test('processEvent transitions and emits stateChange', () => {
    const engine = new SafetyEngine();
    const events = [];
    engine.on('stateChange', (e) => events.push(e));

    engine.processEvent(EVENT_TYPES.ESTOP_ACTIVATED, {});
    expect(engine.state).toBe(SAFETY_STATES.ESTOP_ACTIVE);
    expect(events).toHaveLength(1);
    expect(events[0].newState).toBe(SAFETY_STATES.ESTOP_ACTIVE);
  });

  test('processEvent does not emit when no transition', () => {
    const engine = new SafetyEngine();
    const events = [];
    engine.on('stateChange', (e) => events.push(e));

    engine.processEvent(EVENT_TYPES.PUMP_AUTHORIZED, {});
    expect(engine.state).toBe(SAFETY_STATES.SAFE);
    expect(events).toHaveLength(0);
  });

  test('reset() returns to SAFE', () => {
    const engine = new SafetyEngine();
    engine.processEvent(EVENT_TYPES.ESTOP_ACTIVATED, {});
    expect(engine.state).toBe(SAFETY_STATES.ESTOP_ACTIVE);
    engine.reset();
    expect(engine.state).toBe(SAFETY_STATES.SAFE);
  });
});

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
// Authorization
// ---------------------------------------------------------------------------
const { AuthorizationManager } = require('../core/authorization');

describe('AuthorizationManager', () => {
  test('rejects missing card UID', async () => {
    const auth = new AuthorizationManager({});
    const r = await auth.authorize(null, null);
    expect(r.authorized).toBe(false);
  });

  test('authorizes from cache', async () => {
    const auth = new AuthorizationManager({ cacheTtlMs: 60_000 });
    // Seed cache manually
    auth._cache.set('card-123', { userId: 'user-1', role: 'operator', pin: '1234', timestamp: Date.now() });

    const r = await auth.authorize('card-123', '1234');
    expect(r.authorized).toBe(true);
    expect(r.source).toBe('cache');
  });

  test('rejects wrong PIN from cache', async () => {
    const auth = new AuthorizationManager({ cacheTtlMs: 60_000 });
    auth._cache.set('card-123', { userId: 'user-1', role: 'operator', pin: '1234', timestamp: Date.now() });

    const r = await auth.authorize('card-123', '0000');
    expect(r.authorized).toBe(false);
  });

  test('authorizes from server and caches result', async () => {
    const mockClient = {
      post: jest.fn().mockResolvedValue({ authorized: true, user_id: 'user-2', role: 'supervisor' }),
      get: jest.fn(),
    };
    const auth = new AuthorizationManager({ networkClient: mockClient, cacheTtlMs: 60_000 });

    const r = await auth.authorize('card-456', '5678');
    expect(r.authorized).toBe(true);
    expect(r.source).toBe('server');
    expect(auth.cacheSize).toBe(1);
  });

  test('falls back to expired cache when server unreachable', async () => {
    const mockClient = {
      post: jest.fn().mockRejectedValue(new Error('timeout')),
      get: jest.fn(),
    };
    const auth = new AuthorizationManager({ networkClient: mockClient, cacheTtlMs: 1 });
    auth._cache.set('card-789', { userId: 'user-3', role: 'operator', pin: null, timestamp: Date.now() - 100_000 });

    const r = await auth.authorize('card-789');
    expect(r.authorized).toBe(true);
    expect(r.source).toBe('cache-offline');
  });

  test('refreshCache() loads users from server', async () => {
    const mockClient = {
      post: jest.fn(),
      get: jest.fn().mockResolvedValue([
        { card_uid: 'c1', user_id: 'u1', role: 'operator', pin: '1111' },
        { card_uid: 'c2', user_id: 'u2', role: 'supervisor', pin: '2222' },
      ]),
    };
    const auth = new AuthorizationManager({ networkClient: mockClient });
    await auth.refreshCache();
    expect(auth.cacheSize).toBe(2);
  });

  test('clearCache() empties the cache', () => {
    const auth = new AuthorizationManager({});
    auth._cache.set('x', { userId: '1', role: 'op', pin: null, timestamp: Date.now() });
    auth.clearCache();
    expect(auth.cacheSize).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------
const { TransactionManager } = require('../core/transaction');

describe('TransactionManager', () => {
  test('start, update, finalize lifecycle', async () => {
    const txm = new TransactionManager();
    const txId = txm.startTransaction('user-1', 'pump-1');
    expect(txId).toMatch(/^txn-/);

    txm.updateTransaction(txId, 12.5, 45.0);
    const tx = txm.getTransaction(txId);
    expect(tx.gallons).toBe(12.5);
    expect(tx.amount).toBe(45.0);
    expect(tx.status).toBe('in_progress');

    const finalized = await txm.finalizeTransaction(txId, { delayMs: 0 });
    expect(finalized.status).toBe('completed');
    expect(finalized.endTime).toBeTruthy();
  });

  test('updateTransaction throws for unknown txId', () => {
    const txm = new TransactionManager();
    expect(() => txm.updateTransaction('txn-unknown', 1, 1)).toThrow('not found');
  });

  test('finalizeTransaction throws for unknown txId', async () => {
    const txm = new TransactionManager();
    await expect(txm.finalizeTransaction('txn-unknown', { delayMs: 0 })).rejects.toThrow('not found');
  });

  test('getPendingTransactions returns completed unsynced', async () => {
    const txm = new TransactionManager();
    const txId = txm.startTransaction('user-1', 'pump-1');
    txm.updateTransaction(txId, 5.0, 20.0);
    await txm.finalizeTransaction(txId, { delayMs: 0 });

    const pending = txm.getPendingTransactions();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(txId);

    txm.markSynced(txId);
    expect(txm.getPendingTransactions()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Offline Buffer
// ---------------------------------------------------------------------------
const { OfflineBuffer } = require('../network/offline-buffer');

describe('OfflineBuffer', () => {
  test('enqueue increases pending count', () => {
    const buf = new OfflineBuffer();
    expect(buf.getPendingCount()).toBe(0);
    buf.enqueue('transaction', { id: 'tx-1' });
    buf.enqueue('event', { id: 'ev-1' });
    expect(buf.getPendingCount()).toBe(2);
  });

  test('flush sends items and removes them', async () => {
    const mockClient = {
      post: jest.fn().mockResolvedValue({}),
    };
    const buf = new OfflineBuffer({ networkClient: mockClient });
    buf.enqueue('transaction', { id: 'tx-1' });
    buf.enqueue('event', { id: 'ev-1' });

    const sent = await buf.flush();
    expect(sent).toBe(2);
    expect(buf.getPendingCount()).toBe(0);
    expect(mockClient.post).toHaveBeenCalledTimes(2);
  });

  test('flush retains items that fail to send', async () => {
    const mockClient = {
      post: jest.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('fail')),
    };
    const buf = new OfflineBuffer({ networkClient: mockClient });
    buf.enqueue('transaction', { id: 'tx-1' });
    buf.enqueue('event', { id: 'ev-1' });

    const sent = await buf.flush();
    expect(sent).toBe(1);
    expect(buf.getPendingCount()).toBe(1);
  });

  test('flush with no client returns 0', async () => {
    const buf = new OfflineBuffer();
    buf.enqueue('test', {});
    const sent = await buf.flush();
    expect(sent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------
const { HeartbeatService } = require('../network/heartbeat');

describe('HeartbeatService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('start and stop lifecycle', () => {
    const mockClient = { post: jest.fn().mockResolvedValue({}) };
    const hb = new HeartbeatService({
      networkClient: mockClient,
      sbcId: 'sbc-1',
      siteId: 'site-1',
      getState: () => ({ status: SBC_STATUS.OK, pumpState: 'idle', estopActive: false, tankAlarm: false }),
    });

    expect(hb.running).toBe(false);
    hb.start(5000);
    expect(hb.running).toBe(true);

    jest.advanceTimersByTime(5000);
    expect(mockClient.post).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5000);
    expect(mockClient.post).toHaveBeenCalledTimes(2);

    hb.stop();
    expect(hb.running).toBe(false);

    jest.advanceTimersByTime(10_000);
    expect(mockClient.post).toHaveBeenCalledTimes(2);
  });

  test('handles send failure gracefully', () => {
    const mockClient = { post: jest.fn().mockRejectedValue(new Error('offline')) };
    const hb = new HeartbeatService({
      networkClient: mockClient,
      sbcId: 'sbc-1',
      siteId: 'site-1',
      getState: () => ({}),
    });

    hb.start(1000);
    // Should not throw
    jest.advanceTimersByTime(1000);
    expect(mockClient.post).toHaveBeenCalled();
    hb.stop();
  });
});

// ---------------------------------------------------------------------------
// Network Client
// ---------------------------------------------------------------------------
const { NetworkClient } = require('../network/client');

describe('NetworkClient', () => {
  test('successful GET request', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: 'test' }),
    });
    const client = new NetworkClient({
      serverUrl: 'http://localhost:3000',
      apiKey: 'key-123',
      fetchFn: mockFetch,
    });

    const result = await client.get('/api/test');
    expect(result).toEqual({ data: 'test' });
    expect(client.online).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/test',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  test('successful POST request', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ ok: true }),
    });
    const client = new NetworkClient({
      serverUrl: 'http://localhost:3000',
      apiKey: 'key-123',
      fetchFn: mockFetch,
    });

    const result = await client.post('/api/data', { foo: 'bar' });
    expect(result).toEqual({ ok: true });
  });

  test('sets auth headers', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/plain' },
      text: () => Promise.resolve('ok'),
    });
    const client = new NetworkClient({
      serverUrl: 'http://localhost:3000',
      apiKey: 'my-key',
      jwt: 'my-jwt',
      fetchFn: mockFetch,
    });

    await client.get('/test');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-API-Key']).toBe('my-key');
    expect(headers['Authorization']).toBe('Bearer my-jwt');
  });

  test('retries on failure then goes offline', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('network error'));
    const client = new NetworkClient({
      serverUrl: 'http://localhost:3000',
      apiKey: 'key',
      fetchFn: mockFetch,
    });

    await expect(client.get('/fail')).rejects.toThrow('network error');
    expect(client.online).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(3); // MAX_RETRIES
  }, 15_000);
});

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------
const { Display } = require('../ui/display');

describe('Display', () => {
  let display;
  beforeEach(() => { display = new Display(); });

  test('showStatus sets current message', () => {
    display.showStatus('Pump Stopped');
    expect(display.currentMessage).toBe('Pump Stopped');
  });

  test('showAlert sets current message', () => {
    display.showAlert('E-Stop Active');
    expect(display.currentMessage).toBe('E-Stop Active');
  });

  test('showProgress clamps to 0-100', () => {
    display.showProgress(150);
    expect(display.currentProgress).toBe(100);
    display.showProgress(-5);
    expect(display.currentProgress).toBe(0);
  });

  test('clear resets state', () => {
    display.showStatus('Test');
    display.showProgress(50);
    display.clear();
    expect(display.currentMessage).toBe('');
    expect(display.currentProgress).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// GPIO Monitor
// ---------------------------------------------------------------------------
const { GpioMonitor } = require('../hardware/gpio');

describe('GpioMonitor', () => {
  test('readInput returns 0 for unknown pin', () => {
    const gpio = new GpioMonitor();
    expect(gpio.readInput(5)).toBe(0);
  });

  test('_setPin triggers stateChange event', () => {
    const gpio = new GpioMonitor({ debounceMs: 0 });
    const events = [];
    gpio.on('stateChange', (e) => events.push(e));

    gpio._setPin(0, 1);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ pin: 0, value: 1, previousValue: null });
    expect(gpio.readInput(0)).toBe(1);
  });

  test('_setPin debounces rapid changes', () => {
    const gpio = new GpioMonitor({ debounceMs: 1000 });
    const events = [];
    gpio.on('stateChange', (e) => events.push(e));

    gpio._setPin(0, 1);
    gpio._setPin(0, 0); // should be debounced
    expect(events).toHaveLength(1);
    expect(gpio.readInput(0)).toBe(1);
  });

  test('onStateChange callback fires', () => {
    const gpio = new GpioMonitor({ debounceMs: 0 });
    const calls = [];
    gpio.onStateChange(2, (e) => calls.push(e));

    gpio._setPin(2, 1);
    expect(calls).toHaveLength(1);
    expect(calls[0].pin).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Relay Controller
// ---------------------------------------------------------------------------
const { RelayController } = require('../hardware/relay');

describe('RelayController', () => {
  test('setRelay and getRelayState', () => {
    const relay = new RelayController();
    relay.setRelay('pump-1', true);
    expect(relay.getRelayState('pump-1')).toBe(1);

    relay.setRelay('pump-1', false);
    expect(relay.getRelayState('pump-1')).toBe(0);
  });

  test('allOff de-energizes all relays', () => {
    const relay = new RelayController();
    relay.setRelay('r1', true);
    relay.setRelay('r2', true);
    relay.allOff();
    expect(relay.getRelayState('r1')).toBe(0);
    expect(relay.getRelayState('r2')).toBe(0);
  });

  test('getRelayState returns 0 for unknown relay', () => {
    const relay = new RelayController();
    expect(relay.getRelayState('unknown')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// IGEM frame protocol
// ---------------------------------------------------------------------------
const { buildFrame, parseFrame, STX, ETX, CMD } = require('../core/igem');

describe('IGEM protocol', () => {
  test('buildFrame creates valid frame', () => {
    const frame = buildFrame(1, CMD.AUTHORIZE);
    expect(frame[0]).toBe(STX);
    expect(frame[1]).toBe(1);
    expect(frame[2]).toBe(CMD.AUTHORIZE);
    expect(frame[frame.length - 1]).toBe(ETX);
  });

  test('parseFrame decodes valid frame', () => {
    const frame = buildFrame(2, CMD.STATUS);
    const parsed = parseFrame(frame);
    expect(parsed).not.toBeNull();
    expect(parsed.pumpId).toBe(2);
    expect(parsed.cmd).toBe(CMD.STATUS);
  });

  test('parseFrame returns null for short buffer', () => {
    expect(parseFrame(Buffer.from([STX, ETX]))).toBeNull();
  });

  test('parseFrame returns null for invalid frame', () => {
    expect(parseFrame(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  test('buildFrame with payload', () => {
    const frame = buildFrame(3, CMD.DATA, 'test');
    const parsed = parseFrame(frame);
    expect(parsed.payload.toString()).toBe('test');
  });
});
