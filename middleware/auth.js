require('dotenv').config();
const jwt = require('jsonwebtoken');

const parseUserId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      success: false,
      message: 'Access denied: Authorization header is missing or malformed'
    });
  }

  const [scheme, token] = authHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: Format must be "Bearer <token>"'
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('CRITICAL: JWT_SECRET is not configured in environment');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: Authentication key not configured'
    });
  }

  try {
    const decoded = jwt.verify(token, secret);
    const userId = parseUserId(decoded.user_id || decoded.id || decoded.userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload: user_id missing'
      });
    }

    req.user = {
      user_id: userId,
      id: userId,
      username: decoded.username,
      email: decoded.email
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token has expired, please log in again'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or malformed access token'
    });
  }
};

module.exports = authenticateToken;
