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
const connectedUsers = [];
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const cors = require("cors");

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
};
const server = http.createServer(app);

const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  // uri: "mongodb+srv://kiupets:julietaygonzalo2023@cluster0.cpgytzo.mongodb.net/db-name?retryWrites=true&w=majority",
  collection: "mySessions",
});
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors(corsOptions));
app.use(express.static("build"));
app.use(
  session({
    // secret: "mysecret",
    secret: process.env.SESSION_SECRET || "miCadenaSecretaPorDefecto",
    // cookie: {
    //   maxAge: 1000 * 60 * 60 * 24, // 1 day
    // },
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

io.on("connection", (socket) => {
  socket.on("login", (userId) => {
    console.log(`User ${userId} logged in`);
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
      userId,
      comments,
      precioTotal,
      adelanto,
      nombre_recepcionista,
      montoPendiente,
      dni,
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
      isOverlapping,
      price,
      nights,
      comments,
      precioTotal,
      adelanto,
      nombre_recepcionista,
      montoPendiente,
      dni,
    });
    console.log(reservation);
    await reservation.save();
    const userSockets = connectedUsers.filter((user) => user.user === userId);

    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("reservationCreated", reservation);
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
  const { id } = req.params;
  const { userId, ...updatedData } = req.body;

  try {
    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    // Update the reservation with new data
    Object.assign(reservation, updateData);
    await reservation.save();

    const userSockets = connectedUsers.filter((user) => user.user === userId);

    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("reservationUpdated", reservation);
    });

    res.status(200).json({
      message: "Reservation updated successfully",
      reservation: reservation,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log("listening on *:8000");
});
module.exports.connectedUsers = connectedUsers;
