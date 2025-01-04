const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Definir el schema de pagos con validaciones mejoradas
const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'transferencia'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  recepcionista: {
    type: String,
    enum: ['gonzalo', 'matias', 'gabriela', 'daniela', 'priscila', 'maxi', ''],
    required: [true, 'El recepcionista es requerido']
  },
  montoPendiente: {
    type: Number,
    required: true
  }
});

const reservationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, 'El usuario es requerido']
  },
  name: {
    type: String,
    required: [true, 'El nombre es requerido']
  },
  email: {
    type: String,
  },
  phone: {
    type: Schema.Types.Mixed
  },
  room: {
    type: [String],
    required: [true, 'La habitación es requerida']
  },
  start: {
    type: Date,
    required: [true, 'La fecha de inicio es requerida']
  },
  end: {
    type: Date,
    required: [true, 'La fecha de fin es requerida']
  },
  price: {
    type: Number,
    required: [true, 'El precio es requerido'],
    min: [0, 'El precio no puede ser negativo']
  },
  precioTotal: {
    type: Number,
    required: [true, 'El precio total es requerido'],
    min: [0, 'El precio total no puede ser negativo']
  },
  nights: {
    type: Number,
    min: [1, 'El número de noches debe ser al menos 1']
  },
  dni: {
    type: Schema.Types.Mixed
  },
  comments: {
    type: String,
    maxlength: [500, 'Los comentarios no pueden exceder los 500 caracteres']
  },
  montoPendiente: {
    type: Number,
    default: function () {
      return this.precioTotal || 0;
    }
  },
  isOverlapping: {
    type: Boolean,
    default: false
  },
  isBooking: {
    type: Boolean,
    default: false
  },
  nombre_recepcionista: {
    type: String
  },
  time: {
    type: String
  },
  roomType: {
    type: String,
    enum: {
      values: ["individual", "doble", "triple", "cuadruple"],
      message: '{VALUE} no es un tipo de habitación válido'
    },
    required: [true, 'El tipo de habitación es requerido']
  },
  numberOfGuests: {
    type: Number,
    min: [1, 'Debe haber al menos 1 huésped'],
    max: [4, 'No puede haber más de 4 huéspedes']
  },
  guestNames: {
    type: [String]
  },
  dragging: {
    type: Boolean
  },
  surname: {
    type: String
  },
  roomStatus: {
    type: String,
    enum: [
      'disponible',
      'ocupada',
      'limpieza',
      'mantenimiento',
      'bloqueada',
      'checkout_pendiente',
      'reservada'
    ],
    default: 'disponible'
  },
  guestDNIs: {
    type: [String]
  },
  payments: [paymentSchema],
  totalPaid: {
    type: Number,
    default: 0
  },
  styles: {
    type: Object,
    default: {
      statusStyles: {
        roomStatus: {
          disponible: { backgroundColor: '#86EFAC', borderColor: '#27ae60' },
          ocupada: { backgroundColor: '#FDA4AF', borderColor: '#c0392b' },
          limpieza: { backgroundColor: '#FDE047', borderColor: '#f39c12' },
          mantenimiento: { backgroundColor: '#94A3B8', borderColor: '#7f8c8d' },
          bloqueada: { backgroundColor: '#475569', borderColor: '#2c3e50' },
          checkout_pendiente: { backgroundColor: '#FDBA74', borderColor: '#d35400' },
          reservada: { backgroundColor: '#7DD3FC', borderColor: '#2980b9' }
        },
        billingStatus: {
          pendiente: { backgroundColor: '#fa0101' },
          efectivo: { backgroundColor: '#86EFAC' },
          tarjeta: { backgroundColor: '#93C5FD' },
          transferencia: { backgroundColor: '#FDE047' }
        },
        pastReservations: {
          color: '#E5E7EB',
          enabled: false
        }
      }
    }
  }
}, {
  timestamps: true
});

// Middleware para calcular totalPaid y montoPendiente antes de guardar
reservationSchema.pre('save', function (next) {
  if (this.payments && Array.isArray(this.payments)) {
    this.totalPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
    this.montoPendiente = Math.max(0, this.precioTotal - this.totalPaid);
  } else {
    this.totalPaid = 0;
    this.montoPendiente = this.precioTotal;
  }
  next();
});

// Validación para los pagos
paymentSchema.pre('validate', function (next) {
  if (this.amount <= 0) {
    next(new Error('El monto del pago debe ser mayor que 0'));
    return;
  }
  next();
});

// Validación para el total de pagos
reservationSchema.pre('validate', function (next) {
  if (this.payments && Array.isArray(this.payments)) {
    const totalPayments = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (totalPayments > this.precioTotal) {
      next(new Error('El total de pagos no puede exceder el precio total'));
      return;
    }
  }
  next();
});

const Reservation = mongoose.model("Reservation", reservationSchema);

module.exports = Reservation;