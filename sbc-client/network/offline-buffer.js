'use strict';

const { createLogger } = require('../../shared/logging');

const logger = createLogger('sbc-client');

/**
 * Offline store-and-forward buffer.
 * Persists queued data to SQLite for power-loss safety.
 * When back online, flushes all buffered items to the server.
 */
class OfflineBuffer {
  /**
   * @param {object} opts
   * @param {object} [opts.db] - better-sqlite3 instance
   * @param {import('./client').NetworkClient} [opts.networkClient]
   */
  constructor({ db, networkClient } = {}) {
    this._db = db || null;
    this._client = networkClient || null;
    this._queue = [];
    this._initDb();
  }

  _initDb() {
    if (!this._db) return;
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS offline_buffer (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    // Load any persisted items
    const rows = this._db.prepare('SELECT id, type, data, created_at FROM offline_buffer ORDER BY id').all();
    for (const row of rows) {
      this._queue.push({
        dbId: row.id,
        type: row.type,
        data: JSON.parse(row.data),
        createdAt: row.created_at,
      });
    }
    if (rows.length > 0) {
      logger.info('Loaded buffered items from disk', { count: rows.length });
    }
  }

  /**
   * Buffer data for later sending.
   */
  enqueue(type, data) {
    const createdAt = new Date().toISOString();
    const item = { type, data, createdAt, dbId: null };

    if (this._db) {
      const info = this._db.prepare(
        'INSERT INTO offline_buffer (type, data, created_at) VALUES (?, ?, ?)',
      ).run(type, JSON.stringify(data), createdAt);
      item.dbId = info.lastInsertRowid;
    }

    this._queue.push(item);
    logger.info('Enqueued offline item', { type, pending: this._queue.length });
  }

  /**
   * Flush all buffered items to the server.
   * @returns {number} number of successfully sent items
   */
  async flush() {
    if (!this._client || this._queue.length === 0) return 0;

    let sent = 0;
    const failed = [];

    for (const item of this._queue) {
      try {
        await this._client.post(`/api/buffer/${item.type}`, item.data);
        if (this._db && item.dbId) {
          this._db.prepare('DELETE FROM offline_buffer WHERE id = ?').run(item.dbId);
        }
        sent++;
      } catch (err) {
        logger.warn('Flush item failed', { type: item.type, error: err.message });
        failed.push(item);
      }
    }

    this._queue = failed;
    if (sent > 0) {
      logger.info('Flushed offline buffer', { sent, remaining: failed.length });
    }
    return sent;
  }

  /**
   * Returns the number of pending buffered items.
   */
  getPendingCount() {
    return this._queue.length;
  }
}

module.exports = { OfflineBuffer };
