const express = require("express");
const { Server } = require("socket.io");
const router = express.Router();
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
require("./src/db");
const authRoutes = require("./src/routes/auth");
const reservationRoutes = require("./src/routes/reservations");
const Reservation = require("./src/models/Reservation");
const http = require("http");
const User = require("./src/models/User");
const uuid = require("uuid");
const app = express();
const PORT = process.env.PORT || 8000;
const mongoose = require("mongoose");
const connectedUsers = [];
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const cors = require("cors");

const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
const server = http.createServer(app);

const store = new MongoDBStore({
  // uri: process.env.MONGODB_URI,
  uri: "mongodb+srv://kiupets:julietaygonzalo2023@cluster0.cpgytzo.mongodb.net/db-name?retryWrites=true&w=majority",
  collection: "mySessions",
});
const io = new Server(server, {
  // cors: { origin: "*", methods: ["GET", "POST"] },
  cors: {
    origin: "http://localhost:3000",
  },
});

app.use(cors(corsOptions));
app.use(express.static("build"));
app.use(
  session({
    secret: "mysecret",
    // secret: process.env.SESSION_SECRET || "miCadenaSecretaPorDefecto",
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

io.on("connection", (socket) => {
  socket.on("login", (userId) => {
    // Buscar si el usuario ya está en el array
    // Verifica si el usuario ya está en la lista de usuarios conectados
    const existingUserIndex = connectedUsers.findIndex(
      (user) => user.user === userId
    );
    if (existingUserIndex === -1) {
      // Si el usuario no está presente, crea una nueva entrada en el array
      connectedUsers.push({ user: userId, socketId: [socket.id] });
    } else {
      // Si el usuario ya está presente, verifica si el socket ya existe
      if (!connectedUsers[existingUserIndex].socketId.includes(socket.id)) {
        // Agrega el nuevo socket solo si no existe en la lista de sockets del usuario
        connectedUsers[existingUserIndex].socketId.push(socket.id);
        console.log(`User ${userId} reconnected with new socket.`);
      } else {
        console.log(`Socket ${socket.id} already exists for user ${userId}.`);
      }
    }
  });
  socket.on("disconnect", () => {
    // Recorre la lista de usuarios conectados
    for (let i = 0; i < connectedUsers.length; i++) {
      const user = connectedUsers[i];
      const index = user.socketId.indexOf(socket.id);
      // Si se encuentra el socket en la lista de sockets del usuario, elimínalo
      if (index !== -1) {
        user.socketId.splice(index, 1);
        // Si el usuario ya no tiene más sockets activos, elimina toda la entrada del usuario
        if (user.socketId.length === 0) {
          connectedUsers.splice(i, 1);
        }
        break; // No es necesario seguir buscando en otros usuarios
      }
    }
  });
});

app.use("/auth", authRoutes);
app.use("/reservations", reservationRoutes);

app.get("/all", async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Debe iniciar sesión para ver las reservas" });
    }

    const userReservations = await Reservation.find({ user: userId });
    res.status(200).json({ userReservations });

    const userSockets = connectedUsers.filter((user) => user.user === userId);

    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("allReservations", { userReservations });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/create-reservation", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      room,
      start,
      end,
      isOverlapping,
      price,
      nights,
      time,
      userId,
      comments,
      precioTotal,
      adelanto,
      nombre_recepcionista,
      montoPendiente,
      dni,
      paymentMethod,
      numberOfGuests,
      guestNames,
      roomType,
      isBooking,
      surname,
      billingStatus,
      housekeepingStatus,
    } = req.body;
    if (!userId) {
      return res
        .status(401)
        .json({ message: "Debe iniciar sesión para hacer una reserva" });
    }

    const reservation = new Reservation({
      user: userId,
      name,
      email,
      phone,
      room,
      start,
      end,
      time,
      isOverlapping,
      price: parseFloat(price),
      nights: parseInt(nights, 10),
      precioTotal: parseFloat(precioTotal),
      comments,
      adelanto,
      nombre_recepcionista,
      montoPendiente,
      dni,
      paymentMethod,
      numberOfGuests,
      guestNames,
      roomType,
      isBooking,
      surname,
      billingStatus,
      housekeepingStatus,
    });

    await reservation.save();
    await updateAndEmitPaymentMethodTotals(userId);
    const userSockets = connectedUsers.filter((user) => user.user === userId);

    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("reservationCreated", {
        ...reservation.toObject(),
        id: reservation._id,
      });
    });
    res.status(200).json({
      message: "Reservation created successfully",
      reservation: { ...reservation.toObject(), id: reservation._id },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/update-reservation/:id", async (req, res) => {
  try {
    const reservationId = req.params.id;
    const {
      name,
      email,
      phone,
      room,
      start,
      end,
      isOverlapping,
      price,
      nights,
      time,
      userId,
      comments,
      precioTotal,
      adelanto,
      nombre_recepcionista,
      montoPendiente,
      dni,
      paymentMethod,
      numberOfGuests,
      guestNames,
      roomType,
      isBooking,
      surname,
      billingStatus,
      housekeepingStatus,
    } = req.body;

    // Crear un objeto con los campos que se van a actualizar
    const updateFields = {};
    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (!isNaN(parsedPrice)) {
        updateFields.price = parsedPrice;
      } else {
        return res.status(400).json({ message: "Invalid price value" });
      }
    }
    // Añadir todos los campos al objeto de actualización si están presentes
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;
    if (phone !== undefined) updateFields.phone = phone;
    if (room !== undefined) updateFields.room = room;
    if (start !== undefined) updateFields.start = start;
    if (end !== undefined) updateFields.end = end;
    if (isOverlapping !== undefined) updateFields.isOverlapping = isOverlapping;
    if (price !== undefined) updateFields.price = parseFloat(price);
    if (nights !== undefined) updateFields.nights = parseInt(nights, 10);
    if (time !== undefined) updateFields.time = time;
    if (comments !== undefined) updateFields.comments = comments;
    if (precioTotal !== undefined)
      updateFields.precioTotal = parseFloat(precioTotal);
    if (adelanto !== undefined) updateFields.adelanto = adelanto;
    if (nombre_recepcionista !== undefined)
      updateFields.nombre_recepcionista = nombre_recepcionista;
    if (montoPendiente !== undefined)
      updateFields.montoPendiente = montoPendiente;
    if (dni !== undefined) updateFields.dni = dni;
    if (paymentMethod !== undefined) updateFields.paymentMethod = paymentMethod;
    if (numberOfGuests !== undefined)
      updateFields.numberOfGuests = numberOfGuests;
    if (guestNames !== undefined) updateFields.guestNames = guestNames;
    if (roomType !== undefined) updateFields.roomType = roomType;
    if (isBooking !== undefined) updateFields.isBooking = isBooking;
    if (surname !== undefined) updateFields.surname = surname;
    if (billingStatus !== undefined) updateFields.billingStatus = billingStatus;
    if (housekeepingStatus !== undefined)
      updateFields.housekeepingStatus = housekeepingStatus;

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      updateFields,
      { new: true }
    );

    if (!updatedReservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    await updatedReservation.save();
    await updateAndEmitPaymentMethodTotals(userId);

    const userSockets = connectedUsers.filter((user) => user.user === userId);

    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("updateReservation", {
        ...updatedReservation.toObject(),
        id: updatedReservation._id,
      });
    });

    res.status(200).json({
      message: "Reservation updated successfully",
      reservation: {
        ...updatedReservation.toObject(),
        id: updatedReservation._id,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/delete-reservation/:id", async (req, res) => {
  try {
    const reservationId = req.params.id;
    const { userId } = req.body;

    const deletedReservation = await Reservation.findByIdAndDelete(
      reservationId
    );
    await updateAndEmitPaymentMethodTotals(userId);
    if (!deletedReservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    const userSockets = connectedUsers.filter((user) => user.user === userId);

    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("deleteReservation", {
        id: reservationId,
      });
    });
    console.log(userSockets);
    res.status(200).json({
      message: "Reservation deleted successfully",
      reservation: {
        id: reservationId,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/total-sales/:month", async (req, res) => {
  try {
    const { month } = req.params;
    const targetMonth = parseInt(month); // Convert month to a number

    const totalSales = await Reservation.aggregate([
      {
        $match: {
          $expr: {
            $eq: [{ $month: "$start" }, targetMonth], // Filter by month (e.g., July - month number 7)
          },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: { $toDouble: "$precioTotal" } },
        },
      },
    ]);

    res.status(200).json({
      totalSales: totalSales.length > 0 ? totalSales[0].totalAmount : 0,
    });
  } catch (error) {
    console.error("Error calculating total sales:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/payment-method-totals/:month", async (req, res) => {
  try {
    const { month } = req.params;
    const { userId } = req.query;
    const targetMonth = parseInt(month);

    console.log(`Querying for month: ${targetMonth}, userId: ${userId}`);

    const paymentMethodTotals = await Reservation.aggregate([
      {
        $match: {
          $expr: {
            $eq: [{ $month: "$start" }, targetMonth],
          },
          user: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: { $toDouble: "$precioTotal" } },
        },
      },
    ]);

    console.log("Aggregation result:", paymentMethodTotals);

    const result = {
      efectivo: 0,
      tarjeta: 0,
      deposito: 0,
    };

    paymentMethodTotals.forEach((item) => {
      if (item._id in result) {
        result[item._id] = item.total;
      }
    });

    console.log("Final result:", result);

    res.status(200).json({
      message: "Payment method totals calculated successfully",
      totals: result,
    });
  } catch (error) {
    console.error("Error calculating payment method totals:", error);
    res.status(500).json({ error: error.message });
  }
});
async function updateAndEmitPaymentMethodTotals(userId) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;

  const paymentMethodTotals = await Reservation.aggregate([
    {
      $match: {
        $expr: {
          $eq: [{ $month: "$start" }, currentMonth],
        },
        user: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: "$paymentMethod",
        total: { $sum: { $toDouble: "$precioTotal" } },
      },
    },
  ]);

  const result = {
    efectivo: 0,
    tarjeta: 0,
    deposito: 0,
  };

  paymentMethodTotals.forEach((item) => {
    if (item._id in result) {
      result[item._id] = item.total;
    }
  });

  const userSockets = connectedUsers.filter((user) => user.user === userId);
  userSockets.forEach((userSocket) => {
    io.to(userSocket.socketId).emit("paymentMethodTotalsUpdated", {
      userId: userId,
      totals: result,
    });
  });
}
server.listen(PORT, () => {
  console.log("listening on *:8000");
});
module.exports.connectedUsers = connectedUsers;
