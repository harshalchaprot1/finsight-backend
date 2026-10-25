const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { getCategories } = require('../controllers/categoriesController');

// All category routes require valid authentication
router.use(authenticateToken);

router.get('/', getCategories);

module.exports = router;