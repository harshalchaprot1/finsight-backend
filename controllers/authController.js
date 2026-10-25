
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const ALLOWED_PROFILE_TYPES = [
  'STUDENT',
  'EMPLOYEE',
  'FREELANCER',
  'BUSINESS_OWNER'
];

const normalizeEmail = (email) =>
  String(email || '').trim().toLowerCase();

const createHttpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const createToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is missing from the environment configuration');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: user.user_id,
      user_id: user.user_id,
      username: user.username,
      email: user.email
    },
    secret,
    { expiresIn }
  );
};

// REGISTER
const register = async (req, res, next) => {
  try {
    const {
      username,
      name,
      email,
      password,
      date_of_birth,
      profile_type
    } = req.body;

    // Accept "name" temporarily for compatibility with the old frontend.
    const resolvedUsername = String(username ?? name ?? '').trim();
    const normalizedEmail = normalizeEmail(email);
    const resolvedProfileType = String(
      profile_type || 'STUDENT'
    ).trim().toUpperCase();

    if (!resolvedUsername || !normalizedEmail || !password) {
      throw createHttpError(
        'Username, email, and password are required',
        400
      );
    }

    if (resolvedUsername.length > 50) {
      throw createHttpError(
        'Username must not exceed 50 characters',
        400
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw createHttpError('Please provide a valid email address', 400);
    }

    if (password.length < 6) {
      throw createHttpError(
        'Password must be at least 6 characters long',
        400
      );
    }

    if (!ALLOWED_PROFILE_TYPES.includes(resolvedProfileType)) {
      throw createHttpError('Invalid profile type', 400);
    }

    const resolvedDateOfBirth = date_of_birth || null;

    if (
      resolvedDateOfBirth !== null &&
      (
        typeof resolvedDateOfBirth !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(resolvedDateOfBirth) ||
        Number.isNaN(Date.parse(`${resolvedDateOfBirth}T00:00:00Z`)) ||
        new Date(`${resolvedDateOfBirth}T00:00:00Z`)
          .toISOString().slice(0, 10) !== resolvedDateOfBirth
      )
    ) {
      throw createHttpError(
        'Date of birth must be a valid date in YYYY-MM-DD format',
        400
      );
    }

    const existingUser = await pool.query(
      `SELECT user_id
       FROM users
       WHERE LOWER(email) = $1
          OR LOWER(username) = LOWER($2)
       LIMIT 1`,
      [normalizedEmail, resolvedUsername]
    );

    if (existingUser.rows.length > 0) {
      throw createHttpError(
        'Email or username is already registered',
        409
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
         (username, email, password_hash, date_of_birth, profile_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, username, email, date_of_birth,
                 profile_type, created_at`,
      [
        resolvedUsername,
        normalizedEmail,
        passwordHash,
        resolvedDateOfBirth,
        resolvedProfileType
      ]
    );

    const user = result.rows[0];
    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: Number(user.user_id),
          user_id: Number(user.user_id),
          username: user.username,
          name: user.username,
          email: user.email,
          date_of_birth: user.date_of_birth,
          profile_type: user.profile_type,
          created_at: user.created_at
        },
        token
      }
    });
  } catch (err) {
    if (err.code === '23505') {
      err.statusCode = 409;
      err.message = 'Email or username is already registered';
    }

    next(err);
  }
};

// LOGIN
const login = async (req, res, next) => {
  try {
    const { email, username, identifier, password } = req.body;

    const loginIdentifier = String(
      email ?? username ?? identifier ?? ''
    ).trim();

    if (!loginIdentifier || !password) {
      throw createHttpError(
        'Email/username and password are required',
        400
      );
    }

    const result = await pool.query(
      `SELECT user_id, username, email, password_hash,
              date_of_birth, profile_type
       FROM users
       WHERE LOWER(email) = LOWER($1)
          OR LOWER(username) = LOWER($1)
       LIMIT 1`,
      [loginIdentifier]
    );

    if (result.rows.length === 0) {
      throw createHttpError('Invalid email/username or password', 401);
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      throw createHttpError('Invalid email/username or password', 401);
    }

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: Number(user.user_id),
          user_id: Number(user.user_id),
          username: user.username,
          name: user.username,
          email: user.email,
          date_of_birth: user.date_of_birth,
          profile_type: user.profile_type
        },
        token
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login
};
