'use strict';

/**
 * NEXUS Database Maintenance & Archival
 *
 * Performs regular database optimization (VACUUM, REINDEX, statistics update)
 * and data archival (moves records older than the retention threshold to
 * archive tables, then purges them from active tables).
 *
 * Scheduled via Windows Task Scheduler (weekly, Sunday 2:00 AM)
 * or invoked manually: node scripts/db-maintenance.js
 *
 * Environment variables:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *   ARCHIVE_RETENTION_YEARS  (default: 5)
 *   DB_MAINTENANCE_LOG       (default: C:\nexus\logs\db-maintenance.log)
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'nexus',
  user: process.env.DB_USER || 'nexus_admin',
  password: process.env.DB_PASSWORD || '',
});

const ARCHIVE_YEARS = parseInt(process.env.ARCHIVE_RETENTION_YEARS, 10) || 5;

function log(level, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'db-maintenance',
    level,
    message,
  };
  if (meta !== undefined) entry.meta = meta;
  const output = level === 'error' ? process.stderr : process.stdout;
  output.write(JSON.stringify(entry) + '\n');
}

// ------------------------------------------------------------------
// 1. Create archive tables (if they don't exist)
// ------------------------------------------------------------------
async function ensureArchiveTables(client) {
  log('info', 'Ensuring archive tables exist');

  await client.query(`
    CREATE TABLE IF NOT EXISTS archive_transactions (
      LIKE transactions INCLUDING ALL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS archive_events (
      LIKE events INCLUDING ALL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS archive_heartbeats (
      LIKE heartbeats INCLUDING ALL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS archive_tank_readings (
      LIKE tank_readings INCLUDING ALL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS archive_vendor_visits (
      LIKE vendor_visits INCLUDING ALL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS archive_carwash_cycles (
      LIKE carwash_cycles INCLUDING ALL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS archive_form_submissions (
      LIKE form_submissions INCLUDING ALL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS archive_audit_log (
      LIKE audit_log INCLUDING ALL
    )
  `);

  log('info', 'Archive tables ready');
}

// ------------------------------------------------------------------
// 2. Archive old data (move rows older than retention threshold)
// ------------------------------------------------------------------
async function archiveTable(client, tableName, archiveTableName, timestampColumn, cutoffDate) {
  // Validate table names against allow-list to prevent SQL injection
  const ALLOWED_TABLES = new Set([
    'transactions', 'archive_transactions',
    'events', 'archive_events',
    'heartbeats', 'archive_heartbeats',
    'tank_readings', 'archive_tank_readings',
    'vendor_visits', 'archive_vendor_visits',
    'carwash_cycles', 'archive_carwash_cycles',
    'form_submissions', 'archive_form_submissions',
    'audit_log', 'archive_audit_log',
  ]);
  const ALLOWED_COLUMNS = new Set(['created_at', 'timestamp']);
  if (!ALLOWED_TABLES.has(tableName) || !ALLOWED_TABLES.has(archiveTableName)) {
    throw new Error(`Invalid table name: ${tableName} or ${archiveTableName}`);
  }
  if (!ALLOWED_COLUMNS.has(timestampColumn)) {
    throw new Error(`Invalid timestamp column: ${timestampColumn}`);
  }

  // Insert into archive
  const insertResult = await client.query(`
    INSERT INTO ${archiveTableName}
    SELECT * FROM ${tableName}
    WHERE ${timestampColumn} < $1
    ON CONFLICT DO NOTHING
  `, [cutoffDate]);

  const archived = insertResult.rowCount || 0;

  // Delete from active table
  const deleteResult = await client.query(`
    DELETE FROM ${tableName}
    WHERE ${timestampColumn} < $1
  `, [cutoffDate]);

  const deleted = deleteResult.rowCount || 0;

  log('info', `Archived ${tableName}`, { archived, deleted, cutoff: cutoffDate.toISOString() });
  return { archived, deleted };
}

async function archiveOldData(client) {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - ARCHIVE_YEARS);

  log('info', `Archiving data older than ${ARCHIVE_YEARS} years (before ${cutoffDate.toISOString()})`);

  const results = {};

  results.transactions = await archiveTable(
    client, 'transactions', 'archive_transactions', 'created_at', cutoffDate
  );
  results.events = await archiveTable(
    client, 'events', 'archive_events', 'created_at', cutoffDate
  );
  results.heartbeats = await archiveTable(
    client, 'heartbeats', 'archive_heartbeats', 'created_at', cutoffDate
  );
  results.tank_readings = await archiveTable(
    client, 'tank_readings', 'archive_tank_readings', 'created_at', cutoffDate
  );
  results.vendor_visits = await archiveTable(
    client, 'vendor_visits', 'archive_vendor_visits', 'created_at', cutoffDate
  );
  results.carwash_cycles = await archiveTable(
    client, 'carwash_cycles', 'archive_carwash_cycles', 'created_at', cutoffDate
  );
  results.form_submissions = await archiveTable(
    client, 'form_submissions', 'archive_form_submissions', 'created_at', cutoffDate
  );
  // Note: audit_log uses 'timestamp' as its date column (not 'created_at')
  // because the init.sql schema defines it that way for semantic clarity.
  results.audit_log = await archiveTable(
    client, 'audit_log', 'archive_audit_log', 'timestamp', cutoffDate
  );

  return results;
}

// ------------------------------------------------------------------
// 3. Optimize database (VACUUM ANALYZE, REINDEX)
// ------------------------------------------------------------------
async function optimizeDatabase() {
  // VACUUM and REINDEX cannot run inside a transaction, use pool directly
  log('info', 'Running VACUUM ANALYZE on all tables');
  await pool.query('VACUUM ANALYZE');

  log('info', 'Running REINDEX on high-write tables');
  const ALLOWED_REINDEX_TABLES = new Set([
    'transactions', 'events', 'heartbeats', 'tank_readings',
    'vendor_visits', 'carwash_cycles', 'audit_log',
  ]);
  const highWriteTables = [
    'transactions', 'events', 'heartbeats', 'tank_readings',
    'vendor_visits', 'carwash_cycles', 'audit_log',
  ];
  for (const table of highWriteTables) {
    if (!ALLOWED_REINDEX_TABLES.has(table)) {
      throw new Error(`Invalid table for reindex: ${table}`);
    }
    await pool.query(`REINDEX TABLE ${table}`);
    log('info', `Reindexed ${table}`);
  }
}

// ------------------------------------------------------------------
// 4. Collect and log table statistics
// ------------------------------------------------------------------
async function collectStats(client) {
  const tables = [
    'users', 'sbc_devices', 'transactions', 'events', 'heartbeats',
    'tank_readings', 'form_submissions', 'audit_log', 'vendors',
    'vendor_visits', 'service_orders', 'facility_systems', 'carwash_cycles',
    'employee_time_entries', 'tasks', 'training_modules', 'employee_training_records',
  ];

  const stats = {};
  for (const table of tables) {
    const result = await client.query(
      `SELECT COUNT(*) AS row_count FROM ${table}`
    );
    stats[table] = parseInt(result.rows[0].row_count, 10);
  }

  log('info', 'Table statistics', stats);

  // Check database size
  const sizeResult = await client.query(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size`
  );
  log('info', 'Database size', { size: sizeResult.rows[0].db_size });

  return stats;
}

// ------------------------------------------------------------------
// 5. Log maintenance run to audit_log
// ------------------------------------------------------------------
async function logMaintenanceRun(client, archiveResults, stats, durationMs) {
  await client.query(
    `INSERT INTO audit_log (action, actor, site_id, details)
     VALUES ($1, $2, $3, $4)`,
    [
      'DB_MAINTENANCE',
      'system',
      'ALL',
      JSON.stringify({ archiveResults, stats, duration_ms: durationMs }),
    ]
  );
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  const startTime = Date.now();
  log('info', '=== NEXUS Database Maintenance Started ===');

  const client = await pool.connect();

  try {
    // Phase 1: Create archive tables
    await ensureArchiveTables(client);

    // Phase 2: Archive old data (inside a transaction)
    await client.query('BEGIN');
    const archiveResults = await archiveOldData(client);
    await client.query('COMMIT');

    // Phase 3: Optimize (VACUUM, REINDEX — outside transaction)
    client.release();
    await optimizeDatabase();
    const statsClient = await pool.connect();

    try {
      // Phase 4: Collect stats
      const stats = await collectStats(statsClient);

      // Phase 5: Log the maintenance run
      const durationMs = Date.now() - startTime;
      await logMaintenanceRun(statsClient, archiveResults, stats, durationMs);

      log('info', `=== Database Maintenance Complete (${durationMs}ms) ===`);
    } finally {
      statsClient.release();
    }
  } catch (err) {
    log('error', 'Database maintenance failed', { error: err.message });
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    client.release();
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

// Export for testing
module.exports = {
  ensureArchiveTables,
  archiveTable,
  archiveOldData,
  optimizeDatabase,
  collectStats,
  logMaintenanceRun,
  main,
};

// Run when executed directly
if (require.main === module) {
  main();
}
