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
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

// Formats a budget row for both PostgreSQL and frontend backwards compatibility
const formatBudgetRow = (row) => ({
  id: Number(row.budget_id),
  budget_id: Number(row.budget_id),
  user_id: Number(row.user_id),
  userId: Number(row.user_id),
  category_id: Number(row.category_id),
  category_name: row.category_name || undefined,
  category: row.category_name || String(row.category_id),
  monthly_limit: Number.parseFloat(row.monthly_limit),
  limit_amount: Number.parseFloat(row.monthly_limit),
  amount: Number.parseFloat(row.monthly_limit),
  limitAmount: Number.parseFloat(row.monthly_limit),
  month_start: row.month_start instanceof Date
    ? row.month_start.toISOString().slice(0, 10)
    : String(row.month_start).slice(0, 10),
  start_date: row.month_start instanceof Date
    ? row.month_start.toISOString().slice(0, 10)
    : String(row.month_start).slice(0, 10),
  month_end: row.month_end instanceof Date
    ? row.month_end.toISOString().slice(0, 10)
    : String(row.month_end).slice(0, 10),
  end_date: row.month_end instanceof Date
    ? row.month_end.toISOString().slice(0, 10)
    : String(row.month_end).slice(0, 10),
  actual_spending: row.actual_spending != null ? Number.parseFloat(row.actual_spending) : 0,
  spent: row.actual_spending != null ? Number.parseFloat(row.actual_spending) : 0,
  remaining_budget: row.remaining_budget != null ? Number.parseFloat(row.remaining_budget) : Number.parseFloat(row.monthly_limit),
  utilization_percentage: row.utilization_percentage != null ? Number.parseFloat(row.utilization_percentage) : 0,
  created_at: row.created_at
});

