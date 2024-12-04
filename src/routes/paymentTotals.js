const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment');
const Reservation = require('../models/Reservation');

const getReservationsForPeriod = async (userId, startDate, endDate) => {
    const monthStart = moment(startDate).startOf('month').toDate();
    const monthEnd = moment(endDate).endOf('month').toDate();

    console.log('Buscando reservas para el período:', {
        monthStart,
        monthEnd
    });

    const query = {
        user: new mongoose.Types.ObjectId(userId),
        $or: [
            // Reservas que inician en el mes
            {
                start: {
                    $gte: monthStart,
                    $lte: monthEnd
                }
            },
            // Reservas que empezaron antes pero siguen activas en el mes
            {
                start: { $lt: monthStart },
                end: { $gt: monthStart }
            }
        ]
    };

    console.log('Query:', JSON.stringify(query, null, 2));

    const reservations = await Reservation.find(query)
        .sort({ start: 1 })
        .lean();

    console.log(`Encontradas ${reservations.length} reservaciones:`);
    reservations.forEach(r => {
        console.log({
            nombre: r.name,
            checkIn: moment(r.start).format('DD/MM/YYYY'),
            checkOut: moment(r.end).format('DD/MM/YYYY'),
            comparteMes: moment(r.start).month() !== moment(r.end).month()
        });
    });

    return reservations;
};

const calculatePaymentTotals = (reservation, options = {}) => {
    const {
        startDate = null,
        endDate = null
    } = options;

    const rangeStart = moment(startDate).startOf('day');
    const rangeEnd = moment(endDate).endOf('day');
    const reservationStart = moment(reservation.start);
    const reservationEnd = moment(reservation.end);

    // Si la reserva está completamente dentro del rango
    if (reservationStart.isSameOrAfter(rangeStart) &&
        reservationEnd.isSameOrBefore(rangeEnd)) {
        return sumPaymentsByMethod(reservation.payments || []);
    }

    // Para reservas que cruzan el rango
    const totalNights = reservationEnd.diff(reservationStart, 'days');
    if (totalNights <= 0) return { efectivo: 0, tarjeta: 0, transferencia: 0, total: 0 };

    const pricePerNight = reservation.precioTotal / totalNights;

    // Calcular las noches dentro del rango
    const overlapStart = moment.max(rangeStart, reservationStart);
    const overlapEnd = moment.min(rangeEnd, reservationEnd);
    const nightsInRange = overlapEnd.diff(overlapStart, 'days');

    // Calcular el monto proporcional
    const amountForPeriod = pricePerNight * nightsInRange;
    const proportion = amountForPeriod / reservation.precioTotal;

    const totals = {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        total: amountForPeriod
    };

    // Distribuir los pagos según la proporción
    (reservation.payments || []).forEach(payment => {
        if (!payment.method || !payment.amount) return;
        const proportionalPayment = payment.amount * proportion;
        totals[payment.method] += proportionalPayment;
    });

    return totals;
};

