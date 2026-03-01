'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const deployRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'deployment-service' });
});

// Deployment routes
app.use('/api/deploy', deployRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Deployment service listening on port ${PORT}`);
  });
}

module.exports = app;
