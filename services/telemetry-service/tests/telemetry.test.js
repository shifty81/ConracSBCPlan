'use strict';

const request = require('supertest');
const { validateHeartbeat, validateTransaction, validateEvent, validateTankStatus } = require('../../../shared/schemas');

// Mock the database pool
jest.mock('../src/db', () => {
  const mockQuery = jest.fn();
  return { query: mockQuery, end: jest.fn() };
});

const pool = require('../src/db');

// Helpers to build valid payloads
const validHeartbeat = () => ({
  sbc_id: 'sbc-001',
  site_id: 'site-lax-01',
  timestamp: new Date().toISOString(),
  status: 'OK',
  pump_state: 'idle',
  estop_active: false,
  tank_alarm: false,
});

const validTransaction = () => ({
  sbc_id: 'sbc-001',
  site_id: 'site-lax-01',
  transaction_id: 'txn-20260301-abc123',
  user_rfid: 'rfid-0042',
  pump_id: 'pump-02',
  start_time: '2026-03-01T08:00:00Z',
  end_time: '2026-03-01T08:05:00Z',
  gallons: 12.5,
});

const validEvent = () => ({
  sbc_id: 'sbc-001',
  site_id: 'site-lax-01',
  timestamp: new Date().toISOString(),
  event_type: 'ESTOP_ACTIVATED',
  details: { reason: 'manual trigger' },
});

const validTankStatus = () => ({
  device_id: 'tank-monitor-01',
  site_id: 'site-lax-01',
  timestamp: new Date().toISOString(),
  level_gallons: 5000,
  capacity_gallons: 10000,
  temperature_f: 72.5,
  status: 'normal',
});

// ---- Schema Validation Tests ----

describe('Schema Validation', () => {
  describe('validateHeartbeat', () => {
    test('accepts valid heartbeat', () => {
      expect(validateHeartbeat(validHeartbeat())).toEqual({ valid: true });
    });

    test('rejects missing sbc_id', () => {
      const data = validHeartbeat();
      delete data.sbc_id;
      const result = validateHeartbeat(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('sbc_id')]));
    });

    test('rejects non-boolean estop_active', () => {
      const data = validHeartbeat();
      data.estop_active = 'yes';
      const result = validateHeartbeat(data);
      expect(result.valid).toBe(false);
    });

    test('rejects null input', () => {
      expect(validateHeartbeat(null).valid).toBe(false);
    });
  });

  describe('validateTransaction', () => {
    test('accepts valid transaction', () => {
      expect(validateTransaction(validTransaction())).toEqual({ valid: true });
    });

    test('rejects zero gallons', () => {
      const data = validTransaction();
      data.gallons = 0;
      const result = validateTransaction(data);
      expect(result.valid).toBe(false);
    });

    test('rejects negative gallons', () => {
      const data = validTransaction();
      data.gallons = -5;
      expect(validateTransaction(data).valid).toBe(false);
    });

    test('rejects missing pump_id', () => {
      const data = validTransaction();
      delete data.pump_id;
      expect(validateTransaction(data).valid).toBe(false);
    });
  });

  describe('validateEvent', () => {
    test('accepts valid event', () => {
      expect(validateEvent(validEvent())).toEqual({ valid: true });
    });

    test('rejects invalid event_type', () => {
      const data = validEvent();
      data.event_type = 'INVALID_TYPE';
      expect(validateEvent(data).valid).toBe(false);
    });

    test('rejects missing timestamp', () => {
      const data = validEvent();
      delete data.timestamp;
      expect(validateEvent(data).valid).toBe(false);
    });
  });

  describe('validateTankStatus', () => {
    test('accepts valid tank status', () => {
      expect(validateTankStatus(validTankStatus())).toEqual({ valid: true });
    });

    test('rejects missing level_gallons', () => {
      const data = validTankStatus();
      delete data.level_gallons;
      expect(validateTankStatus(data).valid).toBe(false);
    });

    test('rejects string temperature', () => {
      const data = validTankStatus();
      data.temperature_f = 'hot';
      expect(validateTankStatus(data).valid).toBe(false);
    });
  });
});

// ---- API Route Tests ----

describe('Telemetry API', () => {
  let app;

  beforeAll(() => {
    ({ app } = require('../src/index'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    test('returns ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('telemetry-service');
    });
  });

  describe('POST /api/telemetry/heartbeat', () => {
    test('returns 201 for valid heartbeat', async () => {
      const hbRow = { id: 1, ...validHeartbeat() };
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // previous status lookup
        .mockResolvedValueOnce({ rows: [hbRow] }) // insert heartbeat
        .mockResolvedValueOnce({ rows: [] }); // upsert sbc_devices

      const res = await request(app)
        .post('/api/telemetry/heartbeat')
        .send(validHeartbeat());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('returns 400 for invalid heartbeat', async () => {
      const res = await request(app)
        .post('/api/telemetry/heartbeat')
        .send({ sbc_id: 'sbc-001' }); // missing fields

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/telemetry/transaction', () => {
    test('returns 201 for valid transaction', async () => {
      const txnRow = { id: 1, ...validTransaction() };
      pool.query.mockResolvedValueOnce({ rows: [txnRow] });

      const res = await request(app)
        .post('/api/telemetry/transaction')
        .send(validTransaction());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('returns 400 for invalid transaction', async () => {
      const res = await request(app)
        .post('/api/telemetry/transaction')
        .send({ gallons: -1 });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/telemetry/event', () => {
    test('returns 201 for valid event', async () => {
      const eventRow = { id: 1, ...validEvent(), flagged: false };
      pool.query
        .mockResolvedValueOnce({ rows: [eventRow] }) // insert event
        .mockResolvedValueOnce({ rows: [] }); // flag update for critical

      const res = await request(app)
        .post('/api/telemetry/event')
        .send(validEvent());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('returns 400 for invalid event_type', async () => {
      const res = await request(app)
        .post('/api/telemetry/event')
        .send({ ...validEvent(), event_type: 'BOGUS' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/telemetry/tanks/status', () => {
    test('returns 201 for valid tank status', async () => {
      const tankRow = { id: 1, ...validTankStatus() };
      pool.query.mockResolvedValueOnce({ rows: [tankRow] });

      const res = await request(app)
        .post('/api/telemetry/tanks/status')
        .send(validTankStatus());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('returns 400 for missing device_id', async () => {
      const data = validTankStatus();
      delete data.device_id;

      const res = await request(app)
        .post('/api/telemetry/tanks/status')
        .send(data);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/telemetry/devices', () => {
    test('returns device list', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ sbc_id: 'sbc-001' }] });

      const res = await request(app).get('/api/telemetry/devices');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/telemetry/devices/:sbc_id/history', () => {
    test('returns heartbeat history', async () => {
      pool.query.mockResolvedValueOnce({ rows: [validHeartbeat()] });

      const res = await request(app).get('/api/telemetry/devices/sbc-001/history');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });
});
