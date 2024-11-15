// src/routes/paymentTotals.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PaymentTotal = require('../models/PaymentTotal');
const Reservation = require('../models/Reservation');

// Helper function to map billingStatus to payment methods
const mapBillingStatusToPaymentMethods = (billingStatus) => {
    if (billingStatus === 'pagado_efectivo') return 'efectivo';
    if (billingStatus === 'pagado_tarjeta') return 'tarjeta';
    if (billingStatus === 'pagado_transferencia') return 'transferencia';
    return null;
};

// Get payment totals for current month
router.get('/current-month/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const paymentMethodTotals = await Reservation.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    $expr: {
                        $and: [
                            { $eq: [{ $month: "$start" }, currentMonth] },
                            { $eq: [{ $year: "$start" }, currentYear] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        paymentMethod: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$billingStatus", "pagado_efectivo"] }, then: "efectivo" },
                                    { case: { $eq: ["$billingStatus", "pagado_tarjeta"] }, then: "tarjeta" },
                                    { case: { $eq: ["$billingStatus", "pagado_transferencia"] }, then: "transferencia" }
                                ],
                                default: null
                            }
                        }
                    },
                    total: { $sum: { $toDouble: "$precioTotal" } }
                }
            }
        ]);

        const result = {
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            total: 0
        };

        paymentMethodTotals.forEach((item) => {
            if (item._id.paymentMethod in result) {
                result[item._id.paymentMethod] = item.total;
                result.total += item.total;
            }
        });

        // Update or create payment totals record
        await PaymentTotal.findOneAndUpdate(
            {
                userId,
                month: currentMonth,
                year: currentYear
            },
            {
                ...result,
                lastUpdated: new Date()
            },
            { upsert: true, new: true }
        );

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get payment totals for specific month and year
router.get('/:userId/:month/:year', async (req, res) => {
    try {
        const { userId, month, year } = req.params;

        const paymentMethodTotals = await Reservation.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    $expr: {
                        $and: [
                            { $eq: [{ $month: "$start" }, parseInt(month)] },
                            { $eq: [{ $year: "$start" }, parseInt(year)] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        paymentMethod: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$billingStatus", "pagado_efectivo"] }, then: "efectivo" },
                                    { case: { $eq: ["$billingStatus", "pagado_tarjeta"] }, then: "tarjeta" },
                                    { case: { $eq: ["$billingStatus", "pagado_transferencia"] }, then: "transferencia" }
                                ],
                                default: null
                            }
                        }
                    },
                    total: { $sum: { $toDouble: "$precioTotal" } }
                }
            }
        ]);

        const result = {
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            total: 0
        };

        paymentMethodTotals.forEach((item) => {
            if (item._id.paymentMethod in result) {
                result[item._id.paymentMethod] = item.total;
                result.total += item.total;
            }
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get yearly summary
const validateUserId = (req, res, next) => {
    const userId = req.params.userId || req.query.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: "Invalid userId format" });
    }
    next();
};

// Get yearly summary
router.get('/yearly-summary/:userId/:year', async (req, res) => {
    try {
        const { userId, year } = req.params;

        // Validate year
        const parsedYear = parseInt(year);
        if (isNaN(parsedYear)) {
            return res.status(400).json({ error: "Invalid year format" });
        }

        console.log("Fetching yearly summary for userId:", userId, "and year:", parsedYear); // Log the parameters

        const yearlyTotals = await Reservation.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    $expr: {
                        $eq: [{ $year: "$start" }, parsedYear] // Ensure year is parsed as an integer
                    }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$start" },
                        paymentMethod: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$billingStatus", "pagado_efectivo"] }, then: "efectivo" },
                                    { case: { $eq: ["$billingStatus", "pagado_tarjeta"] }, then: "tarjeta" },
                                    { case: { $eq: ["$billingStatus", "pagado_transferencia"] }, then: "transferencia" }
                                ],
                                default: null
                            }
                        }
                    },
                    total: { $sum: { $toDouble: "$precioTotal" } }
                }
            },
            {
                $group: {
                    _id: "$_id.month",
                    paymentMethods: {
                        $push: {
                            method: "$_id.paymentMethod",
                            total: "$total"
                        }
                    },
                    monthlyTotal: { $sum: "$total" }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        console.log("Yearly Totals:", yearlyTotals); // Log the yearly totals

        const monthlyBreakdown = yearlyTotals.map(month => {
            const monthData = {
                month: month._id,
                efectivo: 0,
                tarjeta: 0,
                transferencia: 0,
                total: month.monthlyTotal
            };

            month.paymentMethods.forEach(payment => {
                if (payment.method in monthData) {
                    monthData[payment.method] = payment.total;
                }
            });

            return monthData;
        });

        res.status(200).json(monthlyBreakdown);
    } catch (error) {
        console.error("Error in /yearly-summary route:", error); // Log the error
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;