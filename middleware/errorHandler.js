// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  // Database errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry: This record already exists',
      error: err.message
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Invalid reference: Related record does not exist',
      error: err.message
    });
  }

  if (err.code?.startsWith('ER_')) {
    return res.status(400).json({
      success: false,
      message: 'Database error',
      error: err.message
    });
  }

  // Validation errors
  if (err.statusCode === 400) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // Not found errors
  if (err.statusCode === 404) {
    return res.status(404).json({
      success: false,
      message: err.message
    });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
};

module.exports = errorHandler;
