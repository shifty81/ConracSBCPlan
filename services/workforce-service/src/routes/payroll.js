'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const TimeEntry = require('../../models/time-entry');

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

router.use(apiLimiter);

// GET /summary — payroll summary
router.get('/summary', async (req, res) => {
  try {
    const { employee_id, site_id, from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to date parameters are required' });
    }

    const summary = await TimeEntry.getSummary({ employee_id, site_id, from, to });
    return res.json(summary);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /export — CSV export
router.get('/export', async (req, res) => {
  try {
    const { employee_id, site_id, from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to date parameters are required' });
    }

    const summary = await TimeEntry.getSummary({ employee_id, site_id, from, to });

    const csvHeader = 'employee_id,site_id,clock_in,clock_out,work_category,hours,notes';
    const csvRows = summary.entries.map((e) => {
      const hours = e.clock_out
        ? ((new Date(e.clock_out) - new Date(e.clock_in)) / 3600000).toFixed(2)
        : '';
      const notes = (e.notes || '').replace(/"/g, '""');
      return `${e.employee_id},${e.site_id},${e.clock_in},${e.clock_out || ''},${e.work_category},${hours},"${notes}"`;
    });

    const csv = [csvHeader, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payroll_${from}_${to}.csv`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
