'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const { ROLES } = require('../../shared/constants');
const User = require('../models/user');
const { generateToken, authMiddleware, requireRole, JWT_EXPIRY } = require('../token/jwt');

const router = express.Router();

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findByUsername(username);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    return res.json({
      token,
      expires_in: JWT_EXPIRY,
      role: user.role,
      site_id: user.site_id,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users — admin only
router.post('/users', authMiddleware, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const { username, password, role, site_id, full_name, email } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password, and role are required' });
    }

    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const user = await User.create({ username, password, role, site_id, full_name, email });
    return res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users — admin and supervisor only
router.get('/users', authMiddleware, requireRole(ROLES.ADMIN, ROLES.SUPERVISOR), async (req, res) => {
  try {
    const siteId = req.query.site_id;
    const users = await User.list(siteId);
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
