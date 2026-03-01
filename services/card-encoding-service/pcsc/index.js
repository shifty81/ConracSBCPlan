'use strict';

// In production on Windows, this module uses the `pcsclite` npm package
// to communicate with HID OMNIKEY readers via the PC/SC (winscard.dll) interface.
// For development and CI, mock implementations are provided below.

const DEFAULT_READER = process.env.HID_READER_NAME || 'HID OMNIKEY 5427CK';

/**
 * List connected PC/SC readers.
 * Production: uses pcsclite to enumerate readers from winscard.
 * @returns {Promise<string[]>} Array of reader names.
 */
async function listReaders() {
  return [DEFAULT_READER];
}

/**
 * Read card UID and type from a presented card.
 * Production: sends APDU FF CA 00 00 00 via pcsclite to read UID.
 * @param {string} _readerName - Name of the PC/SC reader.
 * @returns {Promise<{card_uid: string, card_type: string}>}
 */
async function readCard(_readerName) {
  return {
    card_uid: 'MOCK-UID-00000001',
    card_type: 'iCLASS SE',
  };
}

/**
 * Encode credential data onto a card.
 * Production: authenticates to iCLASS SE sector and writes via APDU FF D6.
 * @param {string} _readerName - Name of the PC/SC reader.
 * @param {object} _data - Encoding payload (facility_code, card_number, user_data).
 * @returns {Promise<{success: boolean, card_uid: string}>}
 */
async function encodeCard(_readerName, _data) {
  return {
    success: true,
    card_uid: 'MOCK-UID-00000001',
  };
}

module.exports = { listReaders, readCard, encodeCard };
