'use strict';

const request = require('supertest');

// Mock the pg Pool before requiring the app
jest.mock('../src/db', () => {
  const mockQuery = jest.fn();
  return { query: mockQuery };
});

const pool = require('../src/db');
const app = require('../src/index');

beforeEach(() => {
  pool.query.mockReset();
});

describe('Health check', () => {
  it('GET /health returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('formforce-service');
  });
});

describe('POST /api/forms/submissions', () => {
  it('creates a new submission', async () => {
    const submission = {
      form_id: 'safety-checklist',
      site_id: 'SITE-01',
      submitted_by: 'operator1',
      data: { field1: 'value1' },
    };

    const dbRow = {
      id: 1,
      submission_id: 'form-20250101-abc123',
      ...submission,
      synced: false,
      created_at: '2025-01-01T00:00:00Z',
      timestamp: '2025-01-01T00:00:00Z',
    };

    pool.query.mockResolvedValueOnce({ rows: [dbRow] });

    const res = await request(app)
      .post('/api/forms/submissions')
      .send(submission);

    expect(res.status).toBe(201);
    expect(res.body.form_id).toBe('safety-checklist');
    expect(res.body.site_id).toBe('SITE-01');
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1][1]).toBe('safety-checklist');
  });

  it('returns 400 when form_id is missing', async () => {
    const res = await request(app)
      .post('/api/forms/submissions')
      .send({ site_id: 'SITE-01' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/form_id/);
  });
});

describe('GET /api/forms/submissions', () => {
  it('lists submissions with filters', async () => {
    const rows = [
      { id: 1, submission_id: 's1', form_id: 'f1', site_id: 'SITE-01', synced: false },
      { id: 2, submission_id: 's2', form_id: 'f1', site_id: 'SITE-01', synced: true },
    ];

    pool.query.mockResolvedValueOnce({ rows });

    const res = await request(app)
      .get('/api/forms/submissions?site_id=SITE-01&form_id=f1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(pool.query).toHaveBeenCalledTimes(1);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('site_id = $1');
    expect(sql).toContain('form_id = $2');
    expect(params).toEqual(['SITE-01', 'f1']);
  });
});

describe('POST /api/forms/webhook', () => {
  const WEBHOOK_SECRET = 'test-secret-key';

  beforeEach(() => {
    process.env.NEXUS_FORMS_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.NEXUS_FORMS_WEBHOOK_SECRET;
  });

  it('rejects requests with invalid secret', async () => {
    const res = await request(app)
      .post('/api/forms/webhook')
      .set('x-webhook-secret', 'wrong-secret')
      .send({ form_id: 'f1', site_id: 'SITE-01' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects requests with missing secret header', async () => {
    const res = await request(app)
      .post('/api/forms/webhook')
      .send({ form_id: 'f1', site_id: 'SITE-01' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('accepts valid secret and creates submission', async () => {
    const dbRow = {
      id: 1,
      submission_id: 'wh-20250101-abc123',
      form_id: 'incident-report',
      site_id: 'SITE-01',
      submitted_by: 'external-system',
      synced: false,
      timestamp: '2025-01-01T00:00:00Z',
      data: { source: 'webhook' },
    };

    pool.query.mockResolvedValueOnce({ rows: [dbRow] });

    const res = await request(app)
      .post('/api/forms/webhook')
      .set('x-webhook-secret', WEBHOOK_SECRET)
      .send({
        form_id: 'incident-report',
        site_id: 'SITE-01',
        submitted_by: 'external-system',
        data: { source: 'webhook' },
      });

    expect(res.status).toBe(201);
    expect(res.body.form_id).toBe('incident-report');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/forms/generate', () => {
  it('creates form from ESTOP_ACTIVATED event', async () => {
    const dbRow = {
      id: 1,
      submission_id: 'evt-20250101-abc123',
      form_id: 'estop-incident-report',
      site_id: 'SITE-01',
      submitted_by: 'system',
      synced: false,
      timestamp: '2025-01-01T00:00:00Z',
      data: { event_type: 'ESTOP_ACTIVATED', generated: true, details: { zone: 'A' } },
    };

    pool.query.mockResolvedValueOnce({ rows: [dbRow] });

    const res = await request(app)
      .post('/api/forms/generate')
      .send({
        event_type: 'ESTOP_ACTIVATED',
        site_id: 'SITE-01',
        details: { zone: 'A' },
      });

    expect(res.status).toBe(201);
    expect(res.body.form_id).toBe('estop-incident-report');
    expect(res.body.submitted_by).toBe('system');
    expect(pool.query).toHaveBeenCalledTimes(1);

    const [, params] = pool.query.mock.calls[0];
    expect(params[1]).toBe('estop-incident-report');
    expect(params[2]).toBe('SITE-01');
  });

  it('returns 400 for unknown event type', async () => {
    const res = await request(app)
      .post('/api/forms/generate')
      .send({ event_type: 'UNKNOWN_EVENT', site_id: 'SITE-01' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Unknown event type');
  });

  it('returns 400 when event_type is missing', async () => {
    const res = await request(app)
      .post('/api/forms/generate')
      .send({ site_id: 'SITE-01' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/forms/compliance/summary', () => {
  it('returns correct compliance summary', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: 10 }] })
      .mockResolvedValueOnce({ rows: [{ unsynced: 3 }] })
      .mockResolvedValueOnce({ rows: [{ form_id: 'f1', count: 7 }, { form_id: 'f2', count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ earliest: '2025-01-01T00:00:00Z', latest: '2025-01-31T00:00:00Z' }] });

    const res = await request(app)
      .get('/api/forms/compliance/summary?site_id=SITE-01');

    expect(res.status).toBe(200);
    expect(res.body.site_id).toBe('SITE-01');
    expect(res.body.total).toBe(10);
    expect(res.body.unsynced).toBe(3);
    expect(res.body.by_form).toHaveLength(2);
    expect(res.body.date_range.earliest).toBe('2025-01-01T00:00:00Z');
    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  it('returns 400 when site_id is missing', async () => {
    const res = await request(app)
      .get('/api/forms/compliance/summary');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/site_id/);
  });
});
