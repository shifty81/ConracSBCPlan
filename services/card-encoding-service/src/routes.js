'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const pcsc = require('../pcsc');

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

router.use(apiLimiter);

// In-memory card registry (production would use a dedicated cards table)
const cardRegistry = new Map();

// Helper: log to audit_log table
async function auditLog(action, entityId, actor, details) {
  await pool.query(
    'INSERT INTO audit_log (action, entity_type, entity_id, actor, details, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
    [action, 'card', entityId, actor, JSON.stringify(details)]
  );
}

// POST /encode — Encode a new card
router.post('/encode', async (req, res) => {
  try {
    const { user_rfid, facility_code, card_number, user_data } = req.body;

    if (!user_rfid || !facility_code || !card_number) {
      return res.status(400).json({ error: 'user_rfid, facility_code, and card_number are required' });
    }

    const readerName = process.env.HID_READER_NAME || 'HID OMNIKEY 5427CK';
    const encodeResult = await pcsc.encodeCard(readerName, {
      facility_code,
      card_number,
      user_data,
    });

    const cardRecord = {
      user_rfid,
      card_uid: encodeResult.card_uid,
      facility_code,
      card_number,
      card_format: process.env.HID_CARD_FORMAT || 'H10301',
      user_data: user_data || {},
      active: true,
      encoded_at: new Date().toISOString(),
    };

    cardRegistry.set(user_rfid, cardRecord);

    await auditLog('CARD_ENCODED', user_rfid, req.body.actor || 'system', {
      facility_code,
      card_number,
      card_uid: encodeResult.card_uid,
    });

    return res.status(201).json(cardRecord);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /read — Read a card from the reader
router.post('/read', async (req, res) => {
  try {
    const { reader_name } = req.body;
    const readerName = reader_name || process.env.HID_READER_NAME || 'HID OMNIKEY 5427CK';

    const result = await pcsc.readCard(readerName);

    const facilityCode = process.env.HID_FACILITY_CODE || '42';
    const response = {
      card_uid: result.card_uid,
      card_type: result.card_type,
      facility_code: facilityCode,
      card_number: '00001',
    };

    await auditLog('CARD_READ', result.card_uid, req.body.actor || 'system', {
      reader_name: readerName,
    });

    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /registry — List all encoded cards
router.get('/registry', async (req, res) => {
  try {
    const { site_id, company_id, active } = req.query;
    let cards = Array.from(cardRegistry.values());

    if (site_id) {
      cards = cards.filter((c) => c.user_data && c.user_data.site_id === site_id);
    }
    if (company_id) {
      cards = cards.filter((c) => c.user_data && c.user_data.company_id === company_id);
    }
    if (active !== undefined) {
      const isActive = active === 'true';
      cards = cards.filter((c) => c.active === isActive);
    }

    return res.json(cards);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /registry/:user_rfid — Get single card record
router.get('/registry/:user_rfid', async (req, res) => {
  try {
    const card = cardRegistry.get(req.params.user_rfid);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }
    return res.json(card);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /registry/:user_rfid — Update card record
router.put('/registry/:user_rfid', async (req, res) => {
  try {
    const card = cardRegistry.get(req.params.user_rfid);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const { active, user_data } = req.body;

    if (active !== undefined) {
      card.active = active;
    }
    if (user_data) {
      card.user_data = { ...card.user_data, ...user_data };
    }

    cardRegistry.set(req.params.user_rfid, card);

    await auditLog('CARD_UPDATED', req.params.user_rfid, req.body.actor || 'system', {
      active: card.active,
      user_data: card.user_data,
    });

    return res.json(card);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /registry/:user_rfid — Deactivate a card (soft delete)
router.delete('/registry/:user_rfid', async (req, res) => {
  try {
    const card = cardRegistry.get(req.params.user_rfid);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    card.active = false;
    cardRegistry.set(req.params.user_rfid, card);

    await auditLog('CARD_DEACTIVATED', req.params.user_rfid, req.body.actor || 'system', {
      card_uid: card.card_uid,
    });

    return res.json({ message: 'Card deactivated', user_rfid: req.params.user_rfid });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /readers — List connected PC/SC readers
router.get('/readers', async (req, res) => {
  try {
    const readers = await pcsc.listReaders();
    return res.json({ readers });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
