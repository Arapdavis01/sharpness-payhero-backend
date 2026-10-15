const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Initiate STK push
router.post('/initiate', paymentController.initiatePayment);

// PayHero callback (do not remove, must stay public)
router.post('/callback', paymentController.handleCallback);

// Public status endpoint for frontend polling (Phase 4A)
router.get('/status/:reference', paymentController.getPaymentStatus);

module.exports = router;
