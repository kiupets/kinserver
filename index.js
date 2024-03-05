// const express = require("express");
// const { Server } = require("socket.io");
// // const connectedUsers = require("./src/connectedUsers");
// const router = express.Router();
// const session = require("express-session");
// const MongoDBStore = require("connect-mongodb-session")(session);
// require("./src/db");
// const authRoutes = require("./src/routes/auth");
// const reservationRoutes = require("./src/routes/reservations");
// const Reservation = require("./src/models/Reservation");
// const http = require("http");
// const User = require("./src/models/User");
// const uuid = require("uuid");
// const app = express();
// const PORT = process.env.PORT || 8000;
// const connectedUsers = {};
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// const cors = require("cors");

// const corsOptions = {
//   origin: "http://localhost:3000",
//   methods: ["GET", "POST", "OPTIONS"], // Permitir los métodos GET, POST y OPTIONS
//   credentials: true, // Permitir el intercambio de cookies a través de dominios
// };
// const server = http.createServer(app);
// const store = new MongoDBStore({
//   uri: "mongodb+srv://kiupets:julietaygonzalo2023@cluster0.cpgytzo.mongodb.net/db-name?retryWrites=true&w=majority", // Cambiar esta URL según tu configuración
//   collection: "mySessions",
// });
// const io = new Server(server, {
//   cors: { origin: "*", methods: ["GET", "POST"] },
// });
// // Initialize Socket.IO session middleware

// app.use(cors(corsOptions));
// app.use(express.static("build"));
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     store: store,
//   })
// );

// io.on("connection", (socket) => {
//   // console.log(`a user connected ${socket.id}`);

//   socket.on("login", (userId) => {
//     console.log(`User ${userId} logged in`);
//     if (!connectedUsers[userId]) {
//       connectedUsers[userId] = socket.id;
//     } else if (connectedUsers[userId] !== socket.id) {
//       // Update socket ID if the user is already connected with a different socket
//       connectedUsers[userId] = socket.id;
//       console.log(`User ${userId} reconnected with new socket.`);
//     }
//   });
//   socket.on("disconnect", () => {
//     // console.log(`User ${socket.id} disconnected`);
//     // // Eliminar la entrada del usuario desconectado
//     const userIdDis = Object.keys(connectedUsers).find(
//       (key) => connectedUsers[key] === socket.id
//     );
//     if (userIdDis) {
//       delete connectedUsers[userIdDis];
//     }
//   });
// });
// app.use("/auth", authRoutes);
// app.use("/reservations", reservationRoutes);

// app.post("/create-reservation", async (req, res) => {
//   try {
//     const userId = req.session.userId; // Obtener el ID del usuario desde la sesión
//     // console.log(userId);
//     if (!userId) {
//       return res
//         .status(401)
//         .json({ message: "Debe iniciar sesión para hacer una reserva" });
//     }

//     // Extraer datos de la solicitud
//     const { name, email, phone, room, start, end, price, nights } = req.body;

//     // Generar un nuevo ID para la reserva
//     const id = uuid.v4();

//     // Crear una nueva instancia de Reservation
//     const reservation = new Reservation({
//       id,
//       user: userId,
//       name,
//       email,
//       phone,
//       room,
//       start,
//       end,
//       price,
//       nights,
//     });

//     // Guardar la reserva en la base de datos
//     await reservation.save();

//     const socket = connectedUsers[userId];

//     if (socket) {
//       // Enviar el evento con la reserva al usuario
//       io.to(socket).emit("reservationCreated", reservation);
//     } else {
//       console.log("Socket not found for user:", userId);
//     }

//     res
//       .status(201)
//       .json({ message: "Reserva creada exitosamente.", reservation });
//   } catch (error) {
//     // Manejar errores
//     res.status(500).json({ error: error.message });
//   }
// });

// server.listen(PORT, () => {
//   console.log("listening on *:8000");
// });
// // module.exports.connectedUsers = connectedUsers;
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
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
};
const server = http.createServer(app);

const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: "mySessions",
});
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors(corsOptions));
app.use(express.static("build"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "miCadenaSecretaPorDefecto",
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
    // const userId = req.session.userId;

    const { name, email, phone, room, start, end, price, nights, userId } =
      req.body;
    if (!userId) {
      return res
        .status(401)
        .json({ message: "Debe iniciar sesión para hacer una reserva" });
    }
    // console.log(userId);
    const id = uuid.v4();

    const reservation = new Reservation({
      id,
      user: userId,
      name,
      email,
      phone,
      room,
      start,
      end,
      price,
      nights,
    });

    await reservation.save();

    console.log(connectedUsers);
    console.log(userId);
    const userSockets = connectedUsers.filter((user) => user.user === userId);
    console.log(userSockets);
    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("reservationCreated", reservation);
    });

    res
      .status(201)
      .json({ message: "Reserva creada exitosamente.", reservation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log("listening on *:8000");
});
module.exports.connectedUsers = connectedUsers;
