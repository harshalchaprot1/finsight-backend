const pool = require('../db');

// ✅ GET all transactions
const getAllTransactions = async (req, res, next) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM Transactions ORDER BY date DESC');
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
      'SELECT * FROM Transactions WHERE user_id = ? ORDER BY date DESC',
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
    const { user_id, amount, category, description, date } = req.body;

    if (!user_id || !amount || !category) {
      const err = new Error('user_id, amount, and category are required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [result] = await conn.query(
      'INSERT INTO Transactions (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)',
      [user_id, amount, category, description || null, date || new Date()]
    );
    conn.release();

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: {
        id: result.insertId,
        user_id,
        amount,
        category,
        description,
        date: date || new Date()
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
    const { amount, category, description, date } = req.body;

    if (!id) {
      const err = new Error('Transaction ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (!amount && !category && !description && !date) {
      const err = new Error('At least one field is required to update');
      err.statusCode = 400;
      throw err;
    }

    let query = 'UPDATE Transactions SET ';
    const params = [];
    const fields = [];

    if (amount) {
      fields.push('amount = ?');
      params.push(amount);
    }

    if (category) {
      fields.push('category = ?');
      params.push(category);
    }

    if (description) {
      fields.push('description = ?');
      params.push(description);
    }

    if (date) {
      fields.push('date = ?');
      params.push(date);
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
