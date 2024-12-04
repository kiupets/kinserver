const calculateMonthlyTotals = async (req, res) => {
    try {
        const { userId, month, year } = req.query;

        // Obtener el primer y último día del mes
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const reservations = await Reservation.find({
            user: userId,
            $or: [
                {
                    start: { $gte: startDate, $lte: endDate }
                },
                {
                    end: { $gte: startDate, $lte: endDate }
                },
                {
                    $and: [
                        { start: { $lte: startDate } },
                        { end: { $gte: endDate } }
                    ]
                }
            ]
        });

        let totals = {
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            total: 0
        };

        // Procesar cada reserva
        reservations.forEach(reservation => {
            const startDate = new Date(reservation.start);
            const endDate = new Date(reservation.end);
            const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

            // Distribuir los pagos por día
            reservation.payments.forEach(payment => {
                const dailyAmount = payment.amount / nights;
                const daysInSelectedMonth = getDaysInMonth(startDate, endDate, month, year);
                const totalForMonth = dailyAmount * daysInSelectedMonth;

                totals[payment.method] += totalForMonth;
                totals.total += totalForMonth;
            });
        });

        res.json({
            success: true,
            data: {
                totals,
                month,
                year
            }
        });

    } catch (error) {
        console.error('Error calculating monthly totals:', error);
        res.status(500).json({ error: error.message });
    }
};

// Función auxiliar para calcular días en el mes seleccionado
function getDaysInMonth(startDate, endDate, month, year) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const reservationStart = new Date(Math.max(startDate, monthStart));
    const reservationEnd = new Date(Math.min(endDate, monthEnd));

    return Math.ceil((reservationEnd - reservationStart) / (1000 * 60 * 60 * 24));
}

const updateReservationPayments = async (req, res) => {
    try {
        const { id } = req.params;
        const { payments, precioTotal } = req.body;

        // Validar que el total de pagos no exceda el precio total
        const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
        if (totalPayments > precioTotal) {
            return res.status(400).json({
                success: false,
                message: 'El total de pagos no puede exceder el precio total'
            });
        }

        const reservation = await Reservation.findById(id);
        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: 'Reserva no encontrada'
            });
        }

        // Actualizar los pagos y calcular totales
        reservation.payments = payments;
        reservation.totalPaid = totalPayments;
        reservation.montoPendiente = precioTotal - totalPayments;

        // Actualizar el estado de facturación basado en los pagos
        if (totalPayments === 0) {
            reservation.billingStatus = 'pendiente';
        } else if (totalPayments === precioTotal) {
            // Determinar el método de pago predominante
            const methodCounts = payments.reduce((acc, payment) => {
                acc[payment.method] = (acc[payment.method] || 0) + payment.amount;
                return acc;
            }, {});

            const predominantMethod = Object.entries(methodCounts)
                .reduce((a, b) => a[1] > b[1] ? a : b)[0];

            reservation.billingStatus = `pagado_${predominantMethod}`;
        } else {
            reservation.billingStatus = 'pendiente';
        }

        await reservation.save();

        res.json({
            success: true,
            data: reservation
        });

    } catch (error) {
        console.error('Error updating reservation payments:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getYearlySummary = async (req, res) => {
    try {
        const { userId, year } = req.params;
        const PaymentTotal = require('../models/PaymentTotal');

        const yearlyData = await PaymentTotal.getYearlySummary(userId, parseInt(year));

        res.json(yearlyData);
    } catch (error) {
        console.error('Error al obtener resumen anual:', error);
        res.status(500).json({
            message: 'Error al obtener resumen anual',
            error: error.message
        });
    }
};

module.exports = {
    calculateMonthlyTotals,
    updateReservationPayments,
    getYearlySummary
}; 