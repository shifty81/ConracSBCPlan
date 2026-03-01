'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const formRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'formforce-service' });
});

// Form routes
app.use('/api/forms', formRoutes);

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
    console.log(`FormForce service listening on port ${PORT}`);
  });
}

module.exports = app;
