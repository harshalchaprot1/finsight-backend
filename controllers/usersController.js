const bcrypt = require('bcryptjs');
const pool = require('../db');

const parseId = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const parsed = Number.parseInt(val, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

// Formats a safe user object (NEVER exposes password_hash)
const formatUserSummary = (row) => ({
  id: Number(row.user_id),
  user_id: Number(row.user_id),
  name: row.username,
  username: row.username,
  email: row.email,
  profile_type: row.profile_type,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// ✅ GET all users (Restricted to self for regular users to prevent user enumeration)
const getAllUsers = async (req, res, next) => {
  try {
    const authUserId = req.user ? parseId(req.user.user_id) : null;
    if (!authUserId) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const result = await pool.query(`
      SELECT user_id, username, email, profile_type, created_at, updated_at
      FROM users
      WHERE user_id = $1
      ORDER BY user_id ASC
    `, [authUserId]);

    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: result.rows.map(formatUserSummary)
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET user by ID (Sanitized single user profile, enforcing profile ownership)
const getUserById = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const authUserId = req.user ? parseId(req.user.user_id) : null;

    if (!id) {
      const err = new Error('Valid User ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (!authUserId || id !== authUserId) {
      const err = new Error('Forbidden: You can only view your own user profile');
      err.statusCode = authUserId ? 403 : 401;
      throw err;
    }

    const result = await pool.query(`
      SELECT user_id, username, email, profile_type, created_at, updated_at
      FROM users
      WHERE user_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: formatUserSummary(result.rows[0])
    });
  } catch (err) {
    next(err);
  }
};

// ✅ UPDATE user (Authenticated user profile update, enforcing ownership)
const updateUser = async (req, res, next) => {
  try {
    const targetId = parseId(req.params.id);
    const authUserId = req.user ? parseId(req.user.user_id) : null;

    if (!targetId) {
      const err = new Error('Valid User ID is required');
      err.statusCode = 400;
      throw err;
    }

    // Enforce ownership
    if (!authUserId || targetId !== authUserId) {
      const err = new Error(
        'Forbidden: You can only update your own user profile'
      );
      err.statusCode = authUserId ? 403 : 401;
      throw err;
    }


    const { name, username, email, password, profile_type, date_of_birth } = req.body;
    const resolvedUsername = String(username ?? name ?? '').trim();

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (resolvedUsername) {
      if (resolvedUsername.length > 50) {
        const err = new Error('Username must not exceed 50 characters');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`username = $${paramIndex++}`);
      values.push(resolvedUsername);
    }

    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        const err = new Error('Invalid email format');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`email = $${paramIndex++}`);
      values.push(normalizedEmail);
    }

    if (password) {
      if (typeof password !== 'string' || password.length < 6) {
        const err = new Error('Password must be at least 6 characters long');
        err.statusCode = 400;
        throw err;
      }
      const passwordHash = await bcrypt.hash(password, 12);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }

    if (profile_type) {
      const normalizedType = String(profile_type).trim().toUpperCase();
      const validTypes = ['STUDENT', 'EMPLOYEE', 'FREELANCER', 'BUSINESS_OWNER'];
      if (!validTypes.includes(normalizedType)) {
        const err = new Error('Invalid profile type');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`profile_type = $${paramIndex++}`);
      values.push(normalizedType);
    }

    if (date_of_birth) {
      if (
        typeof date_of_birth !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth) ||
        Number.isNaN(Date.parse(`${date_of_birth}T00:00:00Z`))
      ) {
        const err = new Error('Date of birth must be a valid date in YYYY-MM-DD format');
        err.statusCode = 400;
        throw err;
      }
      updates.push(`date_of_birth = $${paramIndex++}`);
      values.push(date_of_birth);
    }

    // Note: If the request only contained legacy phone_nos, updates will be empty.
    // Return the existing record safely without failing, preserving frontend compatibility.
    if (updates.length === 0) {
      const existing = await pool.query(
        'SELECT user_id, username, email, profile_type, created_at, updated_at FROM users WHERE user_id = $1',
        [targetId]
      );
      if (existing.rows.length === 0) {
        const err = new Error('User not found');
        err.statusCode = 404;
        throw err;
      }
      return res.json({
        success: true,
        message: 'User profile verified',
        data: formatUserSummary(existing.rows[0])
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(targetId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING user_id, username, email, profile_type, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: formatUserSummary(result.rows[0])
    });
  } catch (err) {
    next(err);
  }
};

// ✅ DELETE user (Authenticated user account deletion, enforcing ownership)
const deleteUser = async (req, res, next) => {
  try {
    const targetId = parseId(req.params.id);
    const authUserId = req.user ? parseId(req.user.user_id) : null;

    if (!targetId) {
      const err = new Error('Valid User ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (!authUserId || targetId !== authUserId) {
      const err = new Error('Forbidden: You can only delete your own account');
      err.statusCode = authUserId ? 403 : 401;
      throw err;
    }

    const deleteResult = await pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
      [targetId]
    );

    if (deleteResult.rowCount === 0) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'User account deleted successfully',
      data: { id: targetId }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
};
