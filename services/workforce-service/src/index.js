'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const timeclockRoutes = require('./routes/timeclock');
const tasksRoutes = require('./routes/tasks');
const trainingRoutes = require('./routes/training');
const payrollRoutes = require('./routes/payroll');

const app = express();
const PORT = process.env.PORT || 3007;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'workforce-service' });
});

// Mount routes
app.use('/api/workforce/timeclock', timeclockRoutes);
app.use('/api/workforce/tasks', tasksRoutes);
app.use('/api/workforce/training', trainingRoutes);
app.use('/api/workforce/payroll', payrollRoutes);

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
    console.log(`Workforce service listening on port ${PORT}`);
  });
}

module.exports = app;
