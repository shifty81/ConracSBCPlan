const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const authMiddleware = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rate-limit');
const mountRoutes = require('../routes');

const app = express();
const PORT = process.env.PORT || 8080;

// Global middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(generalLimiter);

// Health check (before auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// Auth middleware
app.use(authMiddleware);

// Mount service routes
mountRoutes(app);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
  });
}

module.exports = app;
