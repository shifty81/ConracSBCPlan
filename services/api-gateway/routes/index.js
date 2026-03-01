const { createProxyMiddleware } = require('http-proxy-middleware');
const { authLimiter, telemetryLimiter } = require('../middleware/rate-limit');
const dashboardRouter = require('./dashboard');

const SERVICE_MAP = {
  '/api/auth': 'http://auth-service:3001',
  '/api/telemetry': 'http://telemetry-service:3002',
  '/api/events': 'http://event-engine:3003',
  '/api/deploy': 'http://deployment-service:3004',
  '/api/forms': 'http://forms-service:3005',
  '/api/vendors': 'http://vendor-service:3006',
  '/api/workforce': 'http://workforce-service:3007',
  '/api/cards': 'http://card-encoding-service:3008',
};

function createServiceProxy(target, pathPrefix) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { [`^${pathPrefix}`]: '' },
    on: {
      error(err, req, res) {
        if (!res.headersSent) {
          res.status(503).json({
            error: 'Service temporarily unavailable',
            service: pathPrefix.replace('/api/', ''),
          });
        }
      },
    },
  });
}

function mountRoutes(app) {
  // Auth routes with stricter rate limit
  app.use('/api/auth', authLimiter, createServiceProxy(SERVICE_MAP['/api/auth'], '/api/auth'));

  // Telemetry routes with higher rate limit for SBC heartbeats
  app.use('/api/telemetry', telemetryLimiter, createServiceProxy(SERVICE_MAP['/api/telemetry'], '/api/telemetry'));

  // Event engine routes
  app.use('/api/events', createServiceProxy(SERVICE_MAP['/api/events'], '/api/events'));

  // Deployment service routes
  app.use('/api/deploy', createServiceProxy(SERVICE_MAP['/api/deploy'], '/api/deploy'));

  // Forms & Inspections service routes
  app.use('/api/forms', createServiceProxy(SERVICE_MAP['/api/forms'], '/api/forms'));

  // Vendor management service routes
  app.use('/api/vendors', createServiceProxy(SERVICE_MAP['/api/vendors'], '/api/vendors'));

  // Workforce service routes
  app.use('/api/workforce', createServiceProxy(SERVICE_MAP['/api/workforce'], '/api/workforce'));

  // Card encoding service routes
  app.use('/api/cards', createServiceProxy(SERVICE_MAP['/api/cards'], '/api/cards'));

  // Dashboard routes (direct handlers, not proxied)
  app.use('/api/dashboard', dashboardRouter);
}

module.exports = mountRoutes;
