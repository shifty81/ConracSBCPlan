'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const { createLogger } = require('../../shared/logging');

const logger = createLogger('telemetry-service');
const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'telemetry-service', timestamp: new Date().toISOString() });
});

// Telemetry routes
app.use('/api/telemetry', routes);

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    logger.info(`Telemetry service listening on port ${PORT}`);
  });
}

module.exports = { app };
