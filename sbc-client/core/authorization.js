'use strict';

const { createLogger } = require('../../shared/logging');
const logger = createLogger('sbc-client');

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class AuthorizationManager {
  /**
   * @param {object} opts
   * @param {object} opts.networkClient - network/client instance with get/post
   * @param {number} [opts.cacheTtlMs] - cache TTL in ms
   */
  constructor({ networkClient, cacheTtlMs } = {}) {
    this._client = networkClient || null;
    this._cacheTtlMs = cacheTtlMs || DEFAULT_CACHE_TTL_MS;
    this._cache = new Map();
    this._lastRefresh = 0;
  }

  /**
   * Authorize a user by card UID and optional PIN.
   * Checks local cache first, then falls back to server.
   */
  async authorize(cardUid, pin) {
    if (!cardUid) {
      return { authorized: false, reason: 'Missing card UID' };
    }

    // Check local cache
    const cached = this._cache.get(cardUid);
    if (cached && Date.now() - cached.timestamp < this._cacheTtlMs) {
      if (!pin || cached.pin === pin) {
        logger.info('Authorization from cache', { cardUid });
        return { authorized: true, userId: cached.userId, role: cached.role, source: 'cache' };
      }
      return { authorized: false, reason: 'Invalid PIN' };
    }

    // Try server
    if (this._client) {
      try {
        const res = await this._client.post('/api/auth/verify', { card_uid: cardUid, pin });
        if (res && res.authorized) {
          this._cache.set(cardUid, {
            userId: res.user_id,
            role: res.role,
            pin,
            timestamp: Date.now(),
          });
          logger.info('Authorization from server', { cardUid });
          return { authorized: true, userId: res.user_id, role: res.role, source: 'server' };
        }
        return { authorized: false, reason: res ? res.reason : 'Server rejected' };
      } catch (err) {
        logger.warn('Server unreachable, using cache fallback', { error: err.message });
        // Fall through to cache even if expired
        if (cached && (!pin || cached.pin === pin)) {
          return { authorized: true, userId: cached.userId, role: cached.role, source: 'cache-offline' };
        }
        return { authorized: false, reason: 'Offline and no cached credentials' };
      }
    }

    return { authorized: false, reason: 'No network client and no cached credentials' };
  }

  /**
   * Refresh the authorized user cache from the server.
   */
  async refreshCache() {
    if (!this._client) return;
    try {
      const users = await this._client.get('/api/auth/users');
      if (Array.isArray(users)) {
        const now = Date.now();
        for (const u of users) {
          this._cache.set(u.card_uid, {
            userId: u.user_id,
            role: u.role,
            pin: u.pin || null,
            timestamp: now,
          });
        }
        this._lastRefresh = now;
        logger.info('Auth cache refreshed', { count: users.length });
      }
    } catch (err) {
      logger.warn('Failed to refresh auth cache', { error: err.message });
    }
  }

  /** Returns the number of cached entries. */
  get cacheSize() {
    return this._cache.size;
  }

  /** Clears the cache. */
  clearCache() {
    this._cache.clear();
  }
}

module.exports = { AuthorizationManager };
