const mongoose = require("mongoose");

const userReservationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    required: true,
  },
});

const UserReservation = mongoose.model(
  "UserReservation",
  userReservationSchema
);

module.exports = UserReservation;
