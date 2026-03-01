'use strict';

const { createLogger } = require('../../shared/logging');
const { generateId } = require('../../shared/utils');

const logger = createLogger('sbc-client');

const FINALIZATION_DELAY_MS = 10_000;

class TransactionManager {
  /**
   * @param {object} opts
   * @param {object} [opts.db] - better-sqlite3 instance (optional, in-memory fallback)
   */
  constructor({ db } = {}) {
    this._db = db || null;
    this._transactions = new Map();
    this._initDb();
  }

  _initDb() {
    if (!this._db) return;
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        pump_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        gallons REAL DEFAULT 0,
        amount REAL DEFAULT 0,
        status TEXT DEFAULT 'in_progress',
        synced INTEGER DEFAULT 0
      )
    `);
  }

  /**
   * Begin a new fuel transaction.
   * @returns {string} transaction ID
   */
  startTransaction(userId, pumpId) {
    const txId = generateId('txn');
    const startTime = new Date().toISOString();
    const tx = {
      id: txId,
      userId,
      pumpId,
      startTime,
      endTime: null,
      gallons: 0,
      amount: 0,
      status: 'in_progress',
      synced: false,
    };
    this._transactions.set(txId, tx);

    if (this._db) {
      this._db.prepare(
        'INSERT INTO transactions (id, user_id, pump_id, start_time, status) VALUES (?, ?, ?, ?, ?)',
      ).run(txId, userId, pumpId, startTime, 'in_progress');
    }

    logger.info('Transaction started', { txId, userId, pumpId });
    return txId;
  }

  /**
   * Update an in-progress transaction with dispenser readings.
   */
  updateTransaction(txId, gallons, amount) {
    const tx = this._transactions.get(txId);
    if (!tx || tx.status !== 'in_progress') {
      throw new Error(`Transaction ${txId} not found or not in progress`);
    }
    tx.gallons = gallons;
    tx.amount = amount;

    if (this._db) {
      this._db.prepare('UPDATE transactions SET gallons = ?, amount = ? WHERE id = ?').run(gallons, amount, txId);
    }
    return tx;
  }

  /**
   * Finalize a transaction after a 10-second delay.
   * @returns {Promise<object>} finalized transaction
   */
  async finalizeTransaction(txId, { delayMs } = {}) {
    const tx = this._transactions.get(txId);
    if (!tx || tx.status !== 'in_progress') {
      throw new Error(`Transaction ${txId} not found or not in progress`);
    }

    const delay = typeof delayMs === 'number' ? delayMs : FINALIZATION_DELAY_MS;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    tx.status = 'completed';
    tx.endTime = new Date().toISOString();

    if (this._db) {
      this._db.prepare('UPDATE transactions SET status = ?, end_time = ? WHERE id = ?').run('completed', tx.endTime, txId);
    }

    logger.info('Transaction finalized', { txId, gallons: tx.gallons });
    return { ...tx };
  }

  /** Get a transaction by ID. */
  getTransaction(txId) {
    return this._transactions.get(txId) || null;
  }

  /** Get all pending (unsynced, completed) transactions. */
  getPendingTransactions() {
    const pending = [];
    for (const tx of this._transactions.values()) {
      if (tx.status === 'completed' && !tx.synced) {
        pending.push({ ...tx });
      }
    }
    return pending;
  }

  /** Mark a transaction as synced. */
  markSynced(txId) {
    const tx = this._transactions.get(txId);
    if (tx) {
      tx.synced = true;
      if (this._db) {
        this._db.prepare('UPDATE transactions SET synced = 1 WHERE id = ?').run(txId);
      }
    }
  }
}

module.exports = { TransactionManager };
