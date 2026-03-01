'use strict';

const { createLogger } = require('../shared/logging');
const { SAFETY_STATES, EVENT_TYPES, SBC_STATUS, PUMP_STATES } = require('../shared/constants');
const { sleep } = require('../shared/utils');

const { SafetyEngine } = require('./safety-engine');
const { AuthorizationManager } = require('./core/authorization');
const { TransactionManager } = require('./core/transaction');
const { NetworkClient } = require('./network/client');
const { HeartbeatService } = require('./network/heartbeat');
const { OfflineBuffer } = require('./network/offline-buffer');
const { GpioMonitor } = require('./hardware/gpio');
const { RelayController } = require('./hardware/relay');
const { Display } = require('./ui/display');

const logger = createLogger('sbc-client');

// ---------------------------------------------------------------------------
// Configuration from environment
// ---------------------------------------------------------------------------
function loadConfig() {
  return {
    serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
    sbcId: process.env.SBC_ID || 'sbc-001',
    apiKey: process.env.API_KEY || '',
    siteId: process.env.SITE_ID || 'site-001',
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL, 10) || 30_000,
  };
}

// ---------------------------------------------------------------------------
// Main application
// ---------------------------------------------------------------------------
async function main() {
  const config = loadConfig();
  logger.info('SBC client starting', { sbcId: config.sbcId, siteId: config.siteId });

  // Initialize modules
  const safetyEngine = new SafetyEngine();
  const gpio = new GpioMonitor();
  const relay = new RelayController({ gpio });
  const display = new Display();

  const networkClient = new NetworkClient({
    serverUrl: config.serverUrl,
    apiKey: config.apiKey,
  });

  const authManager = new AuthorizationManager({ networkClient });
  const txManager = new TransactionManager();
  const offlineBuffer = new OfflineBuffer({ networkClient });

  const heartbeat = new HeartbeatService({
    networkClient,
    sbcId: config.sbcId,
    siteId: config.siteId,
    getState: () => ({
      status: safetyEngine.state === SAFETY_STATES.SAFE ? SBC_STATUS.OK
        : safetyEngine.state === SAFETY_STATES.ESTOP_ACTIVE ? SBC_STATUS.ESTOP
        : safetyEngine.state === SAFETY_STATES.ALARM_ACTIVE ? SBC_STATUS.ALARM
        : SBC_STATUS.OFFLINE,
      pumpState: PUMP_STATES.IDLE,
      estopActive: safetyEngine.state === SAFETY_STATES.ESTOP_ACTIVE || safetyEngine.state === SAFETY_STATES.LOCKOUT,
      tankAlarm: safetyEngine.state === SAFETY_STATES.ALARM_ACTIVE || safetyEngine.state === SAFETY_STATES.LOCKOUT,
    }),
  });

  // Safety engine drives relay and display
  safetyEngine.on('stateChange', (result) => {
    logger.info('Safety state changed', result);
    if (result.newState !== SAFETY_STATES.SAFE) {
      relay.allOff();
    }
    switch (result.newState) {
      case SAFETY_STATES.ESTOP_ACTIVE:
        display.showAlert('E-Stop Active');
        break;
      case SAFETY_STATES.ALARM_ACTIVE:
        display.showAlert('Tank Alarm Active');
        break;
      case SAFETY_STATES.LOCKOUT:
        display.showAlert('LOCKOUT — Supervisor Restart Required');
        break;
      case SAFETY_STATES.SAFE:
        display.showStatus('System Ready');
        break;
    }
  });

  // GPIO E-stop / alarm monitoring
  gpio.onStateChange(0, (e) => {
    // Pin 0 = E-stop input (active-high)
    if (e.value === 1) {
      safetyEngine.processEvent(EVENT_TYPES.ESTOP_ACTIVATED, {});
    }
  });
  gpio.onStateChange(1, (e) => {
    // Pin 1 = Tank alarm input (active-high)
    if (e.value === 1) {
      safetyEngine.processEvent(EVENT_TYPES.TANK_ALARM, { severity: 'high' });
    }
  });

  // Start heartbeat
  heartbeat.start(config.heartbeatInterval);

  // Refresh auth cache on startup
  await authManager.refreshCache();

  display.showStatus('System Ready');
  logger.info('SBC client initialized');

  // Nightly maintenance at 3 AM (runs once per day)
  let lastMaintenanceDate = '';
  const maintenanceTimer = setInterval(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (now.getHours() === 3 && lastMaintenanceDate !== today) {
      lastMaintenanceDate = today;
      logger.info('Nightly maintenance window');
      display.showStatus('Maintenance');
      offlineBuffer.flush().catch((err) => logger.error('Flush failed', { error: err.message }));
      authManager.refreshCache().catch((err) => logger.error('Cache refresh failed', { error: err.message }));
    }
  }, 60 * 60 * 1000); // check every hour

  // Start GPIO polling for E-stop and alarm pins
  gpio.startPolling(100, [0, 1]);

  // Graceful shutdown
  let shuttingDown = false;
  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down SBC client');
    heartbeat.stop();
    gpio.stopPolling();
    clearInterval(maintenanceTimer);
    relay.allOff();
    display.showStatus('Shutting Down');
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Keep alive
  return { safetyEngine, authManager, txManager, networkClient, heartbeat, offlineBuffer, gpio, relay, display, config, shutdown };
}

if (require.main === module) {
  main().catch((err) => {
    logger.error('Fatal error', { error: err.message });
    process.exit(1);
  });
}

module.exports = { main, loadConfig };
