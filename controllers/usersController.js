const pool = require('../db');

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
    const { name, email } = req.body;

    if (!name || !email) {
      const err = new Error('Name and email are required');
      err.statusCode = 400;
      throw err;
    }

    const conn = await pool.getConnection();
    const [result] = await conn.query('INSERT INTO Users (name, email) VALUES (?, ?)', [name, email]);
    conn.release();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: result.insertId,
        name,
        email
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
    const { name, email } = req.body;

    if (!id) {
      const err = new Error('User ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (!name && !email) {
      const err = new Error('At least one field (name or email) is required to update');
      err.statusCode = 400;
      throw err;
    }

    let query = 'UPDATE Users SET ';
    const params = [];

    if (name) {
      query += 'name = ?';
      params.push(name);
    }

    if (email) {
      if (name) query += ', ';
      query += 'email = ?';
      params.push(email);
    }

    query += ' WHERE id = ?';
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
