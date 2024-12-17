// src/models/Ganancias.js
const mongoose = require('mongoose');

const gananciasSchema = new mongoose.Schema({
    fecha: {
        type: Date,
        default: Date.now
    },
    // Nuevos campos para el mes y año
    month: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    ingresos: [{
        subcategoria: String,
        monto: Number
    }],
    gastosOrdinarios: [{
        tipo: {
            type: String,
            enum: ['SERVICIOS', 'SUELDOS', 'PRESENTISMO', 'PREMIOS', 'INSUMOS DESAYUNO', 'INSUMOS LIMPIEZA']
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
    occupancyRate: {
        type: Number,
        default: 0
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Ganancias', gananciasSchema);