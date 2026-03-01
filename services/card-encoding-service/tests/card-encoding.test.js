'use strict';

jest.mock('../src/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}));

jest.mock('../pcsc', () => ({
  listReaders: jest.fn().mockResolvedValue(['HID OMNIKEY 5427CK']),
  readCard: jest.fn().mockResolvedValue({ card_uid: 'MOCK-UID-00000001', card_type: 'iCLASS SE' }),
  encodeCard: jest.fn().mockResolvedValue({ success: true, card_uid: 'MOCK-UID-00000001' }),
}));

const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/db');

describe('Card Encoding Service', () => {
  beforeEach(() => {
    pool.query.mockClear();
  });

  describe('GET /health', () => {
    it('should return 200 with service status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok', service: 'card-encoding-service' });
    });
  });

  describe('POST /api/cards/encode', () => {
    it('should encode a card and return the card record', async () => {
      const res = await request(app)
        .post('/api/cards/encode')
        .send({
          user_rfid: 'RFID-001',
          facility_code: '42',
          card_number: '00001',
          user_data: {
            full_name: 'Jane Doe',
            company_id: 'HERTZ',
            vehicle_plate: '7ABC123',
            role: 'operator',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.user_rfid).toBe('RFID-001');
      expect(res.body.card_uid).toBe('MOCK-UID-00000001');
      expect(res.body.facility_code).toBe('42');
      expect(res.body.card_number).toBe('00001');
      expect(res.body.active).toBe(true);
      expect(res.body.user_data.full_name).toBe('Jane Doe');
    });

    it('should write an audit log entry on encode', async () => {
      await request(app)
        .post('/api/cards/encode')
        .send({
          user_rfid: 'RFID-AUDIT',
          facility_code: '42',
          card_number: '00002',
        });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_log'),
        expect.arrayContaining(['CARD_ENCODED', 'card', 'RFID-AUDIT'])
      );
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/cards/encode')
        .send({ user_rfid: 'RFID-001' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('user_rfid, facility_code, and card_number are required');
    });
  });

  describe('POST /api/cards/read', () => {
    it('should return card data from the reader', async () => {
      const res = await request(app)
        .post('/api/cards/read')
        .send({ reader_name: 'HID OMNIKEY 5427CK' });

      expect(res.status).toBe(200);
      expect(res.body.card_uid).toBe('MOCK-UID-00000001');
      expect(res.body.card_type).toBe('iCLASS SE');
      expect(res.body.facility_code).toBeDefined();
      expect(res.body.card_number).toBeDefined();
    });
  });

  describe('GET /api/cards/registry', () => {
    beforeEach(async () => {
      // Seed two cards
      await request(app)
        .post('/api/cards/encode')
        .send({
          user_rfid: 'RFID-LIST-001',
          facility_code: '42',
          card_number: '10001',
          user_data: { company_id: 'AVIS', site_id: 'SITE-A' },
        });
      await request(app)
        .post('/api/cards/encode')
        .send({
          user_rfid: 'RFID-LIST-002',
          facility_code: '42',
          card_number: '10002',
          user_data: { company_id: 'HERTZ', site_id: 'SITE-B' },
        });
    });

    it('should list all encoded cards', async () => {
      const res = await request(app).get('/api/cards/registry');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter cards by company_id', async () => {
      const res = await request(app).get('/api/cards/registry?company_id=AVIS');
      expect(res.status).toBe(200);
      const avisCards = res.body.filter((c) => c.user_data.company_id === 'AVIS');
      expect(avisCards.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter cards by active status', async () => {
      const res = await request(app).get('/api/cards/registry?active=true');
      expect(res.status).toBe(200);
      res.body.forEach((c) => expect(c.active).toBe(true));
    });
  });

  describe('GET /api/cards/registry/:user_rfid', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/cards/encode')
        .send({
          user_rfid: 'RFID-GET-001',
          facility_code: '42',
          card_number: '20001',
          user_data: { full_name: 'Test User' },
        });
    });

    it('should return a single card record', async () => {
      const res = await request(app).get('/api/cards/registry/RFID-GET-001');
      expect(res.status).toBe(200);
      expect(res.body.user_rfid).toBe('RFID-GET-001');
    });

    it('should return 404 for unknown user_rfid', async () => {
      const res = await request(app).get('/api/cards/registry/RFID-NOTFOUND');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Card not found');
    });
  });

  describe('PUT /api/cards/registry/:user_rfid', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/cards/encode')
        .send({
          user_rfid: 'RFID-PUT-001',
          facility_code: '42',
          card_number: '30001',
          user_data: { full_name: 'Original Name' },
        });
    });

    it('should update card user_data', async () => {
      const res = await request(app)
        .put('/api/cards/registry/RFID-PUT-001')
        .send({ user_data: { full_name: 'Updated Name' } });

      expect(res.status).toBe(200);
      expect(res.body.user_data.full_name).toBe('Updated Name');
    });

    it('should deactivate a card via active flag', async () => {
      const res = await request(app)
        .put('/api/cards/registry/RFID-PUT-001')
        .send({ active: false });

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
    });

    it('should return 404 for unknown user_rfid', async () => {
      const res = await request(app)
        .put('/api/cards/registry/RFID-NOTFOUND')
        .send({ active: false });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/cards/registry/:user_rfid', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/cards/encode')
        .send({
          user_rfid: 'RFID-DEL-001',
          facility_code: '42',
          card_number: '40001',
          user_data: { full_name: 'Delete Me' },
        });
    });

    it('should soft-delete (deactivate) a card', async () => {
      const res = await request(app).delete('/api/cards/registry/RFID-DEL-001');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Card deactivated');
      expect(res.body.user_rfid).toBe('RFID-DEL-001');

      // Verify it is deactivated
      const getRes = await request(app).get('/api/cards/registry/RFID-DEL-001');
      expect(getRes.body.active).toBe(false);
    });

    it('should write an audit log entry on deactivation', async () => {
      pool.query.mockClear();
      await request(app).delete('/api/cards/registry/RFID-DEL-001');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_log'),
        expect.arrayContaining(['CARD_DEACTIVATED', 'card', 'RFID-DEL-001'])
      );
    });

    it('should return 404 for unknown user_rfid', async () => {
      const res = await request(app).delete('/api/cards/registry/RFID-NOTFOUND');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/cards/readers', () => {
    it('should return list of connected readers', async () => {
      const res = await request(app).get('/api/cards/readers');
      expect(res.status).toBe(200);
      expect(res.body.readers).toEqual(['HID OMNIKEY 5427CK']);
    });
  });
});
