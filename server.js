require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const pool = require('./db');
const errorHandler = require('./middleware/errorHandler');
const { serializePhoneNosForDb } = require('./utils/phoneNos');

// Import routes
const transactionsRoutes = require('./routes/transactions');
const budgetsRoutes = require('./routes/budgets');
const reportsRoutes = require('./routes/reports');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const STORE_PLAINTEXT_PASSWORD = process.env.STORE_PLAINTEXT_PASSWORD === 'true';

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// ROUTES
// ============================================
// Users
app.options('/users', (req, res) => {
  res.set('Allow', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
  res.status(204).end();
});

app.head('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT 1 FROM Users WHERE id = ? LIMIT 1', [id]);
    conn.release();

    if (!rows.length) {
      return res.status(404).end();
    }

    res.set('Content-Type', 'application/json');
    res.set('Content-Length', '0');
    res.status(200).end();
  } catch (err) {
    console.error('Error checking user existence (HEAD):', err);
    res.status(500).end();
  }
});

app.get('/users', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM Users');
    conn.release();

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Error fetching users', error: err.message });
  }
});

app.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM Users WHERE id = ?', [id]);
    conn.release();

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching user by ID:', err);
    res.status(500).json({ success: false, message: 'Error fetching user', error: err.message });
  }
});

app.post('/users', async (req, res) => {
  const { name, email, password, phone_nos } = req.body;

  try {
    const passwordToStore = password
      ? (STORE_PLAINTEXT_PASSWORD ? password : await bcrypt.hash(password, 10))
      : null;
    const serializedPhoneNos = await serializePhoneNosForDb(phone_nos);

    const conn = await pool.getConnection();
    const [result] = await conn.query(
      'INSERT INTO Users (name, email, password, phone_nos) VALUES (?, ?, ?, ?)',
      [name, email, passwordToStore, serializedPhoneNos]
    );
    conn.release();

    res.status(201).json({
      success: true,
      message: 'User added successfully',
      data: { id: result.insertId }
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ success: false, message: 'Error creating user', error: err.message });
  }
});

app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, password, phone_nos } = req.body;

  try {
    const fields = [];
    const params = [];

    if (name) { fields.push('name = ?'); params.push(name); }
    if (email) { fields.push('email = ?'); params.push(email); }
    if (password) {
      const passwordToStore = STORE_PLAINTEXT_PASSWORD
        ? password
        : await bcrypt.hash(password, 10);
      fields.push('password = ?');
      params.push(passwordToStore);
    }
    if (phone_nos !== undefined) {
      const serializedPhoneNos = await serializePhoneNosForDb(phone_nos);
      fields.push('phone_nos = ?');
      params.push(serializedPhoneNos);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    params.push(id);

    const conn = await pool.getConnection();
    const [result] = await conn.query(`UPDATE Users SET ${fields.join(', ')} WHERE id = ?`, params);
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Error updating user', error: err.message });
  }
});

// PATCH user (partial update)
app.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, password, phone_nos } = req.body;

  try {
    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (email !== undefined) { fields.push('email = ?'); params.push(email); }
    if (password !== undefined) {
      const passwordToStore = STORE_PLAINTEXT_PASSWORD
        ? password
        : await bcrypt.hash(password, 10);
      fields.push('password = ?');
      params.push(passwordToStore);
    }
    if (phone_nos !== undefined) {
      const serializedPhoneNos = await serializePhoneNosForDb(phone_nos);
      fields.push('phone_nos = ?');
      params.push(serializedPhoneNos);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    params.push(id);

    const conn = await pool.getConnection();
    const [result] = await conn.query(`UPDATE Users SET ${fields.join(', ')} WHERE id = ?`, params);
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User patched successfully' });
  } catch (err) {
    console.error('Error patching user:', err);
    res.status(500).json({ success: false, message: 'Error patching user', error: err.message });
  }
});

app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const conn = await pool.getConnection();
    const [result] = await conn.query('DELETE FROM Users WHERE id = ?', [id]);
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, message: 'Error deleting user', error: err.message });
  }
});

app.use('/transactions', transactionsRoutes);
app.use('/budgets', budgetsRoutes);
app.use('/reports', reportsRoutes);
app.use('/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '✅ VaultWise backend is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// ============================================
// ERROR HANDLER (MUST BE LAST)
// ============================================
app.use(errorHandler);

// ============================================
// SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 VaultWise backend running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /users - Get all users`);
  console.log(`   POST /auth/register - Register new user`);
  console.log(`   POST /auth/login - Login existing user`);
  console.log(`   GET  /transactions - Get all transactions`);
  console.log(`   GET  /budgets - Get all budgets`);
  console.log(`   GET  /reports/monthly/:user_id - Monthly report`);
  console.log(`   GET  /reports/annual/:user_id - Annual report`);
});
