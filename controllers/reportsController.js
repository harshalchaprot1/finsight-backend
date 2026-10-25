const pool = require('../db');

const parseId = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const parsed = Number.parseInt(val, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
// Dual compatibility: supports Angular ReportsService.getSummary() and dashboard metrics
const getDashboardSummary = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    // Optional query param override if specified in URL, else if user_id passed in param verify it
    if (req.params.user_id) {
      const paramUserId = parseId(req.params.user_id);
      if (paramUserId && paramUserId !== userId) {
        const err = new Error('Forbidden: You cannot access financial summary of another user');
        err.statusCode = 403;
        throw err;
      }
    }

    const period = parsePeriod(req.query.month, req.query.year);

    // 1. Calculate totals for month using PostgreSQL EXTRACT
    const totalsQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN transaction_type IN ('INCOME', 'REFUND') THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS total_expense,
        COUNT(*) AS transaction_count
      FROM transactions
      WHERE user_id = $1
        AND EXTRACT(MONTH FROM transaction_date) = $2
        AND EXTRACT(YEAR FROM transaction_date) = $3
    `;

    // 2. Calculate top categories by spending for month
    const categoryQuery = `
      SELECT
        t.category_id,
        COALESCE(c.category_name, 'Uncategorized') AS category_name,
        COALESCE(SUM(t.amount), 0) AS total_spent,
        COUNT(*) AS transaction_count
      FROM transactions t
      LEFT JOIN categories c ON c.category_id = t.category_id AND c.user_id = t.user_id
      WHERE t.user_id = $1
        AND EXTRACT(MONTH FROM t.transaction_date) = $2
        AND EXTRACT(YEAR FROM t.transaction_date) = $3
        AND t.transaction_type = 'EXPENSE'
      GROUP BY t.category_id, c.category_name
      ORDER BY total_spent DESC
      LIMIT 5
    `;

    const [totalsResult, categoryResult] = await Promise.all([
      pool.query(totalsQuery, [userId, period.month, period.year]),
      pool.query(categoryQuery, [userId, period.month, period.year])
    ]);

    const totals = totalsResult.rows[0] || { total_income: 0, total_expense: 0, transaction_count: 0 };
    const totalIncome = Math.round((Number.parseFloat(totals.total_income) || 0) * 100) / 100;
    const totalExpense = Math.round((Number.parseFloat(totals.total_expense) || 0) * 100) / 100;
    const netSavings = Math.round((totalIncome - totalExpense) * 100) / 100;
    const transactionCount = Number(totals.transaction_count) || 0;

    const topCategories = categoryResult.rows.map((row) => ({
      category_id: row.category_id ? Number(row.category_id) : null,
      categoryId: row.category_id ? Number(row.category_id) : null,
      category_name: row.category_name,
      total_spent: Math.round((Number.parseFloat(row.total_spent) || 0) * 100) / 100,
      totalSpent: Math.round((Number.parseFloat(row.total_spent) || 0) * 100) / 100,
      transaction_count: Number(row.transaction_count) || 0,
      transactionCount: Number(row.transaction_count) || 0
    }));

    res.json({
      success: true,
      message: 'Dashboard summary retrieved successfully',
      data: {
        user_id: userId,
        month: period.month,
        year: period.year,
        total_income: totalIncome,
        total_expense: totalExpense,
        net_savings: netSavings,
        transaction_count: transactionCount,
        top_categories: topCategories
      },
      summary: {
        userId,
        month: period.month,
        year: period.year,
        totalIncome,
        totalExpense,
        netSavings,
        balance: netSavings,
        transactionCount,
        categoryPerformance: topCategories
      }
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET monthly spending report grouped by category
const getMonthlyReport = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    if (req.params.user_id) {
      const requestedId = parseId(req.params.user_id);
      if (requestedId && requestedId !== userId) {
        const err = new Error('Forbidden: You cannot access reports for another user');
        err.statusCode = 403;
        throw err;
      }
    }

    const period = parsePeriod(req.query.month, req.query.year);

    const query = `
      SELECT
        t.category_id,
        COALESCE(c.category_name, 'Uncategorized') AS category_name,
        COALESCE(SUM(t.amount), 0) AS total_spent,
        COUNT(*) AS transaction_count
      FROM transactions t
      LEFT JOIN categories c ON c.category_id = t.category_id AND c.user_id = t.user_id
      WHERE t.user_id = $1
        AND EXTRACT(MONTH FROM t.transaction_date) = $2
        AND EXTRACT(YEAR FROM t.transaction_date) = $3
        AND t.transaction_type = 'EXPENSE'
      GROUP BY t.category_id, c.category_name
      ORDER BY total_spent DESC
    `;

    const result = await pool.query(query, [userId, period.month, period.year]);
    const totalExpenses = Math.round(result.rows.reduce((sum, row) => sum + (Number.parseFloat(row.total_spent) || 0), 0) * 100) / 100;

    const byCategory = result.rows.map((row) => {
      const spent = Math.round((Number.parseFloat(row.total_spent) || 0) * 100) / 100;
      return {
        category_id: row.category_id ? Number(row.category_id) : null,
        categoryId: row.category_id ? Number(row.category_id) : null,
        category_name: row.category_name,
        total_spent: spent,
        totalSpent: spent,
        transaction_count: Number(row.transaction_count) || 0,
        transactionCount: Number(row.transaction_count) || 0
      };
    });

    res.json({
      success: true,
      message: 'Monthly report retrieved successfully',
      data: {
        user_id: userId,
        month: period.month,
        year: period.year,
        total_expenses: totalExpenses,
        by_category: byCategory
      }
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET annual spending report grouped by category
const getAnnualReport = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    if (req.params.user_id) {
      const requestedId = parseId(req.params.user_id);
      if (requestedId && requestedId !== userId) {
        const err = new Error('Forbidden: You cannot access reports for another user');
        err.statusCode = 403;
        throw err;
      }
    }

    const reportYear = Number.parseInt(req.query.year, 10) || new Date().getFullYear();

    const query = `
      SELECT
        t.category_id,
        COALESCE(c.category_name, 'Uncategorized') AS category_name,
        COALESCE(SUM(t.amount), 0) AS total_spent,
        COUNT(*) AS transaction_count
      FROM transactions t
      LEFT JOIN categories c ON c.category_id = t.category_id AND c.user_id = t.user_id
      WHERE t.user_id = $1
        AND EXTRACT(YEAR FROM t.transaction_date) = $2
        AND t.transaction_type = 'EXPENSE'
      GROUP BY t.category_id, c.category_name
      ORDER BY total_spent DESC
    `;

    const result = await pool.query(query, [userId, reportYear]);
    const totalExpenses = Math.round(result.rows.reduce((sum, row) => sum + (Number.parseFloat(row.total_spent) || 0), 0) * 100) / 100;

    const byCategory = result.rows.map((row) => {
      const spent = Math.round((Number.parseFloat(row.total_spent) || 0) * 100) / 100;
      return {
        category_id: row.category_id ? Number(row.category_id) : null,
        categoryId: row.category_id ? Number(row.category_id) : null,
        category_name: row.category_name,
        total_spent: spent,
        totalSpent: spent,
        transaction_count: Number(row.transaction_count) || 0,
        transactionCount: Number(row.transaction_count) || 0
      };
    });

    res.json({
      success: true,
      message: 'Annual report retrieved successfully',
      data: {
        user_id: userId,
        year: reportYear,
        total_expenses: totalExpenses,
        by_category: byCategory
      }
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET monthly spending by month across all categories (for year charts)
const getMonthlySummary = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    if (req.params.user_id) {
      const requestedId = parseId(req.params.user_id);
      if (requestedId && requestedId !== userId) {
        const err = new Error('Forbidden: You cannot access reports for another user');
        err.statusCode = 403;
        throw err;
      }
    }

    const reportYear = Number.parseInt(req.query.year, 10) || new Date().getFullYear();

    // Query v_monthly_financial_summary directly
    const query = `
      SELECT
        EXTRACT(MONTH FROM month)::INT AS month,
        COALESCE(total_income, 0) AS total_income,
        COALESCE(total_expenses, 0) AS total_spent,
        COALESCE(total_refunds, 0) AS total_refunds,
        COALESCE(net_cash_flow, 0) AS net_cash_flow
      FROM v_monthly_financial_summary
      WHERE user_id = $1
        AND EXTRACT(YEAR FROM month) = $2
      ORDER BY month ASC
    `;

    const result = await pool.query(query, [userId, reportYear]);
    const totalAnnualExpenses = Math.round(result.rows.reduce((sum, row) => sum + (Number.parseFloat(row.total_spent) || 0), 0) * 100) / 100;

    res.json({
      success: true,
      message: 'Monthly summary retrieved successfully',
      data: {
        user_id: userId,
        year: reportYear,
        total_annual_expenses: totalAnnualExpenses,
        by_month: result.rows.map((r) => ({
          month: Number(r.month),
          total_income: Math.round((Number.parseFloat(r.total_income) || 0) * 100) / 100,
          total_spent: Math.round((Number.parseFloat(r.total_spent) || 0) * 100) / 100,
          total_refunds: Math.round((Number.parseFloat(r.total_refunds) || 0) * 100) / 100,
          net_cash_flow: Math.round((Number.parseFloat(r.net_cash_flow) || 0) * 100) / 100
        }))
      }
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET budget vs actual spending (using v_budget_status)
const getBudgetVsActual = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    if (req.params.user_id) {
      const requestedId = parseId(req.params.user_id);
      if (requestedId && requestedId !== userId) {
        const err = new Error('Forbidden: You cannot access reports for another user');
        err.statusCode = 403;
        throw err;
      }
    }

    const period = parsePeriod(req.query.month, req.query.year);

    const query = `
      SELECT
        b.budget_id,
        b.category_id,
        c.category_name,
        b.monthly_limit AS budget_limit,
        COALESCE(v.actual_spending, 0) AS actual_spent,
        COALESCE(v.remaining_budget, b.monthly_limit) AS remaining,
        COALESCE(v.utilization_percentage, 0) AS percentage_used
      FROM budgets b
      JOIN categories c ON c.category_id = b.category_id AND c.user_id = b.user_id
      LEFT JOIN v_budget_status v ON v.budget_id = b.budget_id AND v.user_id = b.user_id
      WHERE b.user_id = $1
        AND (
          (EXTRACT(MONTH FROM b.month_start) = $2 AND EXTRACT(YEAR FROM b.month_start) = $3)
          OR (b.month_start <= make_date($3::int, $2::int, 1) AND b.month_end >= make_date($3::int, $2::int, 1))
        )
      ORDER BY b.monthly_limit DESC
    `;

    const result = await pool.query(query, [userId, period.month, period.year]);

    const comparison = result.rows.map((row) => {
      const budgetLimit = Math.round((Number.parseFloat(row.budget_limit) || 0) * 100) / 100;
      const actualSpent = Math.round((Number.parseFloat(row.actual_spent) || 0) * 100) / 100;
      const remaining = Math.round((Number.parseFloat(row.remaining) || 0) * 100) / 100;
      const percentageUsed = Math.round((Number.parseFloat(row.percentage_used) || 0) * 100) / 100;

      let status = 'on_track';
      if (percentageUsed >= 100) {
        status = 'over_budget';
      } else if (percentageUsed >= 80) {
        status = 'warning';
      }

      return {
        budget_id: Number(row.budget_id),
        category_id: Number(row.category_id),
        category_name: row.category_name,
        budget_limit: budgetLimit,
        actual_spent: actualSpent,
        remaining,
        percentage_used: percentageUsed,
        status
      };
    });

    res.json({
      success: true,
      message: 'Budget vs actual report retrieved successfully',
      data: {
        user_id: userId,
        month: period.month,
        year: period.year,
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
