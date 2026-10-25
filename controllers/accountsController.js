const pool = require('../db');

const ALLOWED_ACCOUNT_TYPES = [
  'BANK',
  'SAVINGS',
  'CASH',
  'WALLET',
  'CREDIT_CARD'
];

const parseId = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const parsed = Number.parseInt(val, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseAmount = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const num = Number.parseFloat(val);
  return !Number.isNaN(num) && num >= 0 ? num : null;
};

const formatAccountRow = (row) => ({
  account_id: Number(row.account_id),
  id: Number(row.account_id),
  user_id: Number(row.user_id),
  userId: Number(row.user_id),
  account_name: row.account_name,
  account_type: row.account_type,
  opening_balance: Number.parseFloat(row.opening_balance) || 0,
  current_balance: Number.parseFloat(row.current_balance !== undefined && row.current_balance !== null
    ? row.current_balance
    : row.opening_balance) || 0,
  is_archived: Boolean(row.is_archived),
  created_at: row.created_at
});

// GET all accounts for the authenticated user (including current balances)
const getAllAccounts = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const includeArchived = req.query.include_archived === 'true';

    const query = `
      SELECT
        a.account_id,
        a.user_id,
        a.account_name,
        a.account_type,
        a.opening_balance,
        a.is_archived,
        a.created_at,
        COALESCE(v.current_balance, a.opening_balance) AS current_balance
      FROM accounts a
      LEFT JOIN v_account_balances v
        ON v.account_id = a.account_id AND v.user_id = a.user_id
      WHERE a.user_id = $1
        ${includeArchived ? '' : 'AND a.is_archived = FALSE'}
      ORDER BY a.account_id ASC
    `;

    const result = await pool.query(query, [userId]);
    const accounts = result.rows.map(formatAccountRow);

    res.json({
      success: true,
      message: 'Accounts retrieved successfully',
      data: accounts
    });
  } catch (err) {
    next(err);
  }
};

// GET single account by ID (enforcing ownership)
const getAccountById = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const id = parseId(req.params.id);

    if (!id) {
      const err = new Error('Valid Account ID is required');
      err.statusCode = 400;
      throw err;
    }

    const query = `
      SELECT
        a.account_id,
        a.user_id,
        a.account_name,
        a.account_type,
        a.opening_balance,
        a.is_archived,
        a.created_at,
        COALESCE(v.current_balance, a.opening_balance) AS current_balance
      FROM accounts a
      LEFT JOIN v_account_balances v
        ON v.account_id = a.account_id AND v.user_id = a.user_id
      WHERE a.account_id = $1 AND a.user_id = $2
    `;

    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      const err = new Error('Account not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Account retrieved successfully',
      data: formatAccountRow(result.rows[0])
    });
  } catch (err) {
    next(err);
  }
};

// CREATE new account
const createAccount = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { account_name, account_type, opening_balance } = req.body;

    const trimmedName = String(account_name || '').trim();
    if (!trimmedName) {
      const err = new Error('account_name is required');
      err.statusCode = 400;
      throw err;
    }

    if (trimmedName.length > 80) {
      const err = new Error('account_name must not exceed 80 characters');
      err.statusCode = 400;
      throw err;
    }

    const normalizedType = String(account_type || '').trim().toUpperCase();
    if (!ALLOWED_ACCOUNT_TYPES.includes(normalizedType)) {
      const err = new Error(`Invalid account_type. Must be one of: ${ALLOWED_ACCOUNT_TYPES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const parsedOpening = opening_balance !== undefined && opening_balance !== null
      ? parseAmount(opening_balance)
      : 0;

    if (parsedOpening === null) {
      const err = new Error('opening_balance must be a non-negative number');
      err.statusCode = 400;
      throw err;
    }

    const insertQuery = `
      INSERT INTO accounts (user_id, account_name, account_type, opening_balance)
      VALUES ($1, $2, $3, $4)
      RETURNING account_id, user_id, account_name, account_type, opening_balance, is_archived, created_at
    `;

    const result = await pool.query(insertQuery, [
      userId,
      trimmedName,
      normalizedType,
      parsedOpening
    ]);

    const created = formatAccountRow({
      ...result.rows[0],
      current_balance: parsedOpening
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: created
    });
  } catch (err) {
    next(err);
  }
};

// UPDATE account
const updateAccount = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const id = parseId(req.params.id);

    if (!id) {
      const err = new Error('Valid Account ID is required');
      err.statusCode = 400;
      throw err;
    }

    const { account_name, account_type, is_archived } = req.body;

    // Check existence and ownership
    const checkResult = await pool.query(
      'SELECT * FROM accounts WHERE account_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      const err = new Error('Account not found');
      err.statusCode = 404;
      throw err;
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (account_name !== undefined) {
      const trimmedName = String(account_name || '').trim();
      if (!trimmedName) {
        const err = new Error('account_name cannot be empty');
        err.statusCode = 400;
        throw err;
      }
      if (trimmedName.length > 80) {
        const err = new Error('account_name must not exceed 80 characters');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`account_name = $${paramIndex++}`);
      values.push(trimmedName);
    }

    if (account_type !== undefined) {
      const normalizedType = String(account_type || '').trim().toUpperCase();
      if (!ALLOWED_ACCOUNT_TYPES.includes(normalizedType)) {
        const err = new Error(`Invalid account_type. Must be one of: ${ALLOWED_ACCOUNT_TYPES.join(', ')}`);
        err.statusCode = 400;
        throw err;
      }
      updates.push(`account_type = $${paramIndex++}`);
      values.push(normalizedType);
    }

    if (is_archived !== undefined) {
      updates.push(`is_archived = $${paramIndex++}`);
      values.push(Boolean(is_archived));
    }

    if (updates.length === 0) {
      const err = new Error('At least one field (account_name, account_type, is_archived) is required to update');
      err.statusCode = 400;
      throw err;
    }

    values.push(id, userId);
    const updateQuery = `
      UPDATE accounts
      SET ${updates.join(', ')}
      WHERE account_id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING account_id, user_id, account_name, account_type, opening_balance, is_archived, created_at
    `;

    const result = await pool.query(updateQuery, values);

    // Retrieve current balance from view
    const balanceResult = await pool.query(
      'SELECT current_balance FROM v_account_balances WHERE account_id = $1 AND user_id = $2',
      [id, userId]
    );

    const currentBalance = balanceResult.rows.length > 0
      ? balanceResult.rows[0].current_balance
      : result.rows[0].opening_balance;

    const updated = formatAccountRow({
      ...result.rows[0],
      current_balance: currentBalance
    });

    res.json({
      success: true,
      message: 'Account updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

// ARCHIVE account (Soft delete to prevent foreign key violations with transactions)
const archiveAccount = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const id = parseId(req.params.id);

    if (!id) {
      const err = new Error('Valid Account ID is required');
      err.statusCode = 400;
      throw err;
    }

    const checkResult = await pool.query(
      'SELECT account_id FROM accounts WHERE account_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      const err = new Error('Account not found');
      err.statusCode = 404;
      throw err;
    }

    await pool.query(
      'UPDATE accounts SET is_archived = TRUE WHERE account_id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({
      success: true,
      message: 'Account archived successfully',
      data: {
        account_id: id,
        id,
        is_archived: true
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  archiveAccount
};