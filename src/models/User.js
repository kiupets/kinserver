const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
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
        }
      }
    }
  }
});

userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();

    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.virtual("reservations", {
  ref: "Reservation",
  localField: "_id",
  foreignField: "user",
});

const User = mongoose.model("User", userSchema);

module.exports = User;
