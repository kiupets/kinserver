const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es requerido']
  },
  surname: {
    type: String,
    required: [true, 'El apellido es requerido']
  },
  phone: {
    type: String,
    required: [true, 'El teléfono es requerido']
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingrese un email válido']
  },
  dni: {
    type: String,
    required: [true, 'El DNI es requerido'],
    index: true // Agregamos índice para mejorar búsquedas por DNI
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El ID de usuario es requerido']
  }
}, {
  timestamps: true // Esto agregará createdAt y updatedAt automáticamente
});

// Índice compuesto para búsquedas frecuentes
guestSchema.index({ user: 1, dni: 1 }, { unique: true }); // Asegura que no haya duplicados de DNI por usuario

// Índices para mejorar búsquedas por nombre y apellido
guestSchema.index({ user: 1, name: 1 });
guestSchema.index({ user: 1, surname: 1 });

const Guest = mongoose.model('Guest', guestSchema);

module.exports = Guest;