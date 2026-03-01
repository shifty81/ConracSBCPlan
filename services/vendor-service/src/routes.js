'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const { VENDOR_VISIT_STATUS, SERVICE_ORDER_STATUS } = require('../../shared/constants');
const { validateVendorCheckIn, validateServiceOrder } = require('../../shared/schemas');
const { generateId } = require('../../shared/utils');

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

router.use(apiLimiter);

// --------------- Vendors ---------------

// POST / — Register new vendor
router.post('/', async (req, res) => {
  try {
    const { company_name, site_id, contact_name, contact_phone, contact_email, trade_type, insurance_expiry } = req.body;
    const vendor_id = req.body.vendor_id || generateId('VND');

    if (!company_name || !site_id) {
      return res.status(400).json({ error: 'company_name and site_id are required' });
    }

    const result = await pool.query(
      `INSERT INTO vendors (vendor_id, company_name, contact_name, contact_phone, contact_email, trade_type, insurance_expiry, site_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [vendor_id, company_name, contact_name || null, contact_phone || null, contact_email || null, trade_type || null, insurance_expiry || null, site_id]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Vendor ID already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /insurance/expiring — List vendors with insurance expiring within N days
router.get('/insurance/expiring', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || parseInt(process.env.VENDOR_INSURANCE_WARNING_DAYS, 10) || 30;
    const result = await pool.query(
      `SELECT * FROM vendors
       WHERE active = true
         AND insurance_expiry IS NOT NULL
         AND insurance_expiry <= CURRENT_DATE + $1 * INTERVAL '1 day'
       ORDER BY insurance_expiry ASC`,
      [days]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / — List vendors
router.get('/', async (req, res) => {
  try {
    const conditions = [];
    const params = [];

    if (req.query.site_id) {
      params.push(req.query.site_id);
      conditions.push(`site_id = $${params.length}`);
    }
    if (req.query.active !== undefined) {
      params.push(req.query.active === 'true');
      conditions.push(`active = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM vendors ${where} ORDER BY company_name`, params);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --------------- Visits ---------------

// POST /visits/check-in — Check in vendor
router.post('/visits/check-in', async (req, res) => {
  try {
    const validation = validateVendorCheckIn(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }

    const { vendor_id, site_id, purpose, work_area, badge_number, vehicle_plate, escorted_by, notes } = req.body;

    // Check vendor exists and insurance is not expired
    const vendorResult = await pool.query('SELECT * FROM vendors WHERE vendor_id = $1', [vendor_id]);
    if (vendorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const vendor = vendorResult.rows[0];
    if (vendor.insurance_expiry) {
      const expiry = new Date(vendor.insurance_expiry);
      if (expiry < new Date()) {
        return res.status(400).json({ error: 'Vendor insurance has expired' });
      }
    }

    const result = await pool.query(
      `INSERT INTO vendor_visits (vendor_id, site_id, check_in_time, purpose, work_area, badge_number, vehicle_plate, escorted_by, notes)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [vendor_id, site_id, purpose, work_area, badge_number, vehicle_plate || null, escorted_by || null, notes || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /visits/:id/check-out — Check out vendor
router.post('/visits/:id/check-out', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vendor_visits SET check_out_time = NOW()
       WHERE id = $1 AND check_out_time IS NULL
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found or already checked out' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /visits — List visits
router.get('/visits', async (req, res) => {
  try {
    const conditions = [];
    const params = [];

    if (req.query.site_id) {
      params.push(req.query.site_id);
      conditions.push(`site_id = $${params.length}`);
    }
    if (req.query.vendor_id) {
      params.push(req.query.vendor_id);
      conditions.push(`vendor_id = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      conditions.push(`check_in_time >= $${params.length}`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      conditions.push(`check_in_time <= $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM vendor_visits ${where} ORDER BY check_in_time DESC`, params);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --------------- Service Orders ---------------

// POST /orders — Create service order
router.post('/orders', async (req, res) => {
  try {
    const validation = validateServiceOrder(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation failed', details: validation.errors });
    }

    const { order_number, vendor_id, site_id, system_type, description, priority, scheduled_date, notes } = req.body;
    const status = req.body.status || SERVICE_ORDER_STATUS.OPEN;

    const result = await pool.query(
      `INSERT INTO service_orders (order_number, vendor_id, site_id, system_type, description, status, priority, scheduled_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [order_number, vendor_id, site_id, system_type, description, status, priority || null, scheduled_date || null, notes || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Order number already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders — List orders
router.get('/orders', async (req, res) => {
  try {
    const conditions = [];
    const params = [];

    if (req.query.site_id) {
      params.push(req.query.site_id);
      conditions.push(`site_id = $${params.length}`);
    }
    if (req.query.vendor_id) {
      params.push(req.query.vendor_id);
      conditions.push(`vendor_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(`SELECT * FROM service_orders ${where} ORDER BY created_at DESC`, params);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /orders/:order_number — Get single order
router.get('/orders/:order_number', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM service_orders WHERE order_number = $1', [req.params.order_number]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service order not found' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /orders/:order_number — Update order
router.put('/orders/:order_number', async (req, res) => {
  try {
    const { status, labor_hours, parts_cost, total_cost, invoice_number, billing_verified, completed_date, notes } = req.body;

    if (status) {
      const validStatuses = Object.values(SERVICE_ORDER_STATUS);
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }
    }

    const result = await pool.query(
      `UPDATE service_orders SET
        status = COALESCE($1, status),
        labor_hours = COALESCE($2, labor_hours),
        parts_cost = COALESCE($3, parts_cost),
        total_cost = COALESCE($4, total_cost),
        invoice_number = COALESCE($5, invoice_number),
        billing_verified = COALESCE($6, billing_verified),
        completed_date = COALESCE($7, completed_date),
        notes = COALESCE($8, notes),
        updated_at = NOW()
       WHERE order_number = $9
       RETURNING *`,
      [status || null, labor_hours || null, parts_cost || null, total_cost || null, invoice_number || null, billing_verified !== undefined ? billing_verified : null, completed_date || null, notes || null, req.params.order_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service order not found' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --------------- Vendor by ID (must be after all specific routes) ---------------

// GET /:vendor_id — Get single vendor
router.get('/:vendor_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendors WHERE vendor_id = $1', [req.params.vendor_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:vendor_id — Update vendor details
router.put('/:vendor_id', async (req, res) => {
  try {
    const { company_name, contact_name, contact_phone, contact_email, trade_type, insurance_expiry, active, site_id } = req.body;

    const result = await pool.query(
      `UPDATE vendors SET
        company_name = COALESCE($1, company_name),
        contact_name = COALESCE($2, contact_name),
        contact_phone = COALESCE($3, contact_phone),
        contact_email = COALESCE($4, contact_email),
        trade_type = COALESCE($5, trade_type),
        insurance_expiry = COALESCE($6, insurance_expiry),
        active = COALESCE($7, active),
        site_id = COALESCE($8, site_id),
        updated_at = NOW()
       WHERE vendor_id = $9
       RETURNING *`,
      [company_name || null, contact_name || null, contact_phone || null, contact_email || null, trade_type || null, insurance_expiry || null, active !== undefined ? active : null, site_id || null, req.params.vendor_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
