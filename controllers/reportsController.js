const pool = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_env';

const parseUserId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getUserIdFromToken = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return parseUserId(decoded?.id || decoded?.user_id || decoded?.userId);
  } catch (err) {
    return null;
  }
};

const resolveUserId = (req) => {
  const fromParams = parseUserId(req.params.user_id || req.params.userId || req.params.id);
  if (fromParams) {
    return fromParams;
  }

  const fromQuery = parseUserId(req.query.user_id || req.query.userId || req.query.id);
  if (fromQuery) {
    return fromQuery;
  }

  const fromBody = parseUserId(req.body?.user_id || req.body?.userId || req.body?.id);
  if (fromBody) {
    return fromBody;
  }

  return getUserIdFromToken(req);
};

const parsePeriod = (month, year) => {
  const now = new Date();
  const parsedMonth = Number.parseInt(month, 10);
  const parsedYear = Number.parseInt(year, 10);

  return {
    month: Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : now.getMonth() + 1,
    year: Number.isInteger(parsedYear) && parsedYear >= 1900
      ? parsedYear
      : now.getFullYear()
  };
};

// ✅ GET dashboard summary (income, spending, net, top categories)
const getDashboardSummary = async (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    const period = parsePeriod(req.query.month, req.query.year);

    if (!userId) {
      const err = new Error('User ID is required (path, query, body, or token)');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();

    const [totalsRows] = await conn.query(
      `SELECT
         COALESCE(SUM(CASE WHEN LOWER(type) = 'income' THEN amount END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN LOWER(type) <> 'income' OR type IS NULL THEN amount END), 0) AS total_expense,
         COUNT(*) AS transaction_count
       FROM Transactions
       WHERE user_id = ?
         AND MONTH(transaction_date) = ?
         AND YEAR(transaction_date) = ?`,
      [userId, period.month, period.year]
    );

    const [categoryRows] = await conn.query(
      `SELECT
         category_id,
         COALESCE(SUM(amount), 0) AS total_spent,
         COUNT(*) AS transaction_count
       FROM Transactions
       WHERE user_id = ?
         AND MONTH(transaction_date) = ?
         AND YEAR(transaction_date) = ?
         AND (LOWER(type) <> 'income' OR type IS NULL)
       GROUP BY category_id
       ORDER BY total_spent DESC
       LIMIT 5`,
      [userId, period.month, period.year]
    );

    conn.release();

    const totals = totalsRows[0] || { total_income: 0, total_expense: 0, transaction_count: 0 };
    const totalIncome = Number.parseFloat(totals.total_income) || 0;
    const totalExpense = Number.parseFloat(totals.total_expense) || 0;

    res.json({
      success: true,
      message: 'Dashboard summary retrieved successfully',
      data: {
        user_id: userId,
        month: period.month,
        year: period.year,
        total_income: totalIncome,
        total_expense: totalExpense,
        net_savings: totalIncome - totalExpense,
        transaction_count: Number(totals.transaction_count) || 0,
        top_categories: categoryRows.map((row) => ({
          category_id: row.category_id,
          total_spent: Number.parseFloat(row.total_spent) || 0,
          transaction_count: Number(row.transaction_count) || 0
        }))
      },
      summary: {
        userId,
        month: period.month,
        year: period.year,
        totalIncome,
        totalExpense,
        netSavings: totalIncome - totalExpense,
        transactionCount: Number(totals.transaction_count) || 0,
        categoryPerformance: categoryRows.map((row) => ({
          categoryId: row.category_id,
          totalSpent: Number.parseFloat(row.total_spent) || 0,
          transactionCount: Number(row.transaction_count) || 0
        }))
      }
    });
  } catch (err) {
    next(err);
  }
};

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
        category_id,
        SUM(amount) as total_spent,
        COUNT(*) as transaction_count
       FROM Transactions
       WHERE user_id = ? 
       AND MONTH(transaction_date) = ? 
       AND YEAR(transaction_date) = ?
       GROUP BY category_id
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
        category_id,
        SUM(amount) as total_spent,
        COUNT(*) as transaction_count
       FROM Transactions
       WHERE user_id = ? 
       AND YEAR(transaction_date) = ?
       GROUP BY category_id
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
        MONTH(transaction_date) as month,
        SUM(amount) as total_spent,
        COUNT(*) as transaction_count
       FROM Transactions
       WHERE user_id = ? 
       AND YEAR(transaction_date) = ?
       GROUP BY MONTH(transaction_date)
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
      `SELECT category_id, amount FROM Budgets
       WHERE user_id = ?
       AND (
         MONTH(start_date) = ? OR MONTH(end_date) = ? OR
         (start_date IS NULL AND end_date IS NULL)
       )`,
      [user_id, reportMonth, reportMonth]
    );

    // Get actual spending
    const [spending] = await conn.query(
      `SELECT category_id, SUM(amount) as total_spent FROM Transactions
       WHERE user_id = ? AND MONTH(transaction_date) = ? AND YEAR(transaction_date) = ?
       GROUP BY category_id`,
      [user_id, reportMonth, reportYear]
    );

    conn.release();

    // Combine data
    const comparison = budgets.map(budget => {
      const spent = spending.find(s => s.category_id === budget.category_id);
      const actualSpent = spent ? parseFloat(spent.total_spent) : 0;
      const budgetLimit = parseFloat(budget.amount);
      const remaining = budgetLimit - actualSpent;
      const percentageUsed = ((actualSpent / budgetLimit) * 100).toFixed(2);

      return {
        category_id: budget.category_id,
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
  getDashboardSummary,
  getMonthlyReport,
  getAnnualReport,
  getMonthlySummary,
  getBudgetVsActual
};
