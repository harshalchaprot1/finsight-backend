const pool = require('../db');

const parseId = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const parsed = Number.parseInt(val, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseAmount = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const num = Number.parseFloat(val);
  return !Number.isNaN(num) && num > 0 ? num : null;
};

const parseDate = (val) => {
  if (!val) return new Date().toISOString().slice(0, 10);
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

// Formats a PostgreSQL row for both frontend backwards compatibility and PostgreSQL schema
const formatTransactionRow = (row) => ({
  id: Number(row.transaction_id),
  transaction_id: Number(row.transaction_id),
  user_id: Number(row.user_id),
  userId: Number(row.user_id),
  account_id: Number(row.account_id),
  account_name: row.account_name || undefined,
  to_account_id: row.to_account_id ? Number(row.to_account_id) : null,
  to_account_name: row.to_account_name || undefined,
  category_id: row.category_id ? Number(row.category_id) : null,
  category_name: row.category_name || undefined,
  category: row.category_id ? String(row.category_id) : '',
  merchant_id: row.merchant_id ? Number(row.merchant_id) : null,
  payment_method_id: row.payment_method_id ? Number(row.payment_method_id) : null,
  payment_method_name: row.payment_method_name || undefined,
  obligation_id: row.obligation_id ? Number(row.obligation_id) : null,
  transaction_type: row.transaction_type,
  type: row.transaction_type ? row.transaction_type.toLowerCase() : '',
  amount: Number.parseFloat(row.amount),
  transaction_date: row.transaction_date instanceof Date
    ? row.transaction_date.toISOString().slice(0, 10)
    : String(row.transaction_date).slice(0, 10),
  date: row.transaction_date instanceof Date
    ? row.transaction_date.toISOString().slice(0, 10)
    : String(row.transaction_date).slice(0, 10),
  description: row.description || '',
  note: row.description || '',
  created_at: row.created_at
});

// ✅ GET all transactions for authenticated user
const getAllTransactions = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    const query = `
      SELECT
        t.*,
        a.account_name,
        a_to.account_name AS to_account_name,
        c.category_name,
        pm.method_name AS payment_method_name
      FROM transactions t
      JOIN accounts a ON a.account_id = t.account_id AND a.user_id = t.user_id
      LEFT JOIN accounts a_to ON a_to.account_id = t.to_account_id AND a_to.user_id = t.user_id
      LEFT JOIN categories c ON c.category_id = t.category_id AND c.user_id = t.user_id
      LEFT JOIN payment_methods pm ON pm.payment_method_id = t.payment_method_id
      WHERE t.user_id = $1
      ORDER BY t.transaction_date DESC, t.transaction_id DESC
    `;

    const result = await pool.query(query, [userId]);
    const formatted = result.rows.map(formatTransactionRow);

    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: formatted
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET transactions by user ID (Enforcing authenticated ownership)
const getTransactionsByUserId = async (req, res, next) => {
  try {
    const requestedUserId = parseId(req.params.userId);
    const authUserId = req.user.user_id;

    if (!requestedUserId) {
      const err = new Error('Valid User ID is required in URL parameter');
      err.statusCode = 400;
      throw err;
    }

    if (requestedUserId !== authUserId) {
      const err = new Error('Forbidden: You are not authorized to access another user\'s transactions');
      err.statusCode = 403;
      throw err;
    }

    const query = `
      SELECT
        t.*,
        a.account_name,
        a_to.account_name AS to_account_name,
        c.category_name,
        pm.method_name AS payment_method_name
      FROM transactions t
      JOIN accounts a ON a.account_id = t.account_id AND a.user_id = t.user_id
      LEFT JOIN accounts a_to ON a_to.account_id = t.to_account_id AND a_to.user_id = t.user_id
      LEFT JOIN categories c ON c.category_id = t.category_id AND c.user_id = t.user_id
      LEFT JOIN payment_methods pm ON pm.payment_method_id = t.payment_method_id
      WHERE t.user_id = $1
      ORDER BY t.transaction_date DESC, t.transaction_id DESC
    `;

    const result = await pool.query(query, [authUserId]);
    const formatted = result.rows.map(formatTransactionRow);

    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: formatted
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET single transaction by ID (with ownership check)
const getTransactionById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const userId = req.user.user_id;

    if (!id) {
      const err = new Error('Valid Transaction ID is required');
      err.statusCode = 400;
      throw err;
    }

    const query = `
      SELECT
        t.*,
        a.account_name,
        a_to.account_name AS to_account_name,
        c.category_name,
        pm.method_name AS payment_method_name
      FROM transactions t
      JOIN accounts a ON a.account_id = t.account_id AND a.user_id = t.user_id
      LEFT JOIN accounts a_to ON a_to.account_id = t.to_account_id AND a_to.user_id = t.user_id
      LEFT JOIN categories c ON c.category_id = t.category_id AND c.user_id = t.user_id
      LEFT JOIN payment_methods pm ON pm.payment_method_id = t.payment_method_id
      WHERE t.transaction_id = $1 AND t.user_id = $2
    `;

    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      const err = new Error('Transaction not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Transaction retrieved successfully',
      data: formatTransactionRow(result.rows[0])
    });
  } catch (err) {
    next(err);
  }
};

