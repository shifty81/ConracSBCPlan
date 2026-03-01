'use strict';

const { createLogger } = require('../../shared/logging');

const logger = createLogger('sbc-client');

/**
 * Console-based display module for the 5.7″ monochrome qVGA screen.
 * In production, this would drive the actual HDMI/eDP display hardware.
 * For now it outputs to stdout with structured formatting.
 */
class Display {
  constructor() {
    this._currentMessage = '';
    this._currentProgress = -1;
  }

  /** Display a status message. */
  showStatus(message) {
    this._currentMessage = message;
    this._currentProgress = -1;
    logger.info('DISPLAY', { message });
    if (typeof process.stdout.write === 'function') {
      process.stdout.write(`[STATUS] ${message}\n`);
    }
  }

  /** Display a progress bar (0–100). */
  showProgress(percent) {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    this._currentProgress = clamped;
    const bar = '█'.repeat(Math.floor(clamped / 5)) + '░'.repeat(20 - Math.floor(clamped / 5));
    if (typeof process.stdout.write === 'function') {
      process.stdout.write(`[PROGRESS] ${bar} ${clamped}%\n`);
    }
  }

  /** Display an alert with emphasis. */
  showAlert(message) {
    this._currentMessage = message;
    this._currentProgress = -1;
    logger.warn('DISPLAY ALERT', { message });
    if (typeof process.stdout.write === 'function') {
      process.stdout.write(`[ALERT] *** ${message} ***\n`);
    }
  }

  /** Clear the display. */
  clear() {
    this._currentMessage = '';
    this._currentProgress = -1;
  }

  /** Get current display state (for testing). */
  get currentMessage() {
    return this._currentMessage;
  }

  get currentProgress() {
    return this._currentProgress;
  }
}

module.exports = { Display };
