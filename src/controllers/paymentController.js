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

const PaymentHistory = require('../models/PaymentHistory');

const updateReservationPayments = async (req, res) => {
    try {
        const { id } = req.params;
        const { payments, precioTotal, performedBy } = req.body;

        // Obtener estado actual antes de actualizar
        const currentReservation = await Reservation.findById(id);
        const previousPayments = currentReservation.payments;

        // Validar que el total de pagos no exceda el precio total
        const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
        if (totalPayments > precioTotal) {
            return res.status(400).json({
                success: false,
                message: 'El total de pagos no puede exceder el precio total'
            });
        }

        // Registrar cambios en el historial
        const changes = [];

        // Detectar pagos eliminados
        previousPayments.forEach(prevPayment => {
            if (!payments.find(p => p._id && p._id.toString() === prevPayment._id.toString())) {
                changes.push({
                    action: 'delete',
                    previousState: prevPayment,
                    newState: null
                });
            }
        });

        // Detectar pagos nuevos o modificados
        payments.forEach(payment => {
            if (!payment._id) {
                // Nuevo pago
                changes.push({
                    action: 'add',
                    previousState: null,
                    newState: payment
                });
            } else {
                // Pago existente - verificar si fue modificado
                const prevPayment = previousPayments.find(p => p._id.toString() === payment._id.toString());
                if (prevPayment && (
                    prevPayment.amount !== payment.amount ||
                    prevPayment.method !== payment.method ||
                    prevPayment.recepcionista !== payment.recepcionista
                )) {
                    changes.push({
                        action: 'edit',
                        previousState: prevPayment,
                        newState: payment
                    });
                }
            }
        });

        // Guardar cambios en el historial
        await Promise.all(changes.map(change =>
            PaymentHistory.create({
                reservation: id,
                action: change.action,
                previousState: change.previousState,
                newState: change.newState,
                performedBy
            })
        ));

        // Actualizar la reserva
        currentReservation.payments = payments;
        currentReservation.totalPaid = totalPayments;
        currentReservation.montoPendiente = precioTotal - totalPayments;

        // Actualizar estado de facturación
        if (totalPayments === 0) {
            currentReservation.billingStatus = 'pendiente';
        } else if (totalPayments === precioTotal) {
            const methodCounts = payments.reduce((acc, payment) => {
                acc[payment.method] = (acc[payment.method] || 0) + payment.amount;
                return acc;
            }, {});

            const predominantMethod = Object.entries(methodCounts)
                .reduce((a, b) => a[1] > b[1] ? a : b)[0];

            currentReservation.billingStatus = `pagado_${predominantMethod}`;
        } else {
            currentReservation.billingStatus = 'pendiente';
        }

        await currentReservation.save();

        res.json({
            success: true,
            data: currentReservation
        });

    } catch (error) {
        console.error('Error updating reservation payments:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Agregar nuevo endpoint para obtener historial de pagos
const getPaymentHistory = async (req, res) => {
    try {
        const { reservationId } = req.params;

        const history = await PaymentHistory.find({ reservation: reservationId })
            .sort({ timestamp: -1 });

        res.json({
            success: true,
            data: history
        });

    } catch (error) {
        console.error('Error fetching payment history:', error);
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
    getYearlySummary,
    getPaymentHistory
}; 