const sumPaymentsByMethod = (payments) => {
    return payments.reduce((acc, payment) => {
        if (payment.method && payment.amount) {
            acc[payment.method] = (acc[payment.method] || 0) + payment.amount;
            acc.total = (acc.total || 0) + payment.amount;
        }
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
        const currentDate = moment();
        const startDate = currentDate.clone().startOf('month');
        const endDate = currentDate.clone().endOf('month');

        const reservations = await getReservationsForPeriod(userId, startDate, endDate);

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
            const paymentTotals = calculatePaymentTotals(reservation, {
                startDate: startDate.toDate(),
                endDate: endDate.toDate()
            });

            // Sumar al total general
            Object.keys(totals).forEach(method => {
                totals[method] += paymentTotals[method];
            });

            // Actualizar detalles
            Object.keys(paymentTotals).forEach(method => {
                if (method !== 'total') {
                    const detail = details.find(d => d.method === method);
                    if (detail && paymentTotals[method] > 0) {
                        detail.amount += paymentTotals[method];
                        detail.count += 1;
                    }
                }
            });
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
            details: details.filter(d => d.count > 0),
            totalReservations: reservations.length,
            averagePaymentAmount: totals.total > 0 ? totals.total / details.reduce((sum, d) => sum + d.count, 0) : 0
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error in payment totals:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta para mes específico
router.get('/specific-month/:userId/:month/:year', async (req, res) => {
    try {
        const { userId, month, year } = req.params;
        const parsedMonth = parseInt(month);
        const parsedYear = parseInt(year);

        if (parsedMonth < 1 || parsedMonth > 12) {
            return res.status(400).json({ error: 'Mes inválido' });
        }

        const startDate = moment([parsedYear, parsedMonth - 1]).startOf('month');
        const endDate = moment([parsedYear, parsedMonth - 1]).endOf('month');

        const reservations = await getReservationsForPeriod(userId, startDate, endDate);

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

        reservations.forEach(reservation => {
            const paymentTotals = calculatePaymentTotals(reservation, {
                startDate: startDate.toDate(),
                endDate: endDate.toDate()
            });

            Object.keys(totals).forEach(method => {
                totals[method] += paymentTotals[method];
            });

            Object.keys(paymentTotals).forEach(method => {
                if (method !== 'total') {
                    const detail = details.find(d => d.method === method);
                    if (detail && paymentTotals[method] > 0) {
                        detail.amount += paymentTotals[method];
                        detail.count += 1;
                    }
                }
            });
        });

        const percentages = {
            efectivo: totals.total > 0 ? (totals.efectivo / totals.total) * 100 : 0,
            tarjeta: totals.total > 0 ? (totals.tarjeta / totals.total) * 100 : 0,
            transferencia: totals.total > 0 ? (totals.transferencia / totals.total) * 100 : 0
        };

        const response = {
            totals,
            percentages,
            details: details.filter(d => d.count > 0),
            totalReservations: reservations.length,
            averagePaymentAmount: totals.total > 0 ? totals.total / details.reduce((sum, d) => sum + d.count, 0) : 0,
            month: parsedMonth,
            year: parsedYear
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error in specific month totals:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta para el resumen anual
router.get('/yearly-summary/:userId/:year', async (req, res) => {
    try {
        const { userId, year } = req.params;
        const parsedYear = parseInt(year);

        const yearlyData = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            total: 0,
            totalReservations: 0
        }));

        for (let month = 1; month <= 12; month++) {
            const startDate = moment([parsedYear, month - 1]).startOf('month');
            const endDate = moment([parsedYear, month - 1]).endOf('month');

            const reservations = await getReservationsForPeriod(userId, startDate, endDate);

            reservations.forEach(reservation => {
                const paymentTotals = calculatePaymentTotals(reservation, {
                    startDate: startDate.toDate(),
                    endDate: endDate.toDate()
                });

                yearlyData[month - 1].efectivo += paymentTotals.efectivo;
                yearlyData[month - 1].tarjeta += paymentTotals.tarjeta;
                yearlyData[month - 1].transferencia += paymentTotals.transferencia;
                yearlyData[month - 1].total += paymentTotals.total;
                yearlyData[month - 1].totalReservations += 1;
            });
        }

        res.status(200).json(yearlyData);
    } catch (error) {
        console.error('Error in yearly summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta para rango de fechas
router.get('/date-range/:userId/:startDate/:endDate', async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.params;
        const start = moment(startDate);
        const end = moment(endDate);

        const reservations = await getReservationsForPeriod(userId, start, end);

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

        reservations.forEach(reservation => {
            const paymentTotals = calculatePaymentTotals(reservation, {
                startDate: start.toDate(),
                endDate: end.toDate()
            });

            Object.keys(totals).forEach(method => {
                totals[method] += paymentTotals[method];
            });

            Object.keys(paymentTotals).forEach(method => {
                if (method !== 'total') {
                    const detail = details.find(d => d.method === method);
                    if (detail && paymentTotals[method] > 0) {
                        detail.amount += paymentTotals[method];
                        detail.count += 1;
                    }
                }
            });
        });

        const percentages = {
            efectivo: totals.total > 0 ? (totals.efectivo / totals.total) * 100 : 0,
            tarjeta: totals.total > 0 ? (totals.tarjeta / totals.total) * 100 : 0,
            transferencia: totals.total > 0 ? (totals.transferencia / totals.total) * 100 : 0
        };

        const response = {
            totals,
            percentages,
            details: details.filter(d => d.count > 0),
            totalReservations: reservations.length,
            averagePaymentAmount: totals.total > 0 ? totals.total / details.reduce((sum, d) => sum + d.count, 0) : 0,
            dateRange: { start, end }
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error in date range totals:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;