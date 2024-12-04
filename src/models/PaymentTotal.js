const mongoose = require('mongoose');

const paymentDetailSchema = new mongoose.Schema({
    method: {
        type: String,
        enum: ['efectivo', 'tarjeta', 'transferencia'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        default: 0
    },
    count: {
        type: Number,
        default: 0
    }
});

const paymentTotalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    month: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    // Mantener los campos individuales para acceso rápido
    efectivo: {
        type: Number,
        default: 0
    },
    tarjeta: {
        type: Number,
        default: 0
    },
    transferencia: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        default: 0
    },
    // Agregar detalles adicionales por método de pago
    paymentDetails: [paymentDetailSchema],
    // Estadísticas adicionales
    totalReservations: {
        type: Number,
        default: 0
    },
    averagePaymentAmount: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    // Índices para búsqueda rápida
}, {
    timestamps: true,
    indexes: [
        { userId: 1, month: 1, year: 1 }
    ]
});

// Método para actualizar los totales
paymentTotalSchema.methods.updateTotals = function () {
    const details = this.paymentDetails;
    this.efectivo = details.find(d => d.method === 'efectivo')?.amount || 0;
    this.tarjeta = details.find(d => d.method === 'tarjeta')?.amount || 0;
    this.transferencia = details.find(d => d.method === 'transferencia')?.amount || 0;
    this.total = this.efectivo + this.tarjeta + this.transferencia;
    this.averagePaymentAmount = this.total / (details.reduce((sum, d) => sum + d.count, 0) || 1);
};

// Método para agregar un nuevo pago
paymentTotalSchema.methods.addPayment = function (method, amount) {
    const detail = this.paymentDetails.find(d => d.method === method);
    if (detail) {
        detail.amount += amount;
        detail.count += 1;
    } else {
        this.paymentDetails.push({
            method,
            amount,
            count: 1
        });
    }
    this.updateTotals();
};

// Middleware para mantener los totales actualizados
paymentTotalSchema.pre('save', function (next) {
    this.updateTotals();
    next();
});

// Virtual para obtener el porcentaje por método de pago
paymentTotalSchema.virtual('percentages').get(function () {
    return {
        efectivo: this.total ? (this.efectivo / this.total) * 100 : 0,
        tarjeta: this.total ? (this.tarjeta / this.total) * 100 : 0,
        transferencia: this.total ? (this.transferencia / this.total) * 100 : 0
    };
});

// Método estático para calcular totales desde las reservaciones
paymentTotalSchema.statics.calculateTotalsFromReservations = async function (userId, month, year) {
    const Reservation = mongoose.model('Reservation');

    // Obtener el primer y último día del mes
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Buscar todas las reservaciones del mes con pagos
    const reservations = await Reservation.find({
        user: userId,
        'payments.date': {
            $gte: startDate,
            $lte: endDate
        }
    });

    // Inicializar contadores
    const totals = {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0
    };

    const counts = {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0
    };

    let totalPayments = 0;
    let totalCount = 0;

    // Calcular totales desde los pagos
    reservations.forEach(reservation => {
        reservation.payments.forEach(payment => {
            const paymentDate = new Date(payment.date);
            if (paymentDate >= startDate && paymentDate <= endDate) {
                totals[payment.method] += payment.amount;
                counts[payment.method]++;
                totalPayments += payment.amount;
                totalCount++;
            }
        });
    });

    // Crear o actualizar el registro de PaymentTotal
    const paymentTotal = await this.findOneAndUpdate(
        { userId, month, year },
        {
            $set: {
                efectivo: totals.efectivo,
                tarjeta: totals.tarjeta,
                transferencia: totals.transferencia,
                total: totalPayments,
                paymentDetails: [
                    { method: 'efectivo', amount: totals.efectivo, count: counts.efectivo },
                    { method: 'tarjeta', amount: totals.tarjeta, count: counts.tarjeta },
                    { method: 'transferencia', amount: totals.transferencia, count: counts.transferencia }
                ],
                totalReservations: reservations.length,
                averagePaymentAmount: totalCount > 0 ? totalPayments / totalCount : 0,
                lastUpdated: new Date()
            }
        },
        { upsert: true, new: true }
    );

    return paymentTotal;
};

// Actualizar el método getMonthlyStats para usar el nuevo cálculo
paymentTotalSchema.statics.getMonthlyStats = async function (userId, month, year) {
    // Primero calculamos los totales desde las reservaciones
    const stats = await this.calculateTotalsFromReservations(userId, month, year);
    if (!stats) return null;

    return {
        totals: {
            efectivo: stats.efectivo,
            tarjeta: stats.tarjeta,
            transferencia: stats.transferencia,
            total: stats.total
        },
        percentages: stats.percentages,
        details: stats.paymentDetails,
        averagePaymentAmount: stats.averagePaymentAmount,
        totalReservations: stats.totalReservations
    };
};

// Agregar este nuevo método estático después de getMonthlyStats
paymentTotalSchema.statics.getYearlySummary = async function (userId, year) {
    const Reservation = mongoose.model('Reservation');

    // Obtener el primer y último día del año
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // Buscar todas las reservaciones del año
    const reservations = await Reservation.find({
        user: userId,
        'payments.date': {
            $gte: startDate,
            $lte: endDate
        }
    });

    // Inicializar array para almacenar datos mensuales
    const monthlyData = Array(12).fill().map(() => ({
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        total: 0
    }));

    // Calcular totales mensuales desde los pagos
    reservations.forEach(reservation => {
        reservation.payments.forEach(payment => {
            const paymentDate = new Date(payment.date);
            if (paymentDate >= startDate && paymentDate <= endDate) {
                const month = paymentDate.getMonth();
                monthlyData[month][payment.method] += payment.amount;
                monthlyData[month].total += payment.amount;
            }
        });
    });

    // Formatear datos para la respuesta
    return monthlyData.map((data, index) => ({
        month: index + 1,
        efectivo: data.efectivo,
        tarjeta: data.tarjeta,
        transferencia: data.transferencia,
        total: data.total
    }));
};

const PaymentTotal = mongoose.model('PaymentTotal', paymentTotalSchema);

module.exports = PaymentTotal;