// ✅ CREATE transaction (with validation, account lookup, and ownership checks)
const createTransaction = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const {
      amount,
      category_id,
      category,
      type,
      transaction_type,
      account_id,
      to_account_id,
      toAccountId,
      payment_method_id,
      note,
      description,
      transaction_date,
      date,
      merchant_id,
      obligation_id
    } = req.body;

    const parsedAmount = parseAmount(amount);
    if (!parsedAmount) {
      const err = new Error('Amount must be a positive number');
      err.statusCode = 400;
      throw err;
    }

    // Resolve transaction_type (INCOME, EXPENSE, TRANSFER, REFUND)
    const rawType = String(transaction_type || type || 'EXPENSE').trim().toUpperCase();
    const validTypes = ['INCOME', 'EXPENSE', 'TRANSFER', 'REFUND'];
    if (!validTypes.includes(rawType)) {
      const err = new Error(`Invalid transaction type. Must be one of: ${validTypes.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const parsedDate = parseDate(transaction_date || date);
    if (!parsedDate) {
      const err = new Error('Invalid date format. Expected YYYY-MM-DD');
      err.statusCode = 400;
      throw err;
    }

    // Resolve or fallback account_id: must belong to the user
    let resolvedAccountId = parseId(account_id);
    if (!resolvedAccountId) {
      const defaultAccount = await pool.query(
        'SELECT account_id FROM accounts WHERE user_id = $1 AND is_archived = false ORDER BY account_id ASC LIMIT 1',
        [userId]
      );
      if (defaultAccount.rows.length === 0) {
        const err = new Error('User has no active financial account. Please create an account first.');
        err.statusCode = 400;
        throw err;
      }
      resolvedAccountId = Number(defaultAccount.rows[0].account_id);
    } else {
      const accCheck = await pool.query(
        'SELECT account_id FROM accounts WHERE account_id = $1 AND user_id = $2',
        [resolvedAccountId, userId]
      );
      if (accCheck.rows.length === 0) {
        const err = new Error('Specified account not found or does not belong to you');
        err.statusCode = 400;
        throw err;
      }
    }

    // Resolve destination account for TRANSFER
    let resolvedToAccountId = null;
    let resolvedCategoryId = parseId(category_id ?? category);

    if (rawType === 'TRANSFER') {
      resolvedToAccountId = parseId(to_account_id ?? toAccountId);
      if (!resolvedToAccountId) {
        const err = new Error('Transfer transactions require a destination account (to_account_id)');
        err.statusCode = 400;
        throw err;
      }
      if (resolvedToAccountId === resolvedAccountId) {
        const err = new Error('Destination account cannot be the same as source account');
        err.statusCode = 400;
        throw err;
      }
      const toAccCheck = await pool.query(
        'SELECT account_id FROM accounts WHERE account_id = $1 AND user_id = $2',
        [resolvedToAccountId, userId]
      );
      if (toAccCheck.rows.length === 0) {
        const err = new Error('Destination account not found or does not belong to you');
        err.statusCode = 400;
        throw err;
      }
      // Schema constraint: category_id must be null for TRANSFER
      resolvedCategoryId = null;
    } else {
      resolvedToAccountId = null;
      if (resolvedCategoryId) {
        const catCheck = await pool.query(
          'SELECT category_id, category_type FROM categories WHERE category_id = $1 AND user_id = $2',
          [resolvedCategoryId, userId]
        );
        if (catCheck.rows.length === 0) {
          const err = new Error('Specified category not found or does not belong to you');
          err.statusCode = 400;
          throw err;
        }
      }
    }

    // Resolve payment_method_id (default to 1 'UPI' or 2 'CASH')
    let resolvedPaymentMethodId = parseId(payment_method_id);
    if (!resolvedPaymentMethodId) {
      const defaultPm = await pool.query(
        'SELECT payment_method_id FROM payment_methods WHERE is_active = true ORDER BY payment_method_id ASC LIMIT 1'
      );
      resolvedPaymentMethodId = defaultPm.rows.length > 0 ? Number(defaultPm.rows[0].payment_method_id) : 1;
    }

    const resolvedDescription = String(description ?? note ?? '').trim() || null;
    const resolvedMerchantId = parseId(merchant_id);
    const resolvedObligationId = parseId(obligation_id);

    const insertQuery = `
      INSERT INTO transactions (
        user_id,
        account_id,
        to_account_id,
        category_id,
        payment_method_id,
        merchant_id,
        obligation_id,
        transaction_type,
        amount,
        transaction_date,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      userId,
      resolvedAccountId,
      resolvedToAccountId,
      resolvedCategoryId,
      resolvedPaymentMethodId,
      resolvedMerchantId,
      resolvedObligationId,
      rawType,
      parsedAmount,
      parsedDate,
      resolvedDescription
    ]);

    const created = formatTransactionRow(result.rows[0]);

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: created
    });
  } catch (err) {
    next(err);
  }
};

