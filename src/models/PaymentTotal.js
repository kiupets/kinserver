const mongoose = require('mongoose');

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
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PaymentTotal', paymentTotalSchema);    