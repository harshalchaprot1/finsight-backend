const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { serializePhoneNosForDb } = require('../utils/phoneNos');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_env';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const STORE_PLAINTEXT_PASSWORD = process.env.STORE_PLAINTEXT_PASSWORD === 'true';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const looksLikeBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
const parseNumericId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, phone_nos } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !email || !password) {
      const err = new Error('Name, email, and password are required');
      err.statusCode = 400;
      throw err;
    }

    if (!isValidEmail(normalizedEmail)) {
      const err = new Error('Please provide a valid email address');
      err.statusCode = 400;
      throw err;
    }

    if (password.length < 6) {
      const err = new Error('Password must be at least 6 characters long');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();

    const [existingUsers] = await conn.query(
      'SELECT id FROM Users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
      [normalizedEmail]
    );
    if (existingUsers.length > 0) {
      conn.release();
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const passwordToStore = STORE_PLAINTEXT_PASSWORD
      ? password
      : await bcrypt.hash(password, 10);
    const serializedPhoneNos = await serializePhoneNosForDb(phone_nos);

    let result;

    if (serializedPhoneNos !== undefined) {
      [result] = await conn.query(
        'INSERT INTO Users (name, email, password, phone_nos) VALUES (?, ?, ?, ?)',
        [name, normalizedEmail, passwordToStore, serializedPhoneNos]
      );
    } else {
      [result] = await conn.query(
        'INSERT INTO Users (name, email, password) VALUES (?, ?, ?)',
        [name, normalizedEmail, passwordToStore]
      );
    }

    conn.release();

    const user = {
      id: result.insertId,
      name,
      email: normalizedEmail,
      phone_nos: phone_nos ?? null
    };

    const token = createToken(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user,
        token
      }
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password, user_id, userId, id, identifier } = req.body;
    const loginIdentifier = email ?? identifier;
    const normalizedIdentifier = normalizeEmail(loginIdentifier);
    const numericUserId = parseNumericId(user_id ?? userId ?? id ?? loginIdentifier);
    const isEmailLogin = Boolean(loginIdentifier) && numericUserId === null;

    if ((!loginIdentifier && !numericUserId) || !password) {
      const err = new Error('Email or user ID and password are required');
      err.statusCode = 400;
      throw err;
    }

    if (isEmailLogin && !isValidEmail(normalizedIdentifier)) {
      const err = new Error('Please provide a valid email address');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    let users;

    if (numericUserId) {
      [users] = await conn.query(
        'SELECT id, name, email, password FROM Users WHERE id = ? LIMIT 1',
        [numericUserId]
      );
    } else {
      [users] = await conn.query(
        'SELECT id, name, email, password FROM Users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
        [normalizedIdentifier]
      );
    }

    if (!users.length) {
      conn.release();
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const dbUser = users[0];

    let isPasswordValid = false;

    if (looksLikeBcryptHash(dbUser.password)) {
      isPasswordValid = await bcrypt.compare(password, dbUser.password);
    } else {
      isPasswordValid = dbUser.password === password;
    }

    // Backward compatibility for older plain-text passwords. If it matches,
    // upgrade it to a hash so future logins are secure.
    if (!isPasswordValid && dbUser.password === password) {
      isPasswordValid = true;

      if (!STORE_PLAINTEXT_PASSWORD) {
        const upgradedHash = await bcrypt.hash(password, 10);
        await conn.query('UPDATE Users SET password = ? WHERE id = ?', [upgradedHash, dbUser.id]);
      }
    }

    conn.release();

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email
    };

    const token = createToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      err.statusCode = 409;
      err.message = 'User with this email already exists';
    }
    next(err);
  }
};

module.exports = {
  register,
  login
};
