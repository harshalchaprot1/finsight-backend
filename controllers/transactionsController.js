const pool = require('../db');

// ✅ GET all transactions
const getAllTransactions = async (req, res, next) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM Transactions ORDER BY transaction_date DESC, id DESC');
    conn.release();

    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: rows
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET transactions by user ID
const getTransactionsByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT * FROM Transactions WHERE user_id = ? ORDER BY transaction_date DESC, id DESC',
      [userId]
    );
    conn.release();

    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: rows
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET transaction by ID
const getTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      const err = new Error('Transaction ID is required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM Transactions WHERE id = ?', [id]);
    conn.release();

    if (rows.length === 0) {
      const err = new Error('Transaction not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Transaction retrieved successfully',
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
};

// ✅ CREATE new transaction
const createTransaction = async (req, res, next) => {
  try {
    const {
      user_id,
      amount,
      category_id,
      category,
      type,
      note,
      description,
      transaction_date,
      date,
      brand_id
    } = req.body;

    const formatDateForMySQL = (val) => {
      if (!val) return null;
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };

    const resolvedCategoryId = category_id ?? category;
    const resolvedType = type || 'expense';
    const resolvedNote = note ?? description ?? null;
    const rawDate = transaction_date || date || new Date();
    const resolvedTransactionDate = formatDateForMySQL(rawDate);
    const resolvedBrandId = brand_id || null;

    if (!user_id || !amount || !resolvedCategoryId) {
      const err = new Error('user_id, amount, and category_id are required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [result] = await conn.query(
      `INSERT INTO Transactions
       (user_id, brand_id, category_id, amount, type, note, transaction_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, resolvedBrandId, resolvedCategoryId, amount, resolvedType, resolvedNote, resolvedTransactionDate]
    );
    conn.release();

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: {
        id: result.insertId,
        user_id,
        brand_id: resolvedBrandId,
        category_id: resolvedCategoryId,
        amount,
        type: resolvedType,
        note: resolvedNote,
        transaction_date: resolvedTransactionDate
      }
    });
  } catch (err) {
    next(err);
  }
};

// ✅ UPDATE transaction
const updateTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      amount,
      category_id,
      category,
      type,
      note,
      description,
      transaction_date,
      date,
      brand_id
    } = req.body;

    if (!id) {
      const err = new Error('Transaction ID is required');
      err.statusCode = 400;
      throw err;
    }

    const hasAmount = amount !== undefined;
    const hasCategory = category_id !== undefined || category !== undefined;
    const hasType = type !== undefined;
    const hasNote = note !== undefined || description !== undefined;
    const hasDate = transaction_date !== undefined || date !== undefined;
    const hasBrand = brand_id !== undefined;

    const formatDateForMySQL = (val) => {
      if (!val) return null;
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };

    if (!hasAmount && !hasCategory && !hasType && !hasNote && !hasDate && !hasBrand) {
      const err = new Error('At least one field is required to update');
      err.statusCode = 400;
      throw err;
    }

    let query = 'UPDATE Transactions SET ';
    const params = [];
    const fields = [];

    if (hasAmount) {
      fields.push('amount = ?');
      params.push(amount);
    }

    if (hasCategory) {
      fields.push('category_id = ?');
      params.push(category_id ?? category);
    }

    if (hasType) {
      fields.push('type = ?');
      params.push(type);
    }

    if (hasNote) {
      fields.push('note = ?');
      params.push(note ?? description);
    }

    if (hasDate) {
      fields.push('transaction_date = ?');
      params.push(formatDateForMySQL(transaction_date ?? date));
    }

    if (hasBrand) {
      fields.push('brand_id = ?');
      params.push(brand_id);
    }

    query += fields.join(', ');
    query += ' WHERE id = ?';
    params.push(id);

    const conn = await pool.getConnection();
    const [result] = await conn.query(query, params);
    conn.release();

    if (result.affectedRows === 0) {
      const err = new Error('Transaction not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Transaction updated successfully'
    });
  } catch (err) {
    next(err);
  }
};

// ✅ DELETE transaction
const deleteTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      const err = new Error('Transaction ID is required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [result] = await conn.query('DELETE FROM Transactions WHERE id = ?', [id]);
    conn.release();

    if (result.affectedRows === 0) {
      const err = new Error('Transaction not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
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
