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
    // Validación básica de email
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingrese un email válido']
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
  adelanto: {
    type: Number,
    default: 0,
    min: [0, 'El adelanto no puede ser negativo']
  },
  montoPendiente: {
    type: Number,
    default: 0
  },
  isOverlapping: {
    type: Boolean,
    default: false
  },
  isDragging: {
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
  paymentMethod: {
    type: String,
    enum: {
      values: ["efectivo", "tarjeta", "transferencia"],
      message: '{VALUE} no es un método de pago válido'
    }
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
  surname: {
    type: String
  },
  billingStatus: {
    type: String,
    enum: ['pendiente', 'pagado_efectivo', 'pagado_tarjeta', 'pagado_transferencia'],
    default: 'pendiente'
  },
  billingStatus: {
    type: String,
    enum: ['pendiente', 'pagado_efectivo', 'pagado_tarjeta', 'pagado_transferencia'],
    default: 'pendiente'
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
  montoPendiente: {
    type: Number,
    default: function () {
      return this.precioTotal || 0;
    }
  }
}, {
  timestamps: true // Agregar timestamps para la reservación
});

// Middleware pre-save mejorado para calcular totales
// Middleware pre-save mejorado
reservationSchema.pre('save', function (next) {
  // Calcular total pagado
  if (this.payments && Array.isArray(this.payments)) {
    this.totalPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
  }

  // Calcular monto pendiente (nunca debe ser negativo)
  this.montoPendiente = Math.max(0, (this.precioTotal || 0) - (this.totalPaid || 0));

  next();
});

// Validación para payments
reservationSchema.path('payments').validate(function (payments) {
  if (!payments) return true;

  const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
  // Permitir que el total de pagos sea igual al precio total
  return totalPayments <= (this.precioTotal || 0);
}, 'El total de pagos no puede exceder el precio total de la reserva');

const Reservation = mongoose.model("Reservation", reservationSchema);

module.exports = Reservation; 