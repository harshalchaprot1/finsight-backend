const pool = require('../db');

const formatPaymentMethodRow = (row) => ({
  payment_method_id: Number(row.payment_method_id),
  id: Number(row.payment_method_id),
  method_name: row.method_name,
  name: row.method_name,
  description: row.description || '',
  is_active: Boolean(row.is_active)
});

// GET active payment methods
const getPaymentMethods = async (req, res, next) => {
  try {
    const query = `
      SELECT payment_method_id, method_name, description, is_active
      FROM payment_methods
      WHERE is_active = TRUE
      ORDER BY payment_method_id ASC
    `;

    const result = await pool.query(query);
    const methods = result.rows.map(formatPaymentMethodRow);

    res.json({
      success: true,
      message: 'Payment methods retrieved successfully',
      data: methods
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPaymentMethods
};