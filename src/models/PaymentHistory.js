const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
    reservation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reservation',
        required: true
    },
    action: {
        type: String,
        enum: ['add', 'edit', 'delete'],
        required: true
    },
    previousState: {
        method: String,
        amount: Number,
        date: Date,
        recepcionista: String
    },
    newState: {
        method: String,
        amount: Number,
        date: Date,
        recepcionista: String
    },
    performedBy: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PaymentHistory', paymentHistorySchema); 