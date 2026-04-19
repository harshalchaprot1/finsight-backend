const pool = require('../db');
const { serializePhoneNosForDb } = require('../utils/phoneNos');

// ✅ GET all users
const getAllUsers = async (req, res, next) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM Users');
    conn.release();

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: rows
    });
  } catch (err) {
    next(err);
  }
};

// ✅ GET user by ID
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM Users WHERE id = ?', [id]);
    conn.release();

    if (rows.length === 0) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
};

// ✅ CREATE new user
const createUser = async (req, res, next) => {
  try {
    const { name, email, phone_nos } = req.body;

    if (!name || !email) {
      const err = new Error('Name and email are required');
      err.statusCode = 400;
      throw err;
    }

    const serializedPhoneNos = await serializePhoneNosForDb(phone_nos);

    const conn = await pool.getConnection();
    const [result] = await conn.query(
      'INSERT INTO Users (name, email, phone_nos) VALUES (?, ?, ?)',
      [name, email, serializedPhoneNos]
    );
    conn.release();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: result.insertId,
        name,
        email,
        phone_nos: serializedPhoneNos
      }
    });
  } catch (err) {
    next(err);
  }
};

// ✅ UPDATE user
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone_nos } = req.body;

    if (!id) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (name === undefined && email === undefined && phone_nos === undefined) {
      const err = new Error('At least one field (name, email, or phone_nos) is required to update');
      err.statusCode = 400;
      throw err;
    }

    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }

    if (email !== undefined) {
      fields.push('email = ?');
      params.push(email);
    }

    if (phone_nos !== undefined) {
      const serializedPhoneNos = await serializePhoneNosForDb(phone_nos);
      fields.push('phone_nos = ?');
      params.push(serializedPhoneNos);
    }

    const query = `UPDATE Users SET ${fields.join(', ')} WHERE id = ?`;
    params.push(id);

    const conn = await pool.getConnection();
    const [result] = await conn.query(query, params);
    conn.release();

    if (result.affectedRows === 0) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (err) {
    next(err);
  }
};

// ✅ DELETE user
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [result] = await conn.query('DELETE FROM Users WHERE id = ?', [id]);
    conn.release();

    if (result.affectedRows === 0) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
