const pool = require('../db');

const ALLOWED_CATEGORY_TYPES = ['INCOME', 'EXPENSE'];

const formatCategoryRow = (row) => ({
  category_id: Number(row.category_id),
  id: Number(row.category_id),
  user_id: Number(row.user_id),
  userId: Number(row.user_id),
  category_name: row.category_name,
  name: row.category_name,
  category_type: row.category_type,
  type: row.category_type.toLowerCase(),
  created_at: row.created_at
});

// GET categories for authenticated user with optional ?type=INCOME|EXPENSE filter
const getCategories = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { type } = req.query;

    const values = [userId];
    let query = `
      SELECT category_id, user_id, category_name, category_type, created_at
      FROM categories
      WHERE user_id = $1
    `;

    if (type !== undefined && type !== null && String(type).trim() !== '') {
      const normalizedType = String(type).trim().toUpperCase();
      if (!ALLOWED_CATEGORY_TYPES.includes(normalizedType)) {
        const err = new Error(`Invalid category type filter. Must be one of: ${ALLOWED_CATEGORY_TYPES.join(', ')}`);
        err.statusCode = 400;
        throw err;
      }
      query += ' AND category_type = $2';
      values.push(normalizedType);
    }

    query += ' ORDER BY category_type ASC, category_name ASC';

    const result = await pool.query(query, values);
    const categories = result.rows.map(formatCategoryRow);

    res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: categories
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCategories
};