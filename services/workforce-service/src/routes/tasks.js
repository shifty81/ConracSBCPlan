'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { SYSTEM_TYPES, TASK_PRIORITY } = require('../../../shared/constants');
const Task = require('../../models/task');

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

router.use(apiLimiter);

const validSystemTypes = Object.values(SYSTEM_TYPES);
const validPriorities = Object.values(TASK_PRIORITY);

// POST / — create task
router.post('/', async (req, res) => {
  try {
    const { site_id, system_type, title, description, priority, assigned_to } = req.body;

    if (!site_id || !title) {
      return res.status(400).json({ error: 'site_id and title are required' });
    }

    if (system_type && !validSystemTypes.includes(system_type)) {
      return res.status(400).json({
        error: `Invalid system_type. Must be one of: ${validSystemTypes.join(', ')}`,
      });
    }

    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`,
      });
    }

    const task = await Task.create({ site_id, system_type, title, description, priority, assigned_to });
    return res.status(201).json(task);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / — list tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.list({
      site_id: req.query.site_id,
      status: req.query.status,
      assigned_to: req.query.assigned_to,
      system_type: req.query.system_type,
      page: req.query.page,
      per_page: req.query.per_page,
    });
    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id — get task details
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.getById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.json(task);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id — update task
router.put('/:id', async (req, res) => {
  try {
    if (req.body.system_type && !validSystemTypes.includes(req.body.system_type)) {
      return res.status(400).json({
        error: `Invalid system_type. Must be one of: ${validSystemTypes.join(', ')}`,
      });
    }

    if (req.body.priority && !validPriorities.includes(req.body.priority)) {
      return res.status(400).json({
        error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`,
      });
    }

    const task = await Task.update(req.params.id, req.body);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    return res.json(task);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/complete — quick-complete task
router.post('/:id/complete', async (req, res) => {
  try {
    const existing = await Task.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (existing.status === 'completed') {
      return res.status(409).json({ error: 'Task is already completed' });
    }

    const task = await Task.complete(req.params.id, {
      notes: req.body.notes,
      resolution: req.body.resolution,
      labor_hours: req.body.labor_hours,
    });
    return res.json(task);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
