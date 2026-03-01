'use strict';

function validateWebhook(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const required = ['event', 'form_id', 'submission_id', 'submitted_by', 'site_id', 'timestamp'];
  const errors = [];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== 'string') {
      errors.push(`Field '${field}' must be of type string, got ${typeof data[field]}`);
    }
  }
  if (errors.length === 0) return { valid: true };
  return { valid: false, errors };
}

function validateSyncRequest(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const errors = [];
  if (!data.site_id || typeof data.site_id !== 'string') {
    errors.push("Missing or invalid required field: site_id");
  }
  if (errors.length === 0) return { valid: true };
  return { valid: false, errors };
}

function validateFormSubmission(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Input must be an object'] };
  }
  const required = ['form_id', 'submitted_by', 'site_id', 'timestamp'];
  const errors = [];
  for (const field of required) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== 'string') {
      errors.push(`Field '${field}' must be of type string, got ${typeof data[field]}`);
    }
  }
  if (data.data !== undefined && (typeof data.data !== 'object' || data.data === null)) {
    errors.push("Field 'data' must be an object");
  }
  if (errors.length === 0) return { valid: true };
  return { valid: false, errors };
}

module.exports = {
  validateWebhook,
  validateSyncRequest,
  validateFormSubmission,
};
