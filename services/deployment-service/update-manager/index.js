'use strict';

const crypto = require('crypto');

/**
 * Hash an API key using SHA-256.
 */
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Check if a heartbeat timestamp is stale.
 * @param {string|Date} lastHeartbeat - Last heartbeat timestamp
 * @param {number} thresholdSeconds - Staleness threshold in seconds (default 300 = 5 min)
 * @returns {boolean}
 */
function isHeartbeatStale(lastHeartbeat, thresholdSeconds = 300) {
  if (!lastHeartbeat) return true;
  const last = new Date(lastHeartbeat);
  if (isNaN(last.getTime())) return true;
  const elapsed = (Date.now() - last.getTime()) / 1000;
  return elapsed > thresholdSeconds;
}

/**
 * Build a deployment summary from an array of device records.
 */
function buildDeploymentSummary(devices) {
  const total = devices.length;
  let online = 0;
  let offline = 0;
  const byFirmware = {};
  const staleDevices = [];

  for (const device of devices) {
    if (device.status === 'online') {
      online++;
    } else {
      offline++;
    }

    const fw = device.firmware_version || 'unknown';
    byFirmware[fw] = (byFirmware[fw] || 0) + 1;

    if (isHeartbeatStale(device.last_heartbeat)) {
      staleDevices.push(device.sbc_id);
    }
  }

  return {
    total_devices: total,
    online,
    offline,
    by_firmware_version: byFirmware,
    stale_heartbeat_devices: staleDevices,
  };
}

module.exports = {
  hashApiKey,
  isHeartbeatStale,
  buildDeploymentSummary,
};
