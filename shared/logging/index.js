'use strict';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function createLogger(serviceName) {
  function getLevel() {
    const env = (process.env.LOG_LEVEL || 'info').toLowerCase();
    return LOG_LEVELS[env] !== undefined ? LOG_LEVELS[env] : LOG_LEVELS.info;
  }

  function log(level, message, meta) {
    if (LOG_LEVELS[level] < getLevel()) return;
    const entry = {
      timestamp: new Date().toISOString(),
      service: serviceName,
      level,
      message,
    };
    if (meta !== undefined) entry.meta = meta;
    const output = level === 'error' ? process.stderr : process.stdout;
    output.write(JSON.stringify(entry) + '\n');
  }

  return {
    debug: (message, meta) => log('debug', message, meta),
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
  };
}

module.exports = { createLogger };
