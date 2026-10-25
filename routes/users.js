const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/usersController');

// Protected read endpoints requiring valid authentication
router.get('/', authenticateToken, getAllUsers);
router.get('/:id', authenticateToken, getUserById);

// Protected mutation endpoints requiring valid authentication and user ownership
router.put('/:id', authenticateToken, updateUser);
router.patch('/:id', authenticateToken, updateUser);
router.delete('/:id', authenticateToken, deleteUser);

module.exports = router;
