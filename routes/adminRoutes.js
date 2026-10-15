const express = require('express');
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rate limit login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Try again later.' },
});

router.post('/login', loginLimiter, adminController.login);
router.get('/me', requireAuth, adminController.me);
router.get('/stats', requireAuth, adminController.stats);
router.get('/transactions', requireAuth, adminController.listTransactions);
router.get('/transactions/:id', requireAuth, adminController.getTransaction);
router.delete('/transactions/:id', requireAuth, adminController.deleteTransaction);

module.exports = router;
