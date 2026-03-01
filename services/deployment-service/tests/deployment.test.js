'use strict';

const request = require('supertest');
const { hashApiKey, isHeartbeatStale, buildDeploymentSummary } = require('../update-manager');

// Mock the database pool
jest.mock('../src/db', () => {
  const mockPool = {
    query: jest.fn(),
  };
  return mockPool;
});

const pool = require('../src/db');
const app = require('../src/index');

beforeEach(() => {
  jest.clearAllMocks();
  // Clear in-memory updates store
  const routes = require('../src/routes');
  routes._updates.length = 0;
});

// --- Health Check ---

describe('GET /health', () => {
  it('returns 200 with service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'deployment-service' });
  });
});

// --- Device Management ---

describe('POST /api/deploy/devices', () => {
  it('registers a new device with hashed API key', async () => {
    const device = {
      sbc_id: 'sbc-001',
      site_id: 'site-a',
      api_key: 'my-secret-key',
      pump_id: 'pump-1',
      location_description: 'Bay 3',
    };

    const expectedHash = hashApiKey('my-secret-key');
    const mockRow = {
      sbc_id: 'sbc-001',
      site_id: 'site-a',
      pump_id: 'pump-1',
      location_description: 'Bay 3',
      api_key_hash: expectedHash,
      status: 'online',
      firmware_version: '1.0.0',
    };

    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const res = await request(app)
      .post('/api/deploy/devices')
      .send(device);

    expect(res.status).toBe(201);
    expect(res.body.sbc_id).toBe('sbc-001');
    expect(res.body.api_key_hash).toBe(expectedHash);

    // Verify the query used the hashed key, not the raw key
    const callArgs = pool.query.mock.calls[0];
    expect(callArgs[1]).toContain(expectedHash);
    expect(callArgs[1]).not.toContain('my-secret-key');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/deploy/devices')
      .send({ sbc_id: 'sbc-001' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('returns 409 on duplicate device', async () => {
    pool.query.mockRejectedValueOnce({ code: '23505' });

    const res = await request(app)
      .post('/api/deploy/devices')
      .send({ sbc_id: 'sbc-001', site_id: 'site-a', api_key: 'key' });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/deploy/devices', () => {
  it('lists all devices', async () => {
    const mockRows = [
      { sbc_id: 'sbc-001', site_id: 'site-a', status: 'online' },
      { sbc_id: 'sbc-002', site_id: 'site-b', status: 'offline' },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const res = await request(app).get('/api/deploy/devices');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters devices by site_id', async () => {
    const mockRows = [{ sbc_id: 'sbc-001', site_id: 'site-a', status: 'online' }];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const res = await request(app).get('/api/deploy/devices?site_id=site-a');
    expect(res.status).toBe(200);

    const callArgs = pool.query.mock.calls[0];
    expect(callArgs[0]).toContain('site_id = $1');
    expect(callArgs[1]).toContain('site-a');
  });

  it('filters devices by status', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/deploy/devices?status=offline');
    expect(res.status).toBe(200);

    const callArgs = pool.query.mock.calls[0];
    expect(callArgs[0]).toContain('status = $1');
    expect(callArgs[1]).toContain('offline');
  });
});

describe('GET /api/deploy/devices/:sbc_id', () => {
  it('returns device details', async () => {
    const mockRow = { sbc_id: 'sbc-001', firmware_version: '2.0.0', status: 'online' };
    pool.query.mockResolvedValueOnce({ rows: [mockRow] });

    const res = await request(app).get('/api/deploy/devices/sbc-001');
    expect(res.status).toBe(200);
    expect(res.body.sbc_id).toBe('sbc-001');
  });

  it('returns 404 for missing device', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/deploy/devices/nonexistent');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/deploy/devices/:sbc_id', () => {
  it('updates device details', async () => {
    const mockExisting = { sbc_id: 'sbc-001', status: 'online' };
    const mockUpdated = { sbc_id: 'sbc-001', status: 'offline', location_description: 'Bay 5' };

    pool.query
      .mockResolvedValueOnce({ rows: [mockExisting] })
      .mockResolvedValueOnce({ rows: [mockUpdated] });

    const res = await request(app)
      .put('/api/deploy/devices/sbc-001')
      .send({ status: 'offline', location_description: 'Bay 5' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('offline');
  });

  it('returns 404 for missing device', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/deploy/devices/nonexistent')
      .send({ status: 'offline' });

    expect(res.status).toBe(404);
  });
});

// --- Update Management ---

describe('POST /api/deploy/updates', () => {
  it('creates an update record', async () => {
    const res = await request(app)
      .post('/api/deploy/updates')
      .send({ version: '2.0.0', release_notes: 'Bug fixes', target_site_id: 'site-a' });

    expect(res.status).toBe(201);
    expect(res.body.version).toBe('2.0.0');
    expect(res.body.status).toBe('pending');
    expect(res.body.target_site).toBe('site-a');
    expect(res.body.update_id).toMatch(/^upd-/);
  });

  it('returns 400 when version is missing', async () => {
    const res = await request(app)
      .post('/api/deploy/updates')
      .send({ release_notes: 'No version' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/deploy/updates', () => {
  it('lists update packages', async () => {
    // Create an update first
    await request(app)
      .post('/api/deploy/updates')
      .send({ version: '2.0.0' });

    const res = await request(app).get('/api/deploy/updates');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].version).toBe('2.0.0');
  });
});

describe('POST /api/deploy/updates/:update_id/deploy', () => {
  it('deploys an update to devices', async () => {
    // Create update
    const createRes = await request(app)
      .post('/api/deploy/updates')
      .send({ version: '2.0.0', target_site_id: 'site-a' });

    const updateId = createRes.body.update_id;
    pool.query.mockResolvedValueOnce({ rowCount: 3 });

    const res = await request(app)
      .post(`/api/deploy/updates/${updateId}/deploy`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.devices_updated).toBe(3);
  });

  it('returns 404 for nonexistent update', async () => {
    const res = await request(app)
      .post('/api/deploy/updates/upd-fake/deploy');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/deploy/updates/:update_id/rollback', () => {
  it('rolls back a completed update', async () => {
    // Create and deploy an update
    const createRes = await request(app)
      .post('/api/deploy/updates')
      .send({ version: '2.0.0' });

    const updateId = createRes.body.update_id;
    pool.query.mockResolvedValueOnce({ rowCount: 3 }); // deploy
    await request(app).post(`/api/deploy/updates/${updateId}/deploy`);

    pool.query.mockResolvedValueOnce({ rowCount: 3 }); // rollback
    const res = await request(app)
      .post(`/api/deploy/updates/${updateId}/rollback`)
      .send({ previous_version: '1.0.0' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rolled_back');
    expect(res.body.devices_reverted).toBe(3);
  });

  it('returns 400 when previous_version is missing', async () => {
    const createRes = await request(app)
      .post('/api/deploy/updates')
      .send({ version: '2.0.0' });

    const updateId = createRes.body.update_id;
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    await request(app).post(`/api/deploy/updates/${updateId}/deploy`);

    const res = await request(app)
      .post(`/api/deploy/updates/${updateId}/rollback`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// --- Status ---

describe('GET /api/deploy/status', () => {
  it('returns deployment summary', async () => {
    const mockDevices = [
      { sbc_id: 'sbc-001', status: 'online', firmware_version: '2.0.0', last_heartbeat: new Date().toISOString() },
      { sbc_id: 'sbc-002', status: 'offline', firmware_version: '1.0.0', last_heartbeat: '2020-01-01T00:00:00Z' },
      { sbc_id: 'sbc-003', status: 'online', firmware_version: '2.0.0', last_heartbeat: new Date().toISOString() },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockDevices });

    const res = await request(app).get('/api/deploy/status');
    expect(res.status).toBe(200);
    expect(res.body.total_devices).toBe(3);
    expect(res.body.online).toBe(2);
    expect(res.body.offline).toBe(1);
    expect(res.body.by_firmware_version).toEqual({ '2.0.0': 2, '1.0.0': 1 });
    expect(res.body.stale_heartbeat_devices).toContain('sbc-002');
  });
});

// --- Update Manager Helpers ---

describe('update-manager helpers', () => {
  describe('hashApiKey', () => {
    it('produces consistent SHA-256 hex hash', () => {
      const hash1 = hashApiKey('test-key');
      const hash2 = hashApiKey('test-key');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it('produces different hashes for different keys', () => {
      expect(hashApiKey('key-a')).not.toBe(hashApiKey('key-b'));
    });
  });

  describe('isHeartbeatStale', () => {
    it('returns false for recent heartbeat', () => {
      const recent = new Date().toISOString();
      expect(isHeartbeatStale(recent)).toBe(false);
    });

    it('returns true for old heartbeat', () => {
      expect(isHeartbeatStale('2020-01-01T00:00:00Z')).toBe(true);
    });

    it('returns true for null heartbeat', () => {
      expect(isHeartbeatStale(null)).toBe(true);
    });

    it('returns true for invalid date', () => {
      expect(isHeartbeatStale('not-a-date')).toBe(true);
    });

    it('respects custom threshold', () => {
      const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
      expect(isHeartbeatStale(fiveSecondsAgo, 10)).toBe(false);
      expect(isHeartbeatStale(fiveSecondsAgo, 3)).toBe(true);
    });
  });

  describe('buildDeploymentSummary', () => {
    it('aggregates device stats correctly', () => {
      const devices = [
        { sbc_id: 'sbc-001', status: 'online', firmware_version: '2.0.0', last_heartbeat: new Date().toISOString() },
        { sbc_id: 'sbc-002', status: 'offline', firmware_version: '1.0.0', last_heartbeat: '2020-01-01T00:00:00Z' },
        { sbc_id: 'sbc-003', status: 'online', firmware_version: '2.0.0', last_heartbeat: new Date().toISOString() },
      ];

      const summary = buildDeploymentSummary(devices);
      expect(summary.total_devices).toBe(3);
      expect(summary.online).toBe(2);
      expect(summary.offline).toBe(1);
      expect(summary.by_firmware_version).toEqual({ '2.0.0': 2, '1.0.0': 1 });
      expect(summary.stale_heartbeat_devices).toEqual(['sbc-002']);
    });

    it('handles empty device list', () => {
      const summary = buildDeploymentSummary([]);
      expect(summary.total_devices).toBe(0);
      expect(summary.online).toBe(0);
      expect(summary.offline).toBe(0);
      expect(summary.by_firmware_version).toEqual({});
      expect(summary.stale_heartbeat_devices).toEqual([]);
    });
  });
});
