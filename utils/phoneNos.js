const pool = require('../db');

let cachedStorageMode;

const detectStorageMode = async () => {
  if (cachedStorageMode) {
    return cachedStorageMode;
  }

  const conn = await pool.getConnection();
  const [rows] = await conn.query(
    `SELECT DATA_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'Users'
       AND COLUMN_NAME = 'phone_nos'
     LIMIT 1`
  );
  conn.release();

  const dataType = rows[0]?.DATA_TYPE?.toLowerCase();
  cachedStorageMode = dataType === 'json' ? 'json' : 'text';
  return cachedStorageMode;
};

const normalizePhoneNos = (phoneNos) => {
  if (phoneNos === null) {
    return null;
  }

  if (phoneNos === undefined) {
    return undefined;
  }

  if (Array.isArray(phoneNos)) {
    return phoneNos
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0);
  }

  if (typeof phoneNos === 'string') {
    const trimmed = phoneNos.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((value) => String(value).trim())
            .filter((value) => value.length > 0);
        }
      } catch (err) {
        // Fallback to text parsing below.
      }
    }

    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    }

    return [trimmed];
  }

  return [String(phoneNos).trim()].filter((value) => value.length > 0);
};

const serializePhoneNosForDb = async (phoneNos) => {
  if (phoneNos === undefined) {
    return undefined;
  }

  const normalized = normalizePhoneNos(phoneNos);
  if (normalized === null) {
    return null;
  }

  const storageMode = await detectStorageMode();
  if (storageMode === 'json') {
    return JSON.stringify(normalized);
  }

  return normalized.join(',');
};

module.exports = {
  serializePhoneNosForDb
};
