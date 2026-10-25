require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const transactionsRoutes = require('./routes/transactions');
const budgetsRoutes = require('./routes/budgets');
const reportsRoutes = require('./routes/reports');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
const allowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback allow in local development
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// ROUTES
// ============================================
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/budgets', budgetsRoutes);
app.use('/reports', reportsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '✅ FinSight backend is running',
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
let server;

if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`🚀 FinSight backend running on http://localhost:${PORT}`);
    console.log(`📚 API Documentation:`);
    console.log(`   GET    /health - Health check`);
    console.log(`   POST   /auth/register - Register new user`);
    console.log(`   POST   /auth/login - Login existing user`);
    console.log(`   GET    /users - Get all users (sanitized)`);
    console.log(`   GET    /users/:id - Get user by ID`);
    console.log(`   PUT    /users/:id - Update user profile`);
    console.log(`   GET    /transactions - Get all transactions`);
    console.log(`   POST   /transactions - Create transaction`);
    console.log(`   GET    /budgets - Get all budgets`);
    console.log(`   POST   /budgets - Create budget`);
    console.log(`   GET    /reports/summary - Dashboard summary report`);
    console.log(`   GET    /reports/monthly/:user_id - Monthly category report`);
    console.log(`   GET    /reports/annual/:user_id - Annual category report`);
    console.log(`   GET    /reports/budget-vs-actual/:user_id - Budget vs actual`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
      console.error(`   Please stop any existing process using port ${PORT} and try again.\n`);
    } else {
      console.error('❌ HTTP server error:', err.message);
    }
    process.exit(1);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down FinSight backend...`);
    server.close(async () => {
      console.log('   HTTP server closed.');
      try {
        const pool = require('./db');
        await pool.end();
        console.log('   PostgreSQL connection pool drained.');
      } catch (dbErr) {
        console.error('   Error draining pool:', dbErr.message);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
