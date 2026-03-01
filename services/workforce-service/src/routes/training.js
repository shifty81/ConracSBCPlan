'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const Training = require('../../models/training');

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

router.use(apiLimiter);

// GET /modules — list available training modules
router.get('/modules', async (req, res) => {
  try {
    const modules = await Training.getModules(req.query.site_id);
    return res.json(modules);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /status/:employee_id — get training compliance status
router.get('/status/:employee_id', async (req, res) => {
  try {
    const status = await Training.getEmployeeStatus(req.params.employee_id);

    const summary = {
      employee_id: req.params.employee_id,
      total_modules: status.length,
      current: status.filter((s) => s.status === 'current').length,
      expiring_soon: status.filter((s) => s.status === 'expiring_soon').length,
      expired: status.filter((s) => s.status === 'expired').length,
      not_completed: status.filter((s) => s.status === 'not_completed').length,
      compliant: status.every((s) => s.status === 'current' || s.status === 'expiring_soon'),
      modules: status,
    };

    return res.json(summary);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /complete — record training completion
router.post('/complete', async (req, res) => {
  try {
    const { employee_id, module_id, digital_signature } = req.body;

    if (!employee_id || !module_id || !digital_signature) {
      return res.status(400).json({
        error: 'employee_id, module_id, and digital_signature are required',
      });
    }

    const record = await Training.recordCompletion(employee_id, module_id, digital_signature);
    if (!record) {
      return res.status(404).json({ error: 'Training module not found' });
    }

    return res.status(201).json(record);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /expired — list employees with expired certifications
router.get('/expired', async (req, res) => {
  try {
    const expired = await Training.getExpiredCertifications(req.query.site_id);
    return res.json(expired);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
