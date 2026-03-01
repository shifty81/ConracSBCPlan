'use strict';

const request = require('supertest');
const path = require('path');
const app = require('../server');

describe('Dashboard Server', () => {
  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('dashboard');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should not require authentication', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });
  });

  describe('Static File Serving', () => {
    it('should serve index.html at root', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toContain('NEXUS');
    });

    it('should serve styles.css', async () => {
      const res = await request(app).get('/styles.css');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/css/);
    });

    it('should serve app.js', async () => {
      const res = await request(app).get('/app.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/javascript/);
    });

    it('should fallback to index.html for SPA routes', async () => {
      const res = await request(app).get('/overview');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toContain('NEXUS');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers from helmet', async () => {
      const res = await request(app).get('/health');
      expect(res.headers).toHaveProperty('x-content-type-options');
    });
  });

  describe('Auth Module', () => {
    const auth = require('../auth/login');

    it('should export login function', () => {
      expect(typeof auth.login).toBe('function');
    });

    it('should export logout function', () => {
      expect(typeof auth.logout).toBe('function');
    });

    it('should export getToken function', () => {
      expect(typeof auth.getToken).toBe('function');
    });

    it('should export isAuthenticated function', () => {
      expect(typeof auth.isAuthenticated).toBe('function');
    });
  });

  describe('API Client Module', () => {
    const api = require('../services/api');

    it('should export get method', () => {
      expect(typeof api.get).toBe('function');
    });

    it('should export post method', () => {
      expect(typeof api.post).toBe('function');
    });

    it('should export getDevices method', () => {
      expect(typeof api.getDevices).toBe('function');
    });

    it('should export getEvents method', () => {
      expect(typeof api.getEvents).toBe('function');
    });

    it('should export getTransactions method', () => {
      expect(typeof api.getTransactions).toBe('function');
    });

    it('should export getTankStatus method', () => {
      expect(typeof api.getTankStatus).toBe('function');
    });

    it('should export getForms method', () => {
      expect(typeof api.getForms).toBe('function');
    });

    it('should export getVendors method', () => {
      expect(typeof api.getVendors).toBe('function');
    });

    it('should export getWorkforceStatus method', () => {
      expect(typeof api.getWorkforceStatus).toBe('function');
    });
  });
});
