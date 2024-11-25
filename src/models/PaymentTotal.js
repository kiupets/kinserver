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

// Método estático para obtener resumen mensual
paymentTotalSchema.statics.getMonthlyStats = async function (userId, month, year) {
    const stats = await this.findOne({ userId, month, year });
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

const PaymentTotal = mongoose.model('PaymentTotal', paymentTotalSchema);

module.exports = PaymentTotal;