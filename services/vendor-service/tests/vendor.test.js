'use strict';

describe('Vendor Service', () => {
  let app;
  const request = require('supertest');

  beforeAll(() => {
    jest.mock('../src/db', () => ({
      query: jest.fn(),
    }));

    const pool = require('../src/db');

    pool.query.mockImplementation((sql, params) => {
      // POST / — insert vendor
      if (sql.includes('INSERT INTO vendors')) {
        return {
          rows: [{
            id: 1,
            vendor_id: params[0],
            company_name: params[1],
            contact_name: params[2],
            contact_phone: params[3],
            contact_email: params[4],
            trade_type: params[5],
            insurance_expiry: params[6],
            site_id: params[7],
            active: true,
          }],
        };
      }

      // GET / — list vendors
      if (sql.includes('SELECT * FROM vendors') && sql.includes('ORDER BY company_name')) {
        return {
          rows: [
            { id: 1, vendor_id: 'VND-001', company_name: 'Acme Corp', site_id: 'SITE-001', active: true },
            { id: 2, vendor_id: 'VND-002', company_name: 'Beta LLC', site_id: 'SITE-001', active: true },
          ],
        };
      }

      // GET /:vendor_id — single vendor lookup (also used by check-in)
      if (sql.includes('SELECT * FROM vendors WHERE vendor_id')) {
        const vendorId = params[0];
        if (vendorId === 'VND-EXPIRED') {
          return {
            rows: [{
              id: 3,
              vendor_id: 'VND-EXPIRED',
              company_name: 'Expired Inc',
              site_id: 'SITE-001',
              active: true,
              insurance_expiry: '2020-01-01',
            }],
          };
        }
        if (vendorId === 'VND-NOTFOUND') {
          return { rows: [] };
        }
        return {
          rows: [{
            id: 1,
            vendor_id: vendorId,
            company_name: 'Acme Corp',
            site_id: 'SITE-001',
            active: true,
            insurance_expiry: '2099-12-31',
          }],
        };
      }

      // INSERT vendor visit
      if (sql.includes('INSERT INTO vendor_visits')) {
        return {
          rows: [{
            id: 1,
            vendor_id: params[0],
            site_id: params[1],
            check_in_time: new Date().toISOString(),
            purpose: params[2],
            work_area: params[3],
            badge_number: params[4],
          }],
        };
      }

      // INSERT service order
      if (sql.includes('INSERT INTO service_orders')) {
        return {
          rows: [{
            id: 1,
            order_number: params[0],
            vendor_id: params[1],
            site_id: params[2],
            system_type: params[3],
            description: params[4],
            status: params[5],
          }],
        };
      }

      // GET /orders — list orders
      if (sql.includes('SELECT * FROM service_orders') && sql.includes('ORDER BY created_at')) {
        return {
          rows: [
            { id: 1, order_number: 'SO-001', vendor_id: 'VND-001', site_id: 'SITE-001', status: 'open' },
          ],
        };
      }

      // PUT /orders/:order_number — update order
      if (sql.includes('UPDATE service_orders')) {
        if (params[8] === 'SO-NOTFOUND') {
          return { rows: [] };
        }
        return {
          rows: [{
            id: 1,
            order_number: params[8],
            status: params[0] || 'open',
            labor_hours: params[1],
            parts_cost: params[2],
            total_cost: params[3],
          }],
        };
      }

      return { rows: [] };
    });

    app = require('../src/index');
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // Health check
  it('should return 200 on health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'vendor-service' });
  });

  // POST / — create vendor
  it('should create a vendor', async () => {
    const res = await request(app)
      .post('/api/vendors')
      .send({ vendor_id: 'VND-001', company_name: 'Acme Corp', site_id: 'SITE-001' });
    expect(res.status).toBe(201);
    expect(res.body.vendor_id).toBe('VND-001');
    expect(res.body.company_name).toBe('Acme Corp');
  });

  it('should return 400 when creating vendor without required fields', async () => {
    const res = await request(app)
      .post('/api/vendors')
      .send({ vendor_id: 'VND-001' });
    expect(res.status).toBe(400);
  });

  // GET / — list vendors
  it('should list vendors', async () => {
    const res = await request(app).get('/api/vendors');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  // POST /visits/check-in — validates input
  it('should return 400 for check-in with missing fields', async () => {
    const res = await request(app)
      .post('/api/vendors/visits/check-in')
      .send({ vendor_id: 'VND-001' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  // POST /visits/check-in — rejects expired insurance
  it('should reject check-in for vendor with expired insurance', async () => {
    const res = await request(app)
      .post('/api/vendors/visits/check-in')
      .send({
        vendor_id: 'VND-EXPIRED',
        site_id: 'SITE-001',
        purpose: 'Repair',
        work_area: 'Building A',
        badge_number: 'B-100',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Vendor insurance has expired');
  });

  // POST /visits/check-in — success
  it('should check in a vendor with valid data', async () => {
    const res = await request(app)
      .post('/api/vendors/visits/check-in')
      .send({
        vendor_id: 'VND-001',
        site_id: 'SITE-001',
        purpose: 'Scheduled maintenance',
        work_area: 'Pump Station 3',
        badge_number: 'B-200',
      });
    expect(res.status).toBe(201);
    expect(res.body.vendor_id).toBe('VND-001');
  });

  // POST /orders — validates input
  it('should return 400 for order with missing fields', async () => {
    const res = await request(app)
      .post('/api/vendors/orders')
      .send({ vendor_id: 'VND-001' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  // POST /orders — success
  it('should create a service order', async () => {
    const res = await request(app)
      .post('/api/vendors/orders')
      .send({
        order_number: 'SO-001',
        vendor_id: 'VND-001',
        site_id: 'SITE-001',
        system_type: 'fuel',
        description: 'Pump repair',
      });
    expect(res.status).toBe(201);
    expect(res.body.order_number).toBe('SO-001');
  });

  // GET /orders — list orders with filters
  it('should list orders', async () => {
    const res = await request(app).get('/api/vendors/orders?site_id=SITE-001');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // PUT /orders/:order_number — update status
  it('should update an order status', async () => {
    const res = await request(app)
      .put('/api/vendors/orders/SO-001')
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.order_number).toBe('SO-001');
  });

  it('should return 400 for invalid order status', async () => {
    const res = await request(app)
      .put('/api/vendors/orders/SO-001')
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid status');
  });
});
