const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    // required: true,
  },
  name: {
    type: String,
    // required: true,
  },
  email: {
    type: String,
    // required: true,
  },
  phone: {
    type: String,
    // required: true,
  },
  room: {
    type: String,
    // required: true,
  },
  start: {
    type: Date,
    // required: true,
  },
  end: {
    type: Date,
    // required: true,
  },
  price: {
    type: Number,
    // required: true,
  },
  precioTotal: {
    type: Number,
    // required: true,
  },

  nights: {
    type: Number,
    // required: true,
  },
  dni: {
    type: Number,
    // required: true,
    // unique: true,
  },
  comments: {
    type: String,
    // required: true,
  },
  adelanto: {
    type: Number,
    // required: true,
    // default: 0,
  },
  montoPendiente: {
    type: Number,
  },
  isOverlapping: {
    type: Boolean,
    // default: false,
  },
  isBooking: {
    type: Boolean,
    // default: false,
  },
  nombre_recepcionista: {
    type: String,
    // required: true,
  },
  time: {
    type: String,
    // required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["efectivo", "tarjeta", "deposito"],
    required: true,
  },
  roomType: {
    type: String,
    enum: ["individual", "doble", "triple", "cuadruple"],
    required: true,
  },
  numberOfGuests: {
    type: Number,
    // required: true,
  },
  guestNames: {
    type: [String],
    // required: true,
  },
  surname: {
    type: String,
    // required: true,
  },
  billingStatus: {
    type: String,
    // required: true,
  },
  housekeepingStatus: {
    type: String,
    // required: true,
  },
});

const Reservation = mongoose.model("Reservation", reservationSchema);

module.exports = Reservation;
