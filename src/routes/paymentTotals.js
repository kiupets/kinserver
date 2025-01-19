const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment');
const Reservation = require('../models/Reservation');

const TOTAL_HABITACIONES = 15;

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

    // Calcular noches totales y verificar si cruza meses
    const totalNights = reservationEnd.diff(reservationStart, 'days') + 1;
    const crossesMonths = reservationStart.format('YYYY-MM') !== reservationEnd.format('YYYY-MM');
    const isOneNightCross = totalNights === 2 && crossesMonths;
    const startsInRange = reservationStart.isBetween(rangeStart, rangeEnd, 'month', '[]');

    // Para reservas de una noche entre meses, asignar el monto total al mes de inicio
    if (isOneNightCross && startsInRange) {
        return sumPaymentsByMethod(reservation.payments || []);
    }

    // Para reservas que cruzan más de una noche
    const overlapStart = moment.max(rangeStart, reservationStart);
    const overlapEnd = moment.min(rangeEnd, reservationEnd);
    const nightsInRange = overlapEnd.diff(overlapStart, 'days') + 1;

    // Si no hay noches en el rango, retornar 0
    if (nightsInRange <= 0) {
        return { efectivo: 0, tarjeta: 0, transferencia: 0, total: 0 };
    }

    // Calcular el monto proporcional
    const proportionFactor = nightsInRange / totalNights;

    const totals = {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        total: 0
    };

    // Distribuir los pagos según la proporción
    (reservation.payments || []).forEach(payment => {
        if (!payment.method || !payment.amount) return;
        const amount = payment.amount * proportionFactor;
        totals[payment.method] += amount;
        totals.total += amount;
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

const calculateOccupancyStats = (reservations, startDate, endDate) => {
    const monthStart = moment(startDate).startOf('month');
    const monthEnd = moment(endDate).endOf('month');
    const daysInMonth = monthEnd.diff(monthStart, 'days') + 1;
    const totalPossibleRoomDays = TOTAL_HABITACIONES * daysInMonth;

    console.log('Calculando estadísticas de ocupación:', {
        reservations: reservations.length,
        startDate: monthStart.format('YYYY-MM-DD'),
        endDate: monthEnd.format('YYYY-MM-DD'),
        daysInMonth,
        totalPossibleRoomDays
    });

    let totalNochesOcupadas = 0;
    let habitacionesPorDia = new Array(daysInMonth).fill(0);
    let reservasCruzanMeses = 0;
    let detallesReservasCruzadas = [];
    let diasConOcupacion = new Set();

    reservations.forEach(reservacion => {
        const startDate = moment(reservacion.start);
        const endDate = moment(reservacion.end);
        const effectiveStart = moment.max(startDate, monthStart);
        const effectiveEnd = moment.min(endDate, monthEnd);
        const nightsInMonth = effectiveEnd.diff(effectiveStart, 'days');
        const crossesMonths = startDate.month() !== endDate.month();

        console.log('Procesando reservación:', {
            id: reservacion._id,
            inicio: effectiveStart.format('YYYY-MM-DD'),
            fin: effectiveEnd.format('YYYY-MM-DD'),
            noches: nightsInMonth,
            cruzaMeses: crossesMonths,
            habitaciones: reservacion.room ? (Array.isArray(reservacion.room) ? reservacion.room.length : 1) : 1
        });

        if (crossesMonths) {
            reservasCruzanMeses++;
            detallesReservasCruzadas.push({
                id: reservacion._id,
                nombre: reservacion.name,
                habitacion: Array.isArray(reservacion.room) ? reservacion.room.join(', ') : reservacion.room,
                inicio: startDate.format('DD/MM/YYYY'),
                fin: endDate.format('DD/MM/YYYY'),
                nochesEnEsteMes: nightsInMonth,
                nochesTotales: endDate.diff(startDate, 'days')
            });
        }

        if (nightsInMonth > 0) {
            const numHabitaciones = reservacion.room ?
                (Array.isArray(reservacion.room) ? reservacion.room.length : 1) : 1;

            for (let i = 0; i < nightsInMonth; i++) {
                const diaIndex = effectiveStart.clone().add(i, 'days').diff(monthStart, 'days');
                if (diaIndex >= 0 && diaIndex < daysInMonth) {
                    habitacionesPorDia[diaIndex] += numHabitaciones;
                    totalNochesOcupadas += numHabitaciones;
                    diasConOcupacion.add(diaIndex);
                }
            }
        }
    });

    const porcentajeOcupacion = Number(((totalNochesOcupadas / totalPossibleRoomDays) * 100).toFixed(2));

    console.log('Resultados finales:', {
        totalNochesOcupadas,
        diasConOcupacion: diasConOcupacion.size,
        porcentajeOcupacion,
        ocupacionPorDia: habitacionesPorDia
    });

    return {
        porcentajeOcupacion,
        diasOcupados: diasConOcupacion.size,
        totalReservaciones: reservations.length,
        diasEnMes: daysInMonth,
        habitacionesDisponiblesMes: totalPossibleRoomDays,
        reservasCruzanMeses,
        detallesReservasCruzadas,
        ocupacionDiaria: habitacionesPorDia.map((cantidad, index) => ({
            fecha: moment(monthStart).add(index, 'days').format('DD/MM/YYYY'),
            habitaciones: cantidad
        }))
    };
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
        console.log('Recibida solicitud de totales:', {
            userId,
            startDate,
            endDate,
            parsedStartDate: moment(startDate).format('YYYY-MM-DD'),
            parsedEndDate: moment(endDate).format('YYYY-MM-DD')
        });

        const reservations = await getReservationsForPeriod(userId, startDate, endDate);
        console.log(`Encontradas ${reservations.length} reservaciones para el período`);

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
        reservations.forEach((reservation, index) => {
            console.log(`Procesando reservación ${index + 1}:`, {
                id: reservation._id,
                start: moment(reservation.start).format('YYYY-MM-DD'),
                end: moment(reservation.end).format('YYYY-MM-DD'),
                payments: reservation.payments
            });

            const paymentTotals = calculatePaymentTotals(reservation, {
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            });

            console.log('Totales calculados para la reservación:', paymentTotals);

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

        // Calcular estadísticas de ocupación
        const occupancyStats = calculateOccupancyStats(reservations, startDate, endDate);

        const response = {
            totals,
            details: details.filter(d => d.count > 0),
            occupancyStats
        };

        console.log('Respuesta:', response);
        res.json(response);

    } catch (error) {
        console.error('Error calculando totales:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;