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
    const {
      user_id,
      category_id,
      category,
      amount,
      limit_amount,
      start_date,
      end_date,
      month,
      year,
      version
    } = req.body;

    const resolvedCategoryId = category_id ?? category;
    const resolvedAmount = amount ?? limit_amount;

    const now = new Date();
    const resolvedMonth = month || now.getMonth() + 1;
    const resolvedYear = year || now.getFullYear();

    const resolvedStartDate = start_date || new Date(resolvedYear, resolvedMonth - 1, 1);
    const resolvedEndDate = end_date || new Date(resolvedYear, resolvedMonth, 0);
    const resolvedVersion = version ?? 0;

    if (!user_id || !resolvedCategoryId || resolvedAmount === undefined) {
      const err = new Error('user_id, category_id, and amount are required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [result] = await conn.query(
      `INSERT INTO Budgets
       (user_id, category_id, amount, start_date, end_date, version)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, resolvedCategoryId, resolvedAmount, resolvedStartDate, resolvedEndDate, resolvedVersion]
    );
    conn.release();

    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: {
        id: result.insertId,
        user_id,
        category_id: resolvedCategoryId,
        amount: resolvedAmount,
        start_date: resolvedStartDate,
        end_date: resolvedEndDate,
        version: resolvedVersion
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
    const {
      category_id,
      category,
      amount,
      limit_amount,
      start_date,
      end_date,
      version
    } = req.body;

    if (!id) {
      const err = new Error('Budget ID is required');
      err.statusCode = 400;
      throw err;
    }

    const hasCategory = category_id !== undefined || category !== undefined;
    const hasAmount = amount !== undefined || limit_amount !== undefined;
    const hasStartDate = start_date !== undefined;
    const hasEndDate = end_date !== undefined;
    const hasVersion = version !== undefined;

    if (!hasCategory && !hasAmount && !hasStartDate && !hasEndDate && !hasVersion) {
      const err = new Error('At least one field is required to update');
      err.statusCode = 400;
      throw err;
    }

    let query = 'UPDATE Budgets SET ';
    const params = [];
    const fields = [];

    if (hasCategory) {
      fields.push('category_id = ?');
      params.push(category_id ?? category);
    }

    if (hasAmount) {
      fields.push('amount = ?');
      params.push(amount ?? limit_amount);
    }

    if (hasStartDate) {
      fields.push('start_date = ?');
      params.push(start_date);
    }

    if (hasEndDate) {
      fields.push('end_date = ?');
      params.push(end_date);
    }

    if (hasVersion) {
      fields.push('version = ?');
      params.push(version);
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
