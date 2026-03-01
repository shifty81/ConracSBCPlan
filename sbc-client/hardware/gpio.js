'use strict';

const EventEmitter = require('events');
const { createLogger } = require('../../shared/logging');

const logger = createLogger('sbc-client');

const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_DEBOUNCE_MS = 50;

/**
 * GPIO monitoring via ATmega32U4 Arduino coprocessor over serial (USB CDC).
 * Protocol: single-byte pin queries, single-byte responses (0/1).
 * Emits: 'stateChange' ({ pin, value }), 'error'
 */
class GpioMonitor extends EventEmitter {
  constructor({ debounceMs } = {}) {
    super();
    this._port = null;
    this._connected = false;
    this._debounceMs = debounceMs || DEFAULT_DEBOUNCE_MS;
    this._pinStates = new Map();
    this._lastChangeTime = new Map();
    this._callbacks = new Map();
    this._pollTimer = null;
    this._pollPins = [];
  }

  get connected() {
    return this._connected;
  }

  /**
   * Open serial connection to Arduino coprocessor.
   */
  async connect(portPath, opts = {}) {
    let SerialPort;
    try {
      SerialPort = require('serialport').SerialPort;
    } catch (_) {
      throw new Error('serialport module not available');
    }

    return new Promise((resolve, reject) => {
      this._port = new SerialPort({
        path: portPath,
        baudRate: opts.baudRate || 115200,
        autoOpen: false,
      });
      this._port.on('error', (err) => this.emit('error', err));
      this._port.open((err) => {
        if (err) return reject(err);
        this._connected = true;
        logger.info('GPIO Arduino connected', { port: portPath });
        resolve();
      });
    });
  }

  /**
   * Read a digital input pin. Returns 0 or 1.
   * For testing without hardware, reads from internal state map.
   */
  readInput(pin) {
    return this._pinStates.get(pin) || 0;
  }

  /**
   * Inject a pin value (used by polling or tests).
   * Applies debounce and fires callbacks/events on change.
   */
  _setPin(pin, value) {
    const now = Date.now();
    const lastChange = this._lastChangeTime.get(pin) || 0;
    if (now - lastChange < this._debounceMs) return;

    const prev = this._pinStates.get(pin);
    if (prev === value) return;

    this._pinStates.set(pin, value);
    this._lastChangeTime.set(pin, now);

    const event = { pin, value, previousValue: prev !== undefined ? prev : null };
    this.emit('stateChange', event);

    const cbs = this._callbacks.get(pin);
    if (cbs) {
      for (const cb of cbs) cb(event);
    }
  }

  /**
   * Register a callback for state changes on a specific pin.
   */
  onStateChange(pin, callback) {
    if (!this._callbacks.has(pin)) {
      this._callbacks.set(pin, []);
    }
    this._callbacks.get(pin).push(callback);
  }

  /**
   * Start periodic polling of registered pins.
   */
  startPolling(intervalMs, pins) {
    this._pollPins = pins || this._pollPins;
    const interval = intervalMs || DEFAULT_POLL_INTERVAL_MS;
    this.stopPolling();
    this._pollTimer = setInterval(() => {
      for (const pin of this._pollPins) {
        // In real hardware, we'd query Arduino here.
        // For now, state is set via _setPin (hardware driver or test).
      }
    }, interval);
  }

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  async disconnect() {
    this.stopPolling();
    if (this._port && this._port.isOpen) {
      return new Promise((resolve) => {
        this._port.close(() => {
          this._connected = false;
          resolve();
        });
      });
    }
    this._connected = false;
  }
}

module.exports = { GpioMonitor };
