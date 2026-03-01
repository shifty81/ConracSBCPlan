'use strict';

const EventEmitter = require('events');
const { createLogger } = require('../../shared/logging');
const { PUMP_STATES } = require('../../shared/constants');

const logger = createLogger('sbc-client');

// IGEM 9-PID serial protocol constants
const STX = 0x02;
const ETX = 0x03;

const CMD = Object.freeze({
  AUTHORIZE: 0x41,  // 'A'
  STATUS:    0x53,  // 'S'
  STOP:      0x50,  // 'P' (stop/halt)
  DATA:      0x44,  // 'D' (transaction data from dispenser)
});

/**
 * Builds a framed IGEM command buffer: STX + pumpId + cmd + [payload] + ETX
 */
function buildFrame(pumpId, cmd, payload) {
  const pumpByte = typeof pumpId === 'number' ? pumpId : parseInt(pumpId, 10);
  const payloadBuf = payload ? Buffer.from(payload) : Buffer.alloc(0);
  const frame = Buffer.alloc(3 + payloadBuf.length);
  frame[0] = STX;
  frame[1] = pumpByte & 0xff;
  frame[2] = cmd;
  payloadBuf.copy(frame, 3);
  // Append ETX
  return Buffer.concat([frame, Buffer.from([ETX])]);
}

/**
 * Parse a response frame. Returns { pumpId, cmd, payload } or null.
 */
function parseFrame(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] !== STX || buffer[buffer.length - 1] !== ETX) return null;
  return {
    pumpId: buffer[1],
    cmd: buffer[2],
    payload: buffer.slice(3, buffer.length - 1),
  };
}

/**
 * IGEM 9-PID serial interface for fuel dispenser communication.
 * Emits: 'data' (transaction data), 'status' (pump status), 'error'
 */
class IgemInterface extends EventEmitter {
  constructor() {
    super();
    this._port = null;
    this._connected = false;
    this._rxBuffer = Buffer.alloc(0);
  }

  get connected() {
    return this._connected;
  }

  /**
   * Open serial connection to IGEM dispenser.
   * @param {string} portPath - e.g. '/dev/ttyUSB0' or 'COM3'
   * @param {object} [opts] - serialport options override
   */
  async connect(portPath, opts = {}) {
    // Dynamic require so tests can run without serialport hardware
    let SerialPort;
    try {
      SerialPort = require('serialport').SerialPort;
    } catch (_) {
      throw new Error('serialport module not available');
    }

    return new Promise((resolve, reject) => {
      this._port = new SerialPort({
        path: portPath,
        baudRate: opts.baudRate || 9600,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false,
      });

      this._port.on('data', (chunk) => this._onData(chunk));
      this._port.on('error', (err) => this.emit('error', err));

      this._port.open((err) => {
        if (err) {
          logger.error('IGEM serial open failed', { error: err.message });
          return reject(err);
        }
        this._connected = true;
        logger.info('IGEM serial connected', { port: portPath });
        resolve();
      });
    });
  }

  /** Internal: accumulate bytes and parse frames. */
  _onData(chunk) {
    this._rxBuffer = Buffer.concat([this._rxBuffer, chunk]);
    let etxIdx;
    while ((etxIdx = this._rxBuffer.indexOf(ETX)) !== -1) {
      const stxIdx = this._rxBuffer.indexOf(STX);
      if (stxIdx === -1 || stxIdx > etxIdx) {
        // Discard garbage before valid frame
        this._rxBuffer = this._rxBuffer.slice(etxIdx + 1);
        continue;
      }
      const frameBuf = this._rxBuffer.slice(stxIdx, etxIdx + 1);
      this._rxBuffer = this._rxBuffer.slice(etxIdx + 1);
      const frame = parseFrame(frameBuf);
      if (frame) {
        this._handleFrame(frame);
      }
    }
  }

  _handleFrame(frame) {
    if (frame.cmd === CMD.DATA) {
      this.emit('data', {
        pumpId: frame.pumpId,
        payload: frame.payload.toString('utf8'),
      });
    } else if (frame.cmd === CMD.STATUS) {
      const stateStr = frame.payload.length > 0 ? frame.payload.toString('utf8') : PUMP_STATES.IDLE;
      this.emit('status', {
        pumpId: frame.pumpId,
        state: stateStr,
      });
    }
  }

  /** Send authorize command to pump. */
  authorize(pumpId) {
    return this._send(buildFrame(pumpId, CMD.AUTHORIZE));
  }

  /** Request status from pump. */
  getStatus(pumpId) {
    return this._send(buildFrame(pumpId, CMD.STATUS));
  }

  /** Send stop command to pump. */
  stop(pumpId) {
    return this._send(buildFrame(pumpId, CMD.STOP));
  }

  _send(buffer) {
    if (!this._port || !this._connected) {
      throw new Error('IGEM serial port not connected');
    }
    return new Promise((resolve, reject) => {
      this._port.write(buffer, (err) => {
        if (err) return reject(err);
        this._port.drain((drainErr) => {
          if (drainErr) return reject(drainErr);
          resolve();
        });
      });
    });
  }

  /** Close the serial connection. */
  async disconnect() {
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

module.exports = { IgemInterface, buildFrame, parseFrame, CMD, STX, ETX };
