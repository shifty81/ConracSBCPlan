'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { WORK_CATEGORIES } = require('../../../shared/constants');
const TimeEntry = require('../../models/time-entry');
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

const validCategories = Object.values(WORK_CATEGORIES);

// POST /clock-in
router.post('/clock-in', async (req, res) => {
  try {
    const { employee_id, site_id, work_category } = req.body;

    if (!employee_id || !site_id) {
      return res.status(400).json({ error: 'employee_id and site_id are required' });
    }

    if (work_category && !validCategories.includes(work_category)) {
      return res.status(400).json({
        error: `Invalid work_category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    // Block clock-in if mandatory training is expired
    const hasExpired = await Training.hasExpiredTraining(employee_id);
    if (hasExpired) {
      return res.status(403).json({
        error: 'Cannot clock in — mandatory training certifications are expired. Please complete required training first.',
      });
    }

    // Check if already clocked in
    const current = await TimeEntry.getCurrentStatus(employee_id);
    if (current) {
      return res.status(409).json({
        error: 'Already clocked in',
        current_entry: current,
      });
    }

    const entry = await TimeEntry.clockIn(employee_id, site_id, work_category || 'general');
    return res.status(201).json(entry);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /clock-out
router.post('/clock-out', async (req, res) => {
  try {
    const { entry_id, notes } = req.body;

    if (!entry_id) {
      return res.status(400).json({ error: 'entry_id is required' });
    }

    const entry = await TimeEntry.clockOut(entry_id, notes);
    if (!entry) {
      return res.status(404).json({ error: 'Time entry not found or already clocked out' });
    }

    return res.json(entry);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /status/:employee_id
router.get('/status/:employee_id', async (req, res) => {
  try {
    const current = await TimeEntry.getCurrentStatus(req.params.employee_id);
    return res.json({
      clocked_in: !!current,
      current_entry: current || null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /entries
router.get('/entries', async (req, res) => {
  try {
    const result = await TimeEntry.getEntries({
      employee_id: req.query.employee_id,
      site_id: req.query.site_id,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      per_page: req.query.per_page,
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
