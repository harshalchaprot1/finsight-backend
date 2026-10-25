// Centralized error handling middleware for PostgreSQL and Express
const errorHandler = (err, req, res, next) => {
  // Log unexpected server errors
  if (!err.statusCode || err.statusCode >= 500) {
    console.error('❌ Server Error:', err.message, err.stack);
  }

  // 1. PostgreSQL Specific Error Codes (class 23: Integrity Constraint Violations)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Conflict: A record with this identifier or unique attribute already exists',
      detail: err.detail || undefined
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Foreign key violation: Referenced account, category, merchant, or obligation does not exist or does not belong to you',
      detail: err.detail || undefined
    });
  }

  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      message: 'Check constraint violation: Input data fails business rule validations',
      detail: err.detail || undefined
    });
  }

  if (err.code === '23502') {
    return res.status(400).json({
      success: false,
      message: `Missing required column value: ${err.column || 'a required field is null'}`
    });
  }

  // PostgreSQL syntax / datatype error (e.g. invalid integer syntax, invalid date representation)
  if (err.code === '22P02' || err.code === '22007' || err.code === '22008') {
    return res.status(400).json({
      success: false,
      message: 'Invalid data format or type provided (e.g. invalid date, number, or uuid format)'
    });
  }

  // 2. HTTP Status Code Errors
  if (err.statusCode && err.statusCode < 500) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  // 3. Fallback Internal Server Error
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    message: isProduction ? 'An internal server error occurred' : (err.message || 'Internal server error')
  });
};

module.exports = errorHandler;
