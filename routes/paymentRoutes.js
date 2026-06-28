const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Both controller functions must exist and be exported
router.post('/initiate', paymentController.initiatePayment);
router.post('/callback', paymentController.handleCallback);

module.exports = router;
