// src/models/Ganancias.js
const mongoose = require('mongoose');

const gananciasSchema = new mongoose.Schema({
    fecha: {
        type: Date,
        default: Date.now
    },
    ingresos: [{
        subcategoria: String,
        monto: Number
    }],
    gastosOrdinarios: [{
        tipo: {
            type: String,
            enum: ['SERVICIOS', 'SUELDOS', 'PRESENTISMO', 'PREMIOS']
        },
        concepto: String,
        monto: Number
    }],
    gastosExtraordinarios: [{
        concepto: String,
        monto: Number,
        categoria: {
            type: String,
            enum: ['Equipamiento', 'Habitaciones', 'Mantenimiento', 'Financiamiento', 'Insumos']
        }
    }],
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Ganancias', gananciasSchema);  