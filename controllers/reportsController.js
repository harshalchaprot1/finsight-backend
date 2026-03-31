const pool = require('../db');

// ✅ GET monthly spending report grouped by category
const getMonthlyReport = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { month, year } = req.query;

    if (!user_id) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    const currentDate = new Date();
    const reportMonth = month || currentDate.getMonth() + 1;
    const reportYear = year || currentDate.getFullYear();

    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT 
        category,
        SUM(amount) as total_spent,
        COUNT(*) as transaction_count
       FROM Transactions
       WHERE user_id = ? 
       AND MONTH(date) = ? 
       AND YEAR(date) = ?
       GROUP BY category
       ORDER BY total_spent DESC`,
      [user_id, reportMonth, reportYear]
    );
    conn.release();

    const totalExpenses = rows.reduce((sum, row) => sum + parseFloat(row.total_spent), 0);

    res.json({
      success: true,
      message: 'Monthly report retrieved successfully',
      data: {
        user_id,
        month: reportMonth,
        year: reportYear,
        total_expenses: totalExpenses,
        by_category: rows
      }
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET annual spending report grouped by category
const getAnnualReport = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { year } = req.query;

    if (!user_id) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    const reportYear = year || new Date().getFullYear();

    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT 
        category,
        SUM(amount) as total_spent,
        COUNT(*) as transaction_count
       FROM Transactions
       WHERE user_id = ? 
       AND YEAR(date) = ?
       GROUP BY category
       ORDER BY total_spent DESC`,
      [user_id, reportYear]
    );
    conn.release();

    const totalExpenses = rows.reduce((sum, row) => sum + parseFloat(row.total_spent), 0);

    res.json({
      success: true,
      message: 'Annual report retrieved successfully',
      data: {
        user_id,
        year: reportYear,
        total_expenses: totalExpenses,
        by_category: rows
      }
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET monthly spending by month across all categories
const getMonthlySummary = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { year } = req.query;

    if (!user_id) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    const reportYear = year || new Date().getFullYear();

    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT 
        MONTH(date) as month,
        SUM(amount) as total_spent,
        COUNT(*) as transaction_count
       FROM Transactions
       WHERE user_id = ? 
       AND YEAR(date) = ?
       GROUP BY MONTH(date)
       ORDER BY month ASC`,
      [user_id, reportYear]
    );
    conn.release();

    const totalExpenses = rows.reduce((sum, row) => sum + parseFloat(row.total_spent), 0);

    res.json({
      success: true,
      message: 'Monthly summary retrieved successfully',
      data: {
        user_id,
        year: reportYear,
        total_annual_expenses: totalExpenses,
        by_month: rows
      }
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET budget vs actual spending
const getBudgetVsActual = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { month, year } = req.query;

    if (!user_id) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    const currentDate = new Date();
    const reportMonth = month || currentDate.getMonth() + 1;
    const reportYear = year || currentDate.getFullYear();

    const conn = await pool.getConnection();

    // Get budgets
    const [budgets] = await conn.query(
      `SELECT category, limit_amount FROM Budgets WHERE user_id = ? AND (month = ? OR month IS NULL)`,
      [user_id, reportMonth]
    );

    // Get actual spending
    const [spending] = await conn.query(
      `SELECT category, SUM(amount) as total_spent FROM Transactions
       WHERE user_id = ? AND MONTH(date) = ? AND YEAR(date) = ?
       GROUP BY category`,
      [user_id, reportMonth, reportYear]
    );

    conn.release();

    // Combine data
    const comparison = budgets.map(budget => {
      const spent = spending.find(s => s.category === budget.category);
      const actualSpent = spent ? parseFloat(spent.total_spent) : 0;
      const budgetLimit = parseFloat(budget.limit_amount);
      const remaining = budgetLimit - actualSpent;
      const percentageUsed = ((actualSpent / budgetLimit) * 100).toFixed(2);

      return {
        category: budget.category,
        budget_limit: budgetLimit,
        actual_spent: actualSpent,
        remaining: remaining,
        percentage_used: percentageUsed,
        status: percentageUsed >= 100 ? 'over_budget' : percentageUsed >= 80 ? 'warning' : 'on_track'
      };
    });

    res.json({
      success: true,
      message: 'Budget vs actual report retrieved successfully',
      data: {
        user_id,
        month: reportMonth,
        year: reportYear,
        comparison
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMonthlyReport,
  getAnnualReport,
  getMonthlySummary,
  getBudgetVsActual
};