// ✅ UPDATE transaction (enforcing user ownership)
const updateTransaction = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const userId = req.user.user_id;

    if (!id) {
      const err = new Error('Valid Transaction ID is required');
      err.statusCode = 400;
      throw err;
    }

    const {
      amount,
      category_id,
      category,
      type,
      transaction_type,
      account_id,
      to_account_id,
      toAccountId,
      payment_method_id,
      note,
      description,
      transaction_date,
      date,
      merchant_id,
      obligation_id
    } = req.body;

    // Verify transaction exists and belongs to the user
    const checkResult = await pool.query(
      'SELECT * FROM transactions WHERE transaction_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      const err = new Error('Transaction not found');
      err.statusCode = 404;
      throw err;
    }

    const existingTx = checkResult.rows[0];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    let targetType = existingTx.transaction_type;
    if (type !== undefined || transaction_type !== undefined) {
      const rawType = String(transaction_type || type).trim().toUpperCase();
      const validTypes = ['INCOME', 'EXPENSE', 'TRANSFER', 'REFUND'];
      if (!validTypes.includes(rawType)) {
        const err = new Error(`Invalid transaction type. Must be one of: ${validTypes.join(', ')}`);
        err.statusCode = 400;
        throw err;
      }
      targetType = rawType;
      updates.push(`transaction_type = $${paramIndex++}`);
      values.push(rawType);
    }

    if (amount !== undefined) {
      const parsedAmount = parseAmount(amount);
      if (!parsedAmount) {
        const err = new Error('Amount must be a positive number');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`amount = $${paramIndex++}`);
      values.push(parsedAmount);
    }

    let targetAccountId = existingTx.account_id;
    if (account_id !== undefined) {
      const accVal = parseId(account_id);
      if (!accVal) {
        const err = new Error('Invalid account ID');
        err.statusCode = 400;
        throw err;
      }
      const accCheck = await pool.query(
        'SELECT account_id FROM accounts WHERE account_id = $1 AND user_id = $2',
        [accVal, userId]
      );
      if (accCheck.rows.length === 0) {
        const err = new Error('Account not found or does not belong to you');
        err.statusCode = 400;
        throw err;
      }
      targetAccountId = accVal;
      updates.push(`account_id = $${paramIndex++}`);
      values.push(accVal);
    }

    if (to_account_id !== undefined || toAccountId !== undefined || (targetType === 'TRANSFER' && !existingTx.to_account_id)) {
      if (targetType === 'TRANSFER') {
        const toAccVal = parseId(to_account_id ?? toAccountId ?? existingTx.to_account_id);
        if (!toAccVal) {
          const err = new Error('Transfer transactions require a destination account (to_account_id)');
          err.statusCode = 400;
          throw err;
        }
        if (toAccVal === Number(targetAccountId)) {
          const err = new Error('Destination account cannot be the same as source account');
          err.statusCode = 400;
          throw err;
        }
        const toAccCheck = await pool.query(
          'SELECT account_id FROM accounts WHERE account_id = $1 AND user_id = $2',
          [toAccVal, userId]
        );
        if (toAccCheck.rows.length === 0) {
          const err = new Error('Destination account not found or does not belong to you');
          err.statusCode = 400;
          throw err;
        }
        updates.push(`to_account_id = $${paramIndex++}`);
        values.push(toAccVal);
      } else {
        updates.push(`to_account_id = $${paramIndex++}`);
        values.push(null);
      }
    } else if (targetType !== 'TRANSFER' && existingTx.to_account_id) {
      updates.push(`to_account_id = $${paramIndex++}`);
      values.push(null);
    }

    if (transaction_date !== undefined || date !== undefined) {
      const parsedDate = parseDate(transaction_date || date);
      if (!parsedDate) {
        const err = new Error('Invalid date format');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`transaction_date = $${paramIndex++}`);
      values.push(parsedDate);
    }

    if (targetType === 'TRANSFER') {
      if (existingTx.category_id !== null) {
        updates.push(`category_id = $${paramIndex++}`);
        values.push(null);
      }
    } else if (category_id !== undefined || category !== undefined) {
      const catVal = parseId(category_id ?? category);
      if (catVal) {
        const catCheck = await pool.query(
          'SELECT category_id FROM categories WHERE category_id = $1 AND user_id = $2',
          [catVal, userId]
        );
        if (catCheck.rows.length === 0) {
          const err = new Error('Category not found or does not belong to you');
          err.statusCode = 400;
          throw err;
        }
      }
      updates.push(`category_id = $${paramIndex++}`);
      values.push(catVal);
    }

    if (payment_method_id !== undefined) {
      const pmVal = parseId(payment_method_id);
      updates.push(`payment_method_id = $${paramIndex++}`);
      values.push(pmVal);
    }

    if (note !== undefined || description !== undefined) {
      const descVal = String(description ?? note ?? '').trim() || null;
      updates.push(`description = $${paramIndex++}`);
      values.push(descVal);
    }

    if (merchant_id !== undefined) {
      updates.push(`merchant_id = $${paramIndex++}`);
      values.push(parseId(merchant_id));
    }

    if (obligation_id !== undefined) {
      updates.push(`obligation_id = $${paramIndex++}`);
      values.push(parseId(obligation_id));
    }

    if (updates.length === 0) {
      const err = new Error('At least one field is required to update');
      err.statusCode = 400;
      throw err;
    }

    values.push(id, userId);
    const updateQuery = `
      UPDATE transactions
      SET ${updates.join(', ')}
      WHERE transaction_id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);
    const updated = formatTransactionRow(result.rows[0]);

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

// ✅ DELETE transaction (enforcing user ownership)
const deleteTransaction = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const userId = req.user.user_id;

    if (!id) {
      const err = new Error('Valid Transaction ID is required');
      err.statusCode = 400;
      throw err;
    }

    const deleteQuery = 'DELETE FROM transactions WHERE transaction_id = $1 AND user_id = $2 RETURNING transaction_id';
    const result = await pool.query(deleteQuery, [id, userId]);

    if (result.rowCount === 0) {
      const err = new Error('Transaction not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      data: { id }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllTransactions,
  getTransactionsByUserId,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction
};
