const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PaymentTotal = require('../models/PaymentTotal');
const Reservation = require('../models/Reservation');

// Helper function to calculate payment totals from payments array
const calculatePaymentTotals = (payments) => {
    return payments.reduce((acc, payment) => {
        acc[payment.method] = (acc[payment.method] || 0) + payment.amount;
        acc.total = (acc.total || 0) + payment.amount;
        return acc;
    }, {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        total: 0
    });
};

// Get payment totals for current month
router.get('/current-month/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const reservations = await Reservation.find({
            user: new mongoose.Types.ObjectId(userId),
            $expr: {
                $and: [
                    { $eq: [{ $month: "$start" }, currentMonth] },
                    { $eq: [{ $year: "$start" }, currentYear] }
                ]
            }
        });

        // Inicializar totales
        let totals = {
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            total: 0
        };

        let details = [
            { method: 'efectivo', amount: 0, count: 0 },
            { method: 'tarjeta', amount: 0, count: 0 },
            { method: 'transferencia', amount: 0, count: 0 }
        ];

        // Procesar cada reservación
        reservations.forEach(reservation => {
            let method = 'efectivo'; // valor por defecto

            // Determinar el método de pago basado en billingStatus o paymentMethod
            if (reservation.billingStatus === 'pagado_efectivo' || reservation.paymentMethod === 'efectivo') {
                method = 'efectivo';
            } else if (reservation.billingStatus === 'pagado_tarjeta' || reservation.paymentMethod === 'tarjeta') {
                method = 'tarjeta';
            } else if (reservation.billingStatus === 'pagado_transferencia' || reservation.paymentMethod === 'transferencia') {
                method = 'transferencia';
            }

            // Sumar al total correspondiente
            const amount = reservation.adelanto || reservation.precioTotal || 0;
            totals[method] += amount;
            totals.total += amount;

            // Actualizar detalles
            const detail = details.find(d => d.method === method);
            if (detail) {
                detail.amount += amount;
                detail.count += 1;
            }
        });

        // Calcular porcentajes
        const percentages = {
            efectivo: totals.total > 0 ? (totals.efectivo / totals.total) * 100 : 0,
            tarjeta: totals.total > 0 ? (totals.tarjeta / totals.total) * 100 : 0,
            transferencia: totals.total > 0 ? (totals.transferencia / totals.total) * 100 : 0
        };

        const response = {
            totals,
            percentages,
            details: details.filter(d => d.count > 0), // Solo incluir métodos utilizados
            totalReservations: reservations.length,
            averagePaymentAmount: totals.total > 0 ? totals.total / reservations.length : 0
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error in payment totals:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta similar para el resumen anual
router.get('/yearly-summary/:userId/:year', async (req, res) => {
    try {
        const { userId, year } = req.params;
        const parsedYear = parseInt(year);

        const reservations = await Reservation.find({
            user: new mongoose.Types.ObjectId(userId),
            $expr: { $eq: [{ $year: "$start" }, parsedYear] }
        });

        // Crear array para los 12 meses
        const yearlyData = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            total: 0
        }));

        // Procesar cada reservación
        reservations.forEach(reservation => {
            const month = new Date(reservation.start).getMonth();
            const amount = reservation.adelanto || reservation.precioTotal || 0;
            let method = 'efectivo';

            if (reservation.billingStatus === 'pagado_efectivo' || reservation.paymentMethod === 'efectivo') {
                method = 'efectivo';
            } else if (reservation.billingStatus === 'pagado_tarjeta' || reservation.paymentMethod === 'tarjeta') {
                method = 'tarjeta';
            } else if (reservation.billingStatus === 'pagado_transferencia' || reservation.paymentMethod === 'transferencia') {
                method = 'transferencia';
            }

            yearlyData[month][method] += amount;
            yearlyData[month].total += amount;
        });

        res.status(200).json(yearlyData);
    } catch (error) {
        console.error('Error in yearly summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Nuevo endpoint para actualizar los totales de pagos
// En la ruta de actualización de pagos
router.post('/update-totals', async (req, res) => {
    try {
        const { userId, month, year, payments } = req.body;

        let paymentTotal = await PaymentTotal.findOne({ userId, month, year });
        if (!paymentTotal) {
            paymentTotal = new PaymentTotal({ userId, month, year });
        }

        // Agregar cada pago
        payments.forEach(payment => {
            paymentTotal.addPayment(payment.method, payment.amount);
        });

        paymentTotal.totalReservations += 1;
        await paymentTotal.save();

        const stats = await PaymentTotal.getMonthlyStats(userId, month, year);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;