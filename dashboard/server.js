'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:']
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'dashboard',
    timestamp: new Date().toISOString()
  });
});

app.use(express.static(path.join(__dirname, 'frontend')));

const spaLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const indexPath = path.join(__dirname, 'frontend', 'index.html');
app.get('*', spaLimiter, (_req, res) => {
  res.sendFile(indexPath);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`NEXUS Dashboard running on port ${PORT}`);
  });
}

module.exports = app;
