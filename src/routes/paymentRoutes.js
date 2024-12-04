const express = require('express');
const router = express.Router();
const { updateReservationPayments, getYearlySummary } = require('../controllers/paymentController');

router.put('/reservations/:id/payments', updateReservationPayments);
router.get('/yearly-summary/:userId/:year', getYearlySummary);

module.exports = router; 