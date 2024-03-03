// // models/Reservation.js
// const mongoose = require("mongoose");

// const reservationSchema = new mongoose.Schema({
//   id: {
//     type: String, // O el tipo de dato que prefieras para el campo de identificación
//     required: true,
//     unique: true, // Asegura que cada identificación sea única
//   },
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User", // Referencia al modelo User si es necesario
//     required: true,
//   },
//   name: {
//     type: String,
//     required: true,
//   },
//   email: {
//     type: String,
//     required: true,
//   },
//   phone: {
//     type: String,
//     required: true,
//   },
//   room: {
//     type: String,
//     required: true,
//   },
//   start: {
//     type: Date,
//     required: true,
//   },
//   end: {
//     type: Date,
//     required: true,
//   },
//   price: {
//     type: Number,
//     required: true,
//   },
//   nights: {
//     type: Number,
//     required: true,
//   },
// });
// const Reservation = mongoose.model("Reservation", reservationSchema);

// module.exports = Reservation;

const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  room: {
    type: String,
    required: true,
  },
  start: {
    type: Date,
    required: true,
  },
  end: {
    type: Date,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  nights: {
    type: Number,
    required: true,
  },
});

const Reservation = mongoose.model("Reservation", reservationSchema);

module.exports = Reservation;
