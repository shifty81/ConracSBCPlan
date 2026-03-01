'use strict';

const pool = require('../src/db');
const { createLogger } = require('../../shared/logging');

const logger = createLogger('formforce-sync');

/**
 * Retrieves all unsynced form submissions.
 */
async function getUnsyncedSubmissions() {
  const result = await pool.query(
    'SELECT * FROM form_submissions WHERE synced = false ORDER BY timestamp ASC'
  );
  return result.rows;
}

/**
 * Marks a list of submission IDs as synced.
 */
async function markSynced(submissionIds) {
  if (!submissionIds || submissionIds.length === 0) return [];

  const result = await pool.query(
    'UPDATE form_submissions SET synced = true WHERE submission_id = ANY($1) RETURNING *',
    [submissionIds]
  );

  logger.info('Submissions marked as synced', { count: result.rows.length });
  return result.rows;
}

/**
 * Runs a single sync cycle: fetches unsynced submissions and marks them synced.
 * In production, the actual sync would send data to an external system first.
 */
async function runSyncCycle() {
  const unsynced = await getUnsyncedSubmissions();
  if (unsynced.length === 0) {
    logger.info('No unsynced submissions');
    return [];
  }

  logger.info('Syncing submissions', { count: unsynced.length });
  const ids = unsynced.map((row) => row.submission_id);
  return markSynced(ids);
}

module.exports = {
  getUnsyncedSubmissions,
  markSynced,
  runSyncCycle,
};
