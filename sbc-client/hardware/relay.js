'use strict';

const { createLogger } = require('../../shared/logging');

const logger = createLogger('sbc-client');

/**
 * Relay control module. Uses GpioMonitor for actual hardware I/O.
 * Manages pump enable/disable relays.
 */
class RelayController {
  /**
   * @param {object} opts
   * @param {import('./gpio').GpioMonitor} [opts.gpio] - GPIO monitor instance
   */
  constructor({ gpio } = {}) {
    this._gpio = gpio || null;
    this._relayStates = new Map();
  }

  /**
   * Set a relay on or off.
   * @param {string|number} relayId
   * @param {boolean} state - true = energized/on, false = de-energized/off
   */
  setRelay(relayId, state) {
    const value = state ? 1 : 0;
    this._relayStates.set(relayId, value);

    if (this._gpio) {
      this._gpio._setPin(relayId, value);
    }

    logger.info('Relay set', { relayId, state: value });
    return value;
  }

  /**
   * Read current relay state.
   * @returns {number} 0 or 1
   */
  getRelayState(relayId) {
    return this._relayStates.get(relayId) || 0;
  }

  /** De-energize all relays (safety shutdown). */
  allOff() {
    for (const [id] of this._relayStates) {
      this.setRelay(id, false);
    }
  }
}

module.exports = { RelayController };
