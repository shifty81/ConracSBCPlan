'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

const jwt = require('jsonwebtoken');
const { generateToken, verifyToken, authMiddleware, requireRole, JWT_EXPIRY } = require('../token/jwt');

// Mock user for testing
const mockUser = {
  id: 1,
  username: 'testadmin',
  role: 'admin',
  site_id: 'SITE-001',
};

describe('JWT Utilities', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(mockUser);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include user data in the token payload', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.decode(token);
      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.username).toBe(mockUser.username);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.site_id).toBe(mockUser.site_id);
    });

    it('should not include sensitive data in the token', () => {
      const userWithPassword = { ...mockUser, password_hash: 'secret_hash' };
      const token = generateToken(userWithPassword);
      const decoded = jwt.decode(token);
      expect(decoded.password_hash).toBeUndefined();
    });

    it('should set an expiration on the token', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.decode(token);
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp - decoded.iat).toBe(JWT_EXPIRY);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return the payload', () => {
      const token = generateToken(mockUser);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.username).toBe(mockUser.username);
      expect(decoded.role).toBe(mockUser.role);
    });

    it('should throw on an invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow();
    });

    it('should throw on a tampered token', () => {
      const token = generateToken(mockUser);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyToken(tampered)).toThrow();
    });
  });
});

describe('authMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should return 401 if no Authorization header is present', () => {
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header does not start with Bearer', () => {
    req.headers.authorization = 'Basic abc123';
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for an invalid token', () => {
    req.headers.authorization = 'Bearer invalid.token';
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should attach user to req and call next for a valid token', () => {
    const token = generateToken(mockUser);
    req.headers.authorization = `Bearer ${token}`;
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(mockUser.id);
    expect(req.user.role).toBe(mockUser.role);
  });
});

describe('requireRole', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { role: 'operator' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should call next if user has an allowed role', () => {
    const middleware = requireRole('admin', 'operator');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 if user does not have an allowed role', () => {
    const middleware = requireRole('admin');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if req.user is not set', () => {
    req.user = undefined;
    const middleware = requireRole('admin');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// Test login validation via supertest with mocked DB
describe('Login Route', () => {
  let app;
  const bcrypt = require('bcrypt');

  beforeAll(async () => {
    // Mock the db pool before requiring routes
    jest.mock('../src/db', () => ({
      query: jest.fn(),
    }));

    const pool = require('../src/db');
    const passwordHash = await bcrypt.hash('correct-password', 10);

    pool.query.mockImplementation((sql, params) => {
      if (sql.includes('FROM users WHERE username')) {
        const username = params[0];
        if (username === 'validuser') {
          return {
            rows: [{
              id: 1,
              username: 'validuser',
              password_hash: passwordHash,
              role: 'admin',
              site_id: 'SITE-001',
              full_name: 'Valid User',
              email: 'valid@test.com',
              active: true,
            }],
          };
        }
        if (username === 'inactive') {
          return {
            rows: [{
              id: 2,
              username: 'inactive',
              password_hash: passwordHash,
              role: 'operator',
              site_id: 'SITE-001',
              full_name: 'Inactive User',
              email: 'inactive@test.com',
              active: false,
            }],
          };
        }
        return { rows: [] };
      }
      if (sql.includes('FROM users WHERE id')) {
        return {
          rows: [{
            id: 1,
            username: 'validuser',
            role: 'admin',
            site_id: 'SITE-001',
            full_name: 'Valid User',
            email: 'valid@test.com',
            active: true,
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

  const request = require('supertest');

  it('should return 400 if username or password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username and password are required');
  });

  it('should return 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'noone', password: 'pass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('should return 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'validuser', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('should return 401 for inactive user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'inactive', password: 'correct-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('should return token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'validuser', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.expires_in).toBe(JWT_EXPIRY);
    expect(res.body.role).toBe('admin');
    expect(res.body.site_id).toBe('SITE-001');
    // Ensure no password data leaked
    expect(res.body.password_hash).toBeUndefined();
    expect(res.body.password).toBeUndefined();
  });

  it('should return user info on GET /me with valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'validuser', password: 'correct-password' });
    const { token } = loginRes.body;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('validuser');
    expect(res.body.password_hash).toBeUndefined();
  });

  it('should return 401 on GET /me without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 200 on health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'auth-service' });
  });
});
