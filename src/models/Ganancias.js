// src/models/Ganancias.js
const mongoose = require('mongoose');

const VALOR_HORA_DEFAULT = 1500;

const TIPOS_GASTO = [
    'SERVICIOS',
    'SUELDOS',
    'PRESENTISMO',
    'PREMIOS',
    'HORAS_EXTRAS',
    'INSUMOS_DESAYUNO',
    'INSUMOS_LIMPIEZA',
    'MANTENIMIENTO',
    'OTROS'
];

const gananciasSchema = new mongoose.Schema({
    fecha: {
        type: Date,
        default: Date.now
    },
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
            enum: TIPOS_GASTO,
            required: true
        },
        concepto: {
            type: String,
            required: true
        },
        monto: {
            type: Number,
            required: true
        },
        metodoPago: {
            type: String,
            enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'],
            required: true
        },
        fecha: {
            type: Date,
            required: function () {
                return this.tipo === 'HORAS_EXTRAS';
            }
        },
        turno: {
            type: String,
            enum: ['MAÑANA', 'TARDE', 'NOCHE'],
            required: function () {
                return this.tipo === 'HORAS_EXTRAS';
            }
        },
        cantidadHoras: {
            type: Number,
            required: function () {
                return this.tipo === 'HORAS_EXTRAS';
            },
            default: function () {
                return this.tipo === 'HORAS_EXTRAS' ? 0 : undefined;
            }
        },
        valorHora: {
            type: Number,
            default: VALOR_HORA_DEFAULT
        }
    }],
    gastosExtraordinarios: [{
        concepto: String,
        monto: Number,
        categoria: {
            type: String,
            enum: ['Equipamiento', 'Habitaciones', 'Mantenimiento', 'Financiamiento', 'Insumos']
        },
        metodoPago: {
            type: String,
            enum: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'],
            required: true
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
    },
    cajaAnterior: {
        type: Number,
        required: true
    },
    caja: {
        cajaAnterior: {
            type: Number,
            required: true
        },
        ingresosEfectivo: {
            type: Number,
            required: true,
            default: 0
        },
        gastosEfectivo: {
            type: Number,
            required: true,
            default: 0
        },
        saldoFinal: {
            type: Number,
            required: true,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Middleware pre-save para calcular el monto y validar fechas
gananciasSchema.pre('save', function (next) {
    // Procesar gastos ordinarios
    this.gastosOrdinarios = this.gastosOrdinarios.map(gasto => {
        // Convertir fecha string a Date para horas extras
        if (gasto.tipo === 'HORAS_EXTRAS') {
            if (typeof gasto.fecha === 'string') {
                gasto.fecha = new Date(gasto.fecha);
            }
            // Calcular monto para horas extras
            gasto.monto = (gasto.cantidadHoras || 0) * (gasto.valorHora || VALOR_HORA_DEFAULT);
        }

        // Asegurar que el monto sea un número para insumos
        if (gasto.tipo === 'INSUMOS_DESAYUNO' || gasto.tipo === 'INSUMOS_LIMPIEZA') {
            gasto.monto = Number(gasto.monto) || 0;
        }

        return gasto;
    });

    // Calcular valores de caja
    const ingresosEfectivo = this.ingresos
        .find(i => i.subcategoria === 'Efectivo')?.monto || 0;

    const gastosEfectivo = this.gastosOrdinarios
        .filter(g => g.metodoPago === 'EFECTIVO')
        .reduce((sum, g) => sum + (g.monto || 0), 0);

    this.caja = {
        cajaAnterior: this.cajaAnterior || 0,
        ingresosEfectivo,
        gastosEfectivo,
        saldoFinal: (this.cajaAnterior || 0) + ingresosEfectivo - gastosEfectivo
    };

    next();
});

const Ganancias = mongoose.model('Ganancias', gananciasSchema);

module.exports = Ganancias;