'use strict';

const request = require('supertest');
const app = require('../src/index');

// Mock the database pool
jest.mock('../src/db', () => ({
  query: jest.fn(),
}));

const pool = require('../src/db');

afterEach(() => {
  jest.clearAllMocks();
});

describe('Workforce Service', () => {
  describe('GET /health', () => {
    it('returns ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('workforce-service');
    });
  });

  describe('404 handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/unknown');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });

  // ---- Time Clock ----
  describe('Time Clock', () => {
    describe('POST /api/workforce/timeclock/clock-in', () => {
      it('requires employee_id and site_id', async () => {
        const res = await request(app)
          .post('/api/workforce/timeclock/clock-in')
          .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/employee_id and site_id are required/);
      });

      it('rejects invalid work_category', async () => {
        const res = await request(app)
          .post('/api/workforce/timeclock/clock-in')
          .send({ employee_id: '1', site_id: 'S1', work_category: 'invalid' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid work_category/);
      });

      it('blocks clock-in when training is expired', async () => {
        // hasExpiredTraining query returns expired count > 0
        pool.query.mockResolvedValueOnce({ rows: [{ expired_count: '1' }] });

        const res = await request(app)
          .post('/api/workforce/timeclock/clock-in')
          .send({ employee_id: '1', site_id: 'S1', work_category: 'general' });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/training/i);
      });

      it('prevents double clock-in', async () => {
        // hasExpiredTraining: no expired
        pool.query.mockResolvedValueOnce({ rows: [{ expired_count: '0' }] });
        // getCurrentStatus: already clocked in
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, employee_id: '1' }] });

        const res = await request(app)
          .post('/api/workforce/timeclock/clock-in')
          .send({ employee_id: '1', site_id: 'S1', work_category: 'general' });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/Already clocked in/);
      });

      it('creates time entry on successful clock-in', async () => {
        const entry = { id: 10, employee_id: '1', site_id: 'S1', clock_in: '2024-01-01T08:00:00Z', work_category: 'hvac' };
        // hasExpiredTraining
        pool.query.mockResolvedValueOnce({ rows: [{ expired_count: '0' }] });
        // getCurrentStatus: not clocked in
        pool.query.mockResolvedValueOnce({ rows: [] });
        // clockIn
        pool.query.mockResolvedValueOnce({ rows: [entry] });

        const res = await request(app)
          .post('/api/workforce/timeclock/clock-in')
          .send({ employee_id: '1', site_id: 'S1', work_category: 'hvac' });
        expect(res.status).toBe(201);
        expect(res.body.id).toBe(10);
        expect(res.body.work_category).toBe('hvac');
      });
    });

    describe('POST /api/workforce/timeclock/clock-out', () => {
      it('requires entry_id', async () => {
        const res = await request(app)
          .post('/api/workforce/timeclock/clock-out')
          .send({});
        expect(res.status).toBe(400);
      });

      it('returns 404 if entry not found', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const res = await request(app)
          .post('/api/workforce/timeclock/clock-out')
          .send({ entry_id: 999 });
        expect(res.status).toBe(404);
      });

      it('clocks out successfully', async () => {
        const entry = { id: 10, clock_out: '2024-01-01T17:00:00Z' };
        pool.query.mockResolvedValueOnce({ rows: [entry] });

        const res = await request(app)
          .post('/api/workforce/timeclock/clock-out')
          .send({ entry_id: 10, notes: 'Done for the day' });
        expect(res.status).toBe(200);
        expect(res.body.clock_out).toBeTruthy();
      });
    });

    describe('GET /api/workforce/timeclock/status/:employee_id', () => {
      it('returns clocked-out status when no active entry', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const res = await request(app).get('/api/workforce/timeclock/status/emp1');
        expect(res.status).toBe(200);
        expect(res.body.clocked_in).toBe(false);
        expect(res.body.current_entry).toBeNull();
      });

      it('returns clocked-in status with current entry', async () => {
        const entry = { id: 5, employee_id: 'emp1', clock_in: '2024-01-01T08:00:00Z' };
        pool.query.mockResolvedValueOnce({ rows: [entry] });
        const res = await request(app).get('/api/workforce/timeclock/status/emp1');
        expect(res.status).toBe(200);
        expect(res.body.clocked_in).toBe(true);
        expect(res.body.current_entry.id).toBe(5);
      });
    });
  });

  // ---- Tasks ----
  describe('Tasks', () => {
    describe('POST /api/workforce/tasks', () => {
      it('requires site_id and title', async () => {
        const res = await request(app)
          .post('/api/workforce/tasks')
          .send({});
        expect(res.status).toBe(400);
      });

      it('creates a task', async () => {
        const task = { id: 1, site_id: 'S1', title: 'Fix pump', system_type: 'fuel', status: 'open' };
        pool.query.mockResolvedValueOnce({ rows: [task] });

        const res = await request(app)
          .post('/api/workforce/tasks')
          .send({ site_id: 'S1', title: 'Fix pump', system_type: 'fuel' });
        expect(res.status).toBe(201);
        expect(res.body.title).toBe('Fix pump');
      });

      it('rejects invalid system_type', async () => {
        const res = await request(app)
          .post('/api/workforce/tasks')
          .send({ site_id: 'S1', title: 'Fix pump', system_type: 'rockets' });
        expect(res.status).toBe(400);
      });
    });

    describe('GET /api/workforce/tasks/:id', () => {
      it('returns 404 for missing task', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const res = await request(app).get('/api/workforce/tasks/999');
        expect(res.status).toBe(404);
      });

      it('returns task details', async () => {
        const task = { id: 1, title: 'Fix pump' };
        pool.query.mockResolvedValueOnce({ rows: [task] });
        const res = await request(app).get('/api/workforce/tasks/1');
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Fix pump');
      });
    });

    describe('POST /api/workforce/tasks/:id/complete', () => {
      it('returns 404 if task not found', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const res = await request(app)
          .post('/api/workforce/tasks/999/complete')
          .send({ resolution: 'Fixed it' });
        expect(res.status).toBe(404);
      });

      it('rejects completing already-completed task', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] });
        const res = await request(app)
          .post('/api/workforce/tasks/1/complete')
          .send({ resolution: 'Fixed it' });
        expect(res.status).toBe(409);
      });

      it('completes task successfully', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'open' }] });
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed', resolution: 'Replaced part' }] });

        const res = await request(app)
          .post('/api/workforce/tasks/1/complete')
          .send({ resolution: 'Replaced part', notes: 'Took 2 hours' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('completed');
      });
    });
  });

  // ---- Training ----
  describe('Training', () => {
    describe('GET /api/workforce/training/modules', () => {
      it('returns training modules', async () => {
        const modules = [{ id: 1, title: 'Fire Safety' }];
        pool.query.mockResolvedValueOnce({ rows: modules });
        const res = await request(app).get('/api/workforce/training/modules');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
      });
    });

    describe('GET /api/workforce/training/status/:employee_id', () => {
      it('returns compliance status', async () => {
        const status = [
          { module_id: 1, title: 'Fire Safety', status: 'current' },
          { module_id: 2, title: 'HAZMAT', status: 'expired' },
        ];
        pool.query.mockResolvedValueOnce({ rows: status });

        const res = await request(app).get('/api/workforce/training/status/emp1');
        expect(res.status).toBe(200);
        expect(res.body.total_modules).toBe(2);
        expect(res.body.current).toBe(1);
        expect(res.body.expired).toBe(1);
        expect(res.body.compliant).toBe(false);
      });
    });

    describe('POST /api/workforce/training/complete', () => {
      it('requires all fields', async () => {
        const res = await request(app)
          .post('/api/workforce/training/complete')
          .send({ employee_id: '1' });
        expect(res.status).toBe(400);
      });

      it('records training completion', async () => {
        // getModules lookup
        pool.query.mockResolvedValueOnce({ rows: [{ renewal_period_days: 365 }] });
        // insert record
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, employee_id: 'emp1', module_id: 1 }] });

        const res = await request(app)
          .post('/api/workforce/training/complete')
          .send({ employee_id: 'emp1', module_id: 1, digital_signature: 'sig123' });
        expect(res.status).toBe(201);
      });
    });
  });

  // ---- Payroll ----
  describe('Payroll', () => {
    describe('GET /api/workforce/payroll/summary', () => {
      it('requires from and to dates', async () => {
        const res = await request(app).get('/api/workforce/payroll/summary');
        expect(res.status).toBe(400);
      });

      it('returns payroll summary', async () => {
        // total hours query
        pool.query.mockResolvedValueOnce({ rows: [{ total_hours: '45.50' }] });
        // hours by category
        pool.query.mockResolvedValueOnce({ rows: [{ work_category: 'hvac', hours: '20.00' }] });
        // entries
        pool.query.mockResolvedValueOnce({ rows: [{ id: 1, employee_id: 'emp1' }] });

        const res = await request(app)
          .get('/api/workforce/payroll/summary')
          .query({ from: '2024-01-01', to: '2024-01-07' });
        expect(res.status).toBe(200);
        expect(res.body.total_hours).toBe(45.5);
        expect(res.body.overtime_hours).toBe(5.5);
        expect(res.body.hours_by_category).toHaveLength(1);
      });
    });

    describe('GET /api/workforce/payroll/export', () => {
      it('returns CSV data', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ total_hours: '8.00' }] });
        pool.query.mockResolvedValueOnce({ rows: [] });
        pool.query.mockResolvedValueOnce({
          rows: [{
            employee_id: 'emp1',
            site_id: 'S1',
            clock_in: '2024-01-01T08:00:00Z',
            clock_out: '2024-01-01T16:00:00Z',
            work_category: 'hvac',
            notes: null,
          }],
        });

        const res = await request(app)
          .get('/api/workforce/payroll/export')
          .query({ from: '2024-01-01', to: '2024-01-07' });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.text).toContain('employee_id,site_id,clock_in');
        expect(res.text).toContain('emp1');
      });
    });
  });
});