// ✅ GET all budgets for authenticated user
const getAllBudgets = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    // Use v_budget_status to include actual spending alongside budget definition
    const query = `
      SELECT
        b.budget_id,
        b.user_id,
        b.category_id,
        c.category_name,
        b.monthly_limit,
        b.month_start,
        b.month_end,
        b.created_at,
        v.actual_spending,
        v.remaining_budget,
        v.utilization_percentage
      FROM budgets b
      JOIN categories c ON c.category_id = b.category_id AND c.user_id = b.user_id
      LEFT JOIN v_budget_status v ON v.budget_id = b.budget_id AND v.user_id = b.user_id
      WHERE b.user_id = $1
      ORDER BY b.month_start DESC, b.budget_id DESC
    `;

    const result = await pool.query(query, [userId]);
    const data = result.rows.map(formatBudgetRow);

    res.json({
      success: true,
      message: 'Budgets retrieved successfully',
      data
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET budgets by user ID (enforcing user ownership)
const getBudgetsByUserId = async (req, res, next) => {
  try {
    const requestedUserId = parseId(req.params.userId);
    const authUserId = req.user.user_id;

    if (!requestedUserId) {
      const err = new Error('Valid User ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (requestedUserId !== authUserId) {
      const err = new Error('Forbidden: You are not authorized to access another user\'s budgets');
      err.statusCode = 403;
      throw err;
    }

    const query = `
      SELECT
        b.budget_id,
        b.user_id,
        b.category_id,
        c.category_name,
        b.monthly_limit,
        b.month_start,
        b.month_end,
        b.created_at,
        v.actual_spending,
        v.remaining_budget,
        v.utilization_percentage
      FROM budgets b
      JOIN categories c ON c.category_id = b.category_id AND c.user_id = b.user_id
      LEFT JOIN v_budget_status v ON v.budget_id = b.budget_id AND v.user_id = b.user_id
      WHERE b.user_id = $1
      ORDER BY b.month_start DESC, b.budget_id DESC
    `;

    const result = await pool.query(query, [authUserId]);
    const data = result.rows.map(formatBudgetRow);

    res.json({
      success: true,
      message: 'Budgets retrieved successfully',
      data
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET budget by ID (with ownership check)
const getBudgetById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const userId = req.user.user_id;

    if (!id) {
      const err = new Error('Valid Budget ID is required');
      err.statusCode = 400;
      throw err;
    }

    const query = `
      SELECT
        b.budget_id,
        b.user_id,
        b.category_id,
        c.category_name,
        b.monthly_limit,
        b.month_start,
        b.month_end,
        b.created_at,
        v.actual_spending,
        v.remaining_budget,
        v.utilization_percentage
      FROM budgets b
      JOIN categories c ON c.category_id = b.category_id AND c.user_id = b.user_id
      LEFT JOIN v_budget_status v ON v.budget_id = b.budget_id AND v.user_id = b.user_id
      WHERE b.budget_id = $1 AND b.user_id = $2
    `;

    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      const err = new Error('Budget not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Budget retrieved successfully',
      data: formatBudgetRow(result.rows[0])
    });
  } catch (err) {
    next(err);
  }
};

// ✅ CREATE new budget
const createBudget = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const {
      category_id,
      category,
      amount,
      limit_amount,
      monthly_limit,
      start_date,
      end_date,
      month_start,
      month_end,
      month,
      year
    } = req.body;

    const resolvedCategoryId = parseId(category_id ?? category);
    if (!resolvedCategoryId) {
      const err = new Error('A valid category_id is required');
      err.statusCode = 400;
      throw err;
    }

    // Category must belong to the user and be of EXPENSE type
    const catCheck = await pool.query(
      'SELECT category_id, category_type FROM categories WHERE category_id = $1 AND user_id = $2',
      [resolvedCategoryId, userId]
    );

    if (catCheck.rows.length === 0) {
      const err = new Error('Specified category not found or does not belong to you');
      err.statusCode = 400;
      throw err;
    }

    if (catCheck.rows[0].category_type !== 'EXPENSE') {
      const err = new Error('Budgets can only be created for EXPENSE categories');
      err.statusCode = 400;
      throw err;
    }

    const resolvedLimit = parseAmount(monthly_limit ?? limit_amount ?? amount);
    if (!resolvedLimit) {
      const err = new Error('Budget limit must be a positive number');
      err.statusCode = 400;
      throw err;
    }

    // Determine month_start and month_end
    const now = new Date();
    const resolvedMonth = Number.parseInt(month, 10) || now.getMonth() + 1;
    const resolvedYear = Number.parseInt(year, 10) || now.getFullYear();

    let startDate = parseDate(month_start || start_date);
    let endDate = parseDate(month_end || end_date);

    if (!startDate || !endDate) {
      // Generate first and last day of target month
      const firstDay = new Date(Date.UTC(resolvedYear, resolvedMonth - 1, 1));
      const lastDay = new Date(Date.UTC(resolvedYear, resolvedMonth, 0));
      startDate = firstDay.toISOString().slice(0, 10);
      endDate = lastDay.toISOString().slice(0, 10);
    }

    if (startDate > endDate) {
      const err = new Error('month_start must be earlier than or equal to month_end');
      err.statusCode = 400;
      throw err;
    }

    const insertQuery = `
      INSERT INTO budgets (user_id, category_id, monthly_limit, month_start, month_end)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      userId,
      resolvedCategoryId,
      resolvedLimit,
      startDate,
      endDate
    ]);

    const created = formatBudgetRow(result.rows[0]);

    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: created
    });
  } catch (err) {
    next(err);
  }
};

// ✅ UPDATE budget (enforcing user ownership)
const updateBudget = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const userId = req.user.user_id;

    if (!id) {
      const err = new Error('Valid Budget ID is required');
      err.statusCode = 400;
      throw err;
    }

    const {
      category_id,
      category,
      amount,
      limit_amount,
      monthly_limit,
      start_date,
      end_date,
      month_start,
      month_end
    } = req.body;

    const existingCheck = await pool.query(
      'SELECT * FROM budgets WHERE budget_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingCheck.rows.length === 0) {
      const err = new Error('Budget not found');
      err.statusCode = 404;
      throw err;
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (category_id !== undefined || category !== undefined) {
      const catVal = parseId(category_id ?? category);
      if (!catVal) {
        const err = new Error('Valid category_id is required');
        err.statusCode = 400;
        throw err;
      }
      const catCheck = await pool.query(
        'SELECT category_id, category_type FROM categories WHERE category_id = $1 AND user_id = $2',
        [catVal, userId]
      );
      if (catCheck.rows.length === 0) {
        const err = new Error('Category not found or does not belong to you');
        err.statusCode = 400;
        throw err;
      }
      if (catCheck.rows[0].category_type !== 'EXPENSE') {
        const err = new Error('Budgets can only be assigned to EXPENSE categories');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`category_id = $${paramIndex++}`);
      values.push(catVal);
    }

    if (monthly_limit !== undefined || limit_amount !== undefined || amount !== undefined) {
      const parsedLimit = parseAmount(monthly_limit ?? limit_amount ?? amount);
      if (!parsedLimit) {
        const err = new Error('monthly_limit must be a positive number');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`monthly_limit = $${paramIndex++}`);
      values.push(parsedLimit);
    }

    let parsedStart;
    if (month_start !== undefined || start_date !== undefined) {
      parsedStart = parseDate(month_start || start_date);
      if (!parsedStart) {
        const err = new Error('Invalid month_start date format');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`month_start = $${paramIndex++}`);
      values.push(parsedStart);
    }

    let parsedEnd;
    if (month_end !== undefined || end_date !== undefined) {
      parsedEnd = parseDate(month_end || end_date);
      if (!parsedEnd) {
        const err = new Error('Invalid month_end date format');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`month_end = $${paramIndex++}`);
      values.push(parsedEnd);
    }

    const effectiveStart = parsedStart || (existingCheck.rows[0].month_start instanceof Date
      ? existingCheck.rows[0].month_start.toISOString().slice(0, 10)
      : String(existingCheck.rows[0].month_start).slice(0, 10));
    const effectiveEnd = parsedEnd || (existingCheck.rows[0].month_end instanceof Date
      ? existingCheck.rows[0].month_end.toISOString().slice(0, 10)
      : String(existingCheck.rows[0].month_end).slice(0, 10));

    if (effectiveStart > effectiveEnd) {
      const err = new Error('month_start must be earlier than or equal to month_end');
      err.statusCode = 400;
      throw err;
    }

    if (updates.length === 0) {
      const err = new Error('At least one field is required to update');
      err.statusCode = 400;
      throw err;
    }

    values.push(id, userId);
    const updateQuery = `
      UPDATE budgets
      SET ${updates.join(', ')}
      WHERE budget_id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);
    const updated = formatBudgetRow(result.rows[0]);

    res.json({
      success: true,
      message: 'Budget updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

// ✅ DELETE budget (enforcing user ownership)
const deleteBudget = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const userId = req.user.user_id;

    if (!id) {
      const err = new Error('Valid Budget ID is required');
      err.statusCode = 400;
      throw err;
    }

    const deleteQuery = 'DELETE FROM budgets WHERE budget_id = $1 AND user_id = $2 RETURNING budget_id';
    const result = await pool.query(deleteQuery, [id, userId]);

    if (result.rowCount === 0) {
      const err = new Error('Budget not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'Budget deleted successfully',
      data: { id }
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
