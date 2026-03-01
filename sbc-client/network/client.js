'use strict';

const { createLogger } = require('../../shared/logging');

const logger = createLogger('sbc-client');

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;

class NetworkClient {
  /**
   * @param {object} opts
   * @param {string} opts.serverUrl - base URL of central server
   * @param {string} opts.apiKey - API key for authentication
   * @param {string} [opts.jwt] - JWT token (set after auth)
   * @param {number} [opts.timeoutMs]
   * @param {function} [opts.fetchFn] - fetch implementation (for testing)
   */
  constructor({ serverUrl, apiKey, jwt, timeoutMs, fetchFn } = {}) {
    this._serverUrl = (serverUrl || '').replace(/\/+$/, '');
    this._apiKey = apiKey || '';
    this._jwt = jwt || '';
    this._timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;
    this._online = true;
    this._fetch = fetchFn || null;
  }

  get online() {
    return this._online;
  }

  set jwt(token) {
    this._jwt = token;
  }

  /** Resolve fetch implementation lazily. */
  _getFetch() {
    if (this._fetch) return this._fetch;
    // node-fetch v2 is CommonJS compatible
    this._fetch = require('node-fetch');
    return this._fetch;
  }

  _headers() {
    const h = {
      'Content-Type': 'application/json',
      'X-API-Key': this._apiKey,
    };
    if (this._jwt) {
      h['Authorization'] = `Bearer ${this._jwt}`;
    }
    return h;
  }

  /**
   * Authenticated POST to server.
   */
  async post(path, data) {
    return this._request('POST', path, data);
  }

  /**
   * Authenticated GET from server.
   */
  async get(path) {
    return this._request('GET', path);
  }

  async _request(method, path, body) {
    const url = `${this._serverUrl}${path}`;
    const fetchFn = this._getFetch();
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const opts = {
          method,
          headers: this._headers(),
          timeout: this._timeoutMs,
        };
        if (body !== undefined) {
          opts.body = JSON.stringify(body);
        }

        const res = await fetchFn(url, opts);
        this._online = true;

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await res.json();
        }
        return await res.text();
      } catch (err) {
        lastError = err;
        logger.warn('Request failed', { method, path, attempt: attempt + 1, error: err.message });
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }

    this._online = false;
    throw lastError;
  }
}

module.exports = { NetworkClient };
