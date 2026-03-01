const request = require('supertest');
const jwt = require('jsonwebtoken');

const TEST_SECRET = 'test-jwt-secret-key';
process.env.JWT_SECRET = TEST_SECRET;

const app = require('../src/index');

function generateToken(payload = { userId: 1, role: 'admin' }) {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

describe('API Gateway', () => {
  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('api-gateway');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should not require authentication', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });
  });

  describe('Auth Middleware', () => {
    it('should reject requests without a token', async () => {
      const res = await request(app).get('/api/dashboard/overview');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/missing|malformed/i);
    });

    it('should reject requests with an invalid token', async () => {
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid|expired/i);
    });

    it('should accept requests with a valid token', async () => {
      const token = generateToken();
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${token}`);
      // Should not be 401 — may be another status if DB is unavailable
      expect(res.status).not.toBe(401);
    });

    it('should skip auth for /api/auth/login', async () => {
      const res = await request(app).post('/api/auth/login');
      // Should not be 401 (will be 503 since auth-service isn't running)
      expect(res.status).not.toBe(401);
    });

    it('should skip auth for /api/forms/webhook', async () => {
      const res = await request(app).post('/api/forms/webhook');
      expect(res.status).not.toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers).toHaveProperty('ratelimit-limit');
      expect(res.headers).toHaveProperty('ratelimit-remaining');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const token = generateToken();
      const res = await request(app)
        .get('/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });
});
