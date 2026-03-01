'use strict';

const { createLogger } = require('../../shared/logging');
const { SBC_STATUS } = require('../../shared/constants');

const logger = createLogger('sbc-client');

const SOFTWARE_VERSION = '1.0.0';

class HeartbeatService {
  /**
   * @param {object} opts
   * @param {import('./client').NetworkClient} opts.networkClient
   * @param {string} opts.sbcId
   * @param {string} opts.siteId
   * @param {function} opts.getState - returns current safety/pump state
   */
  constructor({ networkClient, sbcId, siteId, getState } = {}) {
    this._client = networkClient;
    this._sbcId = sbcId || '';
    this._siteId = siteId || '';
    this._getState = getState || (() => ({}));
    this._timer = null;
    this._running = false;
  }

  get running() {
    return this._running;
  }

  /**
   * Begin periodic heartbeat.
   * @param {number} intervalMs - heartbeat interval in milliseconds
   */
  start(intervalMs) {
    if (this._running) return;
    this._running = true;
    this._timer = setInterval(() => this._send(), intervalMs);
    logger.info('Heartbeat started', { intervalMs });
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._running = false;
    logger.info('Heartbeat stopped');
  }

  async _send() {
    const state = this._getState();
    const payload = {
      sbc_id: this._sbcId,
      site_id: this._siteId,
      timestamp: new Date().toISOString(),
      status: state.status || SBC_STATUS.OK,
      pump_state: state.pumpState || 'idle',
      estop_active: state.estopActive || false,
      tank_alarm: state.tankAlarm || false,
      software_version: SOFTWARE_VERSION,
    };

    try {
      await this._client.post('/api/telemetry/heartbeat', payload);
    } catch (err) {
      logger.warn('Heartbeat send failed', { error: err.message });
    }
  }
}

module.exports = { HeartbeatService };
