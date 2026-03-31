const pool = require('../db');

// ✅ GET all budgets
const getAllBudgets = async (req, res, next) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM Budgets');
    conn.release();

    res.json({
      success: true,
      message: 'Budgets retrieved successfully',
      data: rows
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET budgets by user ID
const getBudgetsByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM Budgets WHERE user_id = ?', [userId]);
    conn.release();

    res.json({
      success: true,
      message: 'Budgets retrieved successfully',
      data: rows
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET budget by ID
const getBudgetById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      const err = new Error('Budget ID is required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM Budgets WHERE id = ?', [id]);
    conn.release();

    if (rows.length === 0) {
      const err = new Error('Budget not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Budget retrieved successfully',
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
};

// ✅ CREATE new budget
const createBudget = async (req, res, next) => {
  try {
    const { user_id, category, limit_amount, month, year } = req.body;

    if (!user_id || !category || !limit_amount) {
      const err = new Error('user_id, category, and limit_amount are required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [result] = await conn.query(
      'INSERT INTO Budgets (user_id, category, limit_amount, month, year) VALUES (?, ?, ?, ?, ?)',
      [user_id, category, limit_amount, month || null, year || new Date().getFullYear()]
    );
    conn.release();

    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: {
        id: result.insertId,
        user_id,
        category,
        limit_amount,
        month,
        year: year || new Date().getFullYear()
      }
    });
  } catch (err) {
    next(err);
  }
};

// ✅ UPDATE budget
const updateBudget = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, limit_amount, month, year } = req.body;

    if (!id) {
      const err = new Error('Budget ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (!category && !limit_amount && !month && !year) {
      const err = new Error('At least one field is required to update');
      err.statusCode = 400;
      throw err;
    }

    let query = 'UPDATE Budgets SET ';
    const params = [];
    const fields = [];

    if (category) {
      fields.push('category = ?');
      params.push(category);
    }

    if (limit_amount) {
      fields.push('limit_amount = ?');
      params.push(limit_amount);
    }

    if (month) {
      fields.push('month = ?');
      params.push(month);
    }

    if (year) {
      fields.push('year = ?');
      params.push(year);
    }

    query += fields.join(', ');
    query += ' WHERE id = ?';
    params.push(id);

    const conn = await pool.getConnection();
    const [result] = await conn.query(query, params);
    conn.release();

    if (result.affectedRows === 0) {
      const err = new Error('Budget not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Budget updated successfully'
    });
  } catch (err) {
    next(err);
  }
};

// ✅ DELETE budget
const deleteBudget = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      const err = new Error('Budget ID is required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [result] = await conn.query('DELETE FROM Budgets WHERE id = ?', [id]);
    conn.release();

    if (result.affectedRows === 0) {
      const err = new Error('Budget not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllBudgets,
  getBudgetsByUserId,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget
};
