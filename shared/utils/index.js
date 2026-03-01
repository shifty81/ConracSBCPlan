'use strict';

const crypto = require('crypto');

/**
 * Generates a unique ID with the given prefix, date stamp, and random suffix.
 * Example: "txn-20260301-a1b2c3"
 */
function generateId(prefix) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex');
  return `${prefix}-${date}-${rand}`;
}

/**
 * Validates and parses an ISO 8601 timestamp string.
 * Returns a Date object or null if invalid.
 */
function parseTimestamp(ts) {
  if (typeof ts !== 'string') return null;
  const date = new Date(ts);
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Basic input sanitization: strips HTML tags and trims whitespace.
 * NOTE: This is for basic cleaning only, not XSS prevention.
 * For security-critical contexts, use a dedicated sanitization library.
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  let result = str;
  let prev;
  do {
    prev = result;
    result = result.replace(/<[^>]*>/g, '');
  } while (result !== prev);
  return result.trim();
}

/**
 * Promisified setTimeout.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  generateId,
  parseTimestamp,
  sanitizeInput,
  sleep,
};
