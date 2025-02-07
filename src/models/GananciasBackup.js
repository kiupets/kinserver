const mongoose = require('mongoose');

const gananciasBackupSchema = new mongoose.Schema({
    originalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ganancias',
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    month: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Índice para facilitar la limpieza de backups antiguos
gananciasBackupSchema.index({ userId: 1, month: 1, year: 1, createdAt: -1 });

module.exports = mongoose.model('GananciasBackup', gananciasBackupSchema); 