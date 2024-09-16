// const express = require("express");
// const { Server } = require("socket.io");
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
// const path = require("path"); // Import path module
// const app = express();
// const PORT = process.env.PORT || 8000;
// const mongoose = require("mongoose");
// const connectedUsers = [];
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// const xlsx = require("xlsx");
// const cors = require("cors");

// const corsOptions = {
//   origin: process.env.NODE_ENV === "production" 
//     ? "https://hotelexpress.onrender.com" // Production URL
//     : "http://localhost:3000", // Local development URL
//   methods: ["GET", "POST", "PUT", "DELETE"],
//   credentials: true,
// };
// const server = http.createServer(app);

// const store = new MongoDBStore({
//   uri: process.env.MONGODB_URI,
//   collection: "mySessions",
// });
// store.on('error', function(error) {
//   console.log(error);
// });
// const io = new Server(server, {
//   cors: {
//     origin: process.env.NODE_ENV === "production" 
//       ? "https://hotelexpress.onrender.com" // Production URL
//       : "http://localhost:3000", // Local development URL
//     credentials: true,
//   },
// });

// app.use(cors(corsOptions));
// app.use(express.static("build"));
// app.use(session({
//   secret: process.env.SESSION_SECRET || "your-default-secret",
//   cookie: {
//     maxAge: 1000 * 60 * 60 * 24, // 1 day
//     httpOnly: true,
//     secure: false, // Change this to false temporarily
//     sameSite: 'none', // Change this to 'none' temporarily
//   },
//   resave: false,
//   saveUninitialized: false,
//   store: store,
// }));

// app.use((req, res, next) => {
//   console.log('Session Middleware - Session:', req.session);
//   console.log('Session Middleware - SessionID:', req.sessionID);
//   next();
// });

// io.on("connection", (socket) => {
//   const userId = socket.handshake.query.userId;
//   console.log("userId from connection: : ,  ",userId)
//   console.log(`User connected with userId: ${userId}`);

//   // Verifica si el usuario ya está en la lista de usuarios conectados
//   const existingUserIndex = connectedUsers.findIndex(
//     (user) => user.user === userId
//   );
//   if (existingUserIndex === -1) {
//     // Si el usuario no está presente, crea una nueva entrada en el array
//     connectedUsers.push({ user: userId, socketId: [socket.id] });
//   } else {
//     // Si el usuario ya está presente, verifica si el socket ya existe
//     if (!connectedUsers[existingUserIndex].socketId.includes(socket.id)) {
//       // Agrega el nuevo socket solo si no existe en la lista de sockets del usuario
//       connectedUsers[existingUserIndex].socketId.push(socket.id);
//       console.log(`User ${userId} reconnected with new socket.`);
//     } else {
//       console.log(`Socket ${socket.id} already exists for user ${userId}.`);
//     }
//   }

//   socket.on("disconnect", () => {
//     // Recorre la lista de usuarios conectados
//     for (let i = 0; i < connectedUsers.length; i++) {
//       const user = connectedUsers[i];
//       const index = user.socketId.indexOf(socket.id);
//       // Si se encuentra el socket en la lista de sockets del usuario, elimínalo
//       if (index !== -1) {
//         user.socketId.splice(index, 1);
//         // Si el usuario ya no tiene más sockets activos, elimina toda la entrada del usuario
//         if (user.socketId.length === 0) {
//           connectedUsers.splice(i, 1);
//         }
//         break; // No es necesario seguir buscando en otros usuarios
//       }
//     }
//   });
// });
// const authenticateUser = (req, res, next) => {
//   if (req.session && req.session.userId) {
//     if (req.session.userId !== req.query.userId) {
//       return res.status(403).json({ message: "Unauthorized access" });
//     }
//     next();
//   } else {
//     res.status(401).json({ message: "Debe iniciar sesión para hacer una reserva" });
//   }
// };
// if (process.env.NODE_ENV === "production") {
//   // Production-specific logic
//   console.log("proproproduction")
// } else {
//   // Development-specific logic
// }
// app.use("/auth", authRoutes);


// app.use("/reservations", reservationRoutes);
// // Add this route before your other route definitions
// app.get('/check-session', (req, res) => {
//   console.log('Session:', req.session);
//   if (req.session && req.session.userId) {
//     res.json({ isLoggedIn: true, userId: req.session.userId });
//   } else {
//     res.json({ isLoggedIn: false });
//   }
// });
// app.get("/all", async (req, res) => {
//   console.log('Session:', req.session);
//   console.log('Session ID:', req.sessionID);
//   console.log('Cookies:', req.cookies);
//   console.log('Signed Cookies:', req.signedCookies);
  
//   try {
//     const userId = req.query.userId;
//     console.log("userId:", userId, "sessionId:", req.sessionID, "queryId:", req.query.userId);
    
//     // Check if the user is logged in
//     if (!req.session || !req.session.userId) {
//       console.log("No active session found");
//       return res.status(401).json({ message: "Debe iniciar sesión para ver las reservas" });
//     }
   
//     // Verify that the userId matches the one in the session
//     if (userId !== req.session.userId.toString()) {
//       console.log('Session userId:', req.session.userId, 'Request userId:', userId);
//       return res.status(403).json({ message: "Usuario no autorizado" });
//     }

//     const userReservations = await Reservation.find({ user: userId });
//     console.log("Reservations found:", userReservations.length);

//     res.status(200).json({ userReservations });

//     const userSockets = connectedUsers.filter((user) => user.user === userId);
//     console.log("Connected sockets for user:", userSockets.length);

//     userSockets.forEach((userSocket) => {
//       io.to(userSocket.socketId).emit("allReservations", { userReservations });
//     });
//   } catch (error) {
//     console.error("Error in /all route:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post("/create-reservation", async (req, res) => {
//   console.log('Session:', req.session);
//   try {
//     const { reservationData } = req.body;
//     const userId = req.query.userId;
//     console.log(reservationData, userId);

//     if (!reservationData) {
//       return res.status(400).json({ message: "Reservation data is missing" });
//     }

//     // Check if the user is logged in
//     if (!req.session || !req.session.userId) {
//       return res.status(401).json({ message: "Debe iniciar sesión para hacer una reserva" });
//     }

//     // Verify that the userId matches the one in the session
//     if (userId !== req.session.userId.toString()) {
//       console.log('Session userId:', req.session.userId, 'Request userId:', userId);
//       return res.status(403).json({ message: "Usuario no autorizado" });
//     }

//     // Modify this part to handle multiple rooms
//     const reservations = Array.isArray(reservationData.room) 
//       ? reservationData.room.map(room => ({
//           ...reservationData,
//           room,
//           user: req.session.userId
//         }))
//       : [{ ...reservationData, user: req.session.userId }];

//     const createdReservations = await Reservation.insertMany(reservations);

//     // Emit the new reservations to connected clients
//     const userSockets = connectedUsers.filter((user) => user.user === userId);
//     userSockets.forEach((userSocket) => {
//       io.to(userSocket.socketId).emit("reservationCreated", createdReservations);
//     });

//     res.status(200).json({ message: "Reservations created successfully", reservations: createdReservations });
//   } catch (error) {
//     console.error('Error creating reservation:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.put("/update-reservation/:id", async (req, res) => {
//   try {
//     const reservationId = req.params.id;
//     const {
//       name,
//       email,
//       phone,
//       rooms,
//       newRooms,
//       start,
//       end,
//       isOverlapping,
//       price,
//       nights,
//       comments,
//       precioTotal,
//       adelanto,
//       time,
//       montoPendiente,
//       dni,
//       paymentMethod,
//       numberOfGuests,
//       guestNames,
//       roomType,
//       isBooking,
//       surname,
//       billingStatus,
//       housekeepingStatus,
//       userId,
//       nombre_recepcionista,
//     } = req.body;

//     // Check if the user is logged in
//     if (!req.session || !req.session.userId) {
//       return res.status(401).json({ message: "Debe iniciar sesión para actualizar una reserva" });
//     }

//     // Verify that the userId matches the one in the session
//     if (userId !== req.session.userId.toString()) {
//       console.log('Session userId:', req.session.userId, 'Request userId:', userId);
//       return res.status(403).json({ message: "Usuario no autorizado" });
//     }

//     const existingReservation = await Reservation.findById(reservationId);
//     if (!existingReservation) {
//       return res.status(404).json({ message: "Reservation not found" });
//     }

//     // Update existing reservation
//     const updatedReservation = await Reservation.findByIdAndUpdate(
//       reservationId,
//       {
//         user: userId,
//         name,
//         email,
//         phone,
//         room: rooms,
//         start,
//         end,
//         time,
//         isOverlapping,
//         comments,
//         adelanto,
//         nombre_recepcionista,
//         montoPendiente,
//         dni,
//         paymentMethod,
//         numberOfGuests,
//         guestNames,
//         roomType,
//         isBooking,
//         surname,
//         billingStatus,
//         housekeepingStatus,
//         price: parseFloat(price),
//         nights: parseInt(nights),
//         precioTotal: parseFloat(precioTotal),
//       },
//       { new: true }
//     );

//     // Create new reservations for added rooms
//     const newReservations = await Promise.all(newRooms.map(async (room) => {
//       const newReservation = new Reservation({
//         ...updatedReservation.toObject(),
//         _id: undefined,
//         room: room,
//       });
//       return await newReservation.save();
//     }));

//     await updateAndEmitPaymentMethodTotals(userId);

//     const allUpdatedReservations = [updatedReservation, ...newReservations];

//     const userSockets = connectedUsers.filter((user) => user.user === userId);

//     userSockets.forEach((userSocket) => {
//       io.to(userSocket.socketId).emit("updateReservation", allUpdatedReservations);
//     });

//     res.status(200).json({
//       message: "Reservations updated successfully",
//       reservations: allUpdatedReservations,
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.delete("/delete-reservation/:id", async (req, res) => {
//   try {
//     const reservationId = req.params.id;
//     const userId = req.query.userId;

//     // Check if the user is logged in
//     if (!req.session || !req.session.userId) {
//       return res.status(401).json({ message: "Debe iniciar sesión para eliminar una reserva" });
//     }

//     // Verify that the userId matches the one in the session
//     if (userId !== req.session.userId.toString()) {
//       console.log('Session userId:', req.session.userId, 'Request userId:', userId);
//       return res.status(403).json({ message: "Usuario no autorizado" });
//     }

//     const deletedReservation = await Reservation.findByIdAndDelete(reservationId);
//     await updateAndEmitPaymentMethodTotals(userId);
    
//     if (!deletedReservation) {
//       return res.status(404).json({ message: "Reservation not found" });
//     }

//     const userSockets = connectedUsers.filter((user) => user.user === userId);

//     userSockets.forEach((userSocket) => {
//       io.to(userSocket.socketId).emit("deleteReservation", {
//         id: reservationId,
//       });
//     });

//     res.status(200).json({
//       message: "Reservation deleted successfully",
//       reservation: {
//         id: reservationId,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get("/total-sales/:month", async (req, res) => {
//   try {
//     const { month } = req.params;
//     const targetMonth = parseInt(month); // Convert month to a number

//     const totalSales = await Reservation.aggregate([
//       {
//         $match: {
//           $expr: {
//             $eq: [{ $month: "$start" }, targetMonth], // Filter by month (e.g., July - month number 7)
//           },
//         },
//       },
//       {
//         $group: {
//           _id: null,
//           totalAmount: { $sum: { $toDouble: "$precioTotal" } },
//         },
//       },
//     ]);

//     res.status(200).json({
//       totalSales: totalSales.length > 0 ? totalSales[0].totalAmount : 0,
//     });
//   } catch (error) {
//     console.error("Error calculating total sales:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get("/payment-method-totals/:month", async (req, res) => {
//   try {
//     const { month } = req.params;
//     const { userId } = req.query;
//     const targetMonth = parseInt(month);

//     const paymentMethodTotals = await Reservation.aggregate([
//       {
//         $match: {
//           $expr: {
//             $eq: [{ $month: "$start" }, targetMonth],
//           },
//           user: new mongoose.Types.ObjectId(userId),
//         },
//       },
//       {
//         $group: {
//           _id: "$paymentMethod",
//           total: { $sum: { $toDouble: "$precioTotal" } },
//         },
//       },
//     ]);

//     const result = {
//       efectivo: 0,
//       tarjeta: 0,
//       deposito: 0,
//     };

//     paymentMethodTotals.forEach((item) => {
//       if (item._id in result) {
//         result[item._id] = item.total;
//       }
//     });

//     res.status(200).json({
//       message: "Payment method totals calculated successfully",
//       totals: result,
//     });
//   } catch (error) {
//     console.error("Error calculating payment method totals:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// const cellStyles = {
//   fecha: { fill: { fgColor: { rgb: "FFFF00" } } }, // Amarillo
//   nombre: { fill: { fgColor: { rgb: "00FF00" } } }, // Verde
//   pago: { fill: { fgColor: { rgb: "0000FF" } } }, // Azul
//   estadia: { fill: { fgColor: { rgb: "FF00FF" } } }, // Magenta
//   habitacion: { fill: { fgColor: { rgb: "00FFFF" } } }, // Cian
//   efectivo: { fill: { fgColor: { rgb: "FF0000" } } }, // Rojo
//   tarjeta: { fill: { fgColor: { rgb: "FFA500" } } }, // Naranja
//   transferencia: { fill: { fgColor: { rgb: "800080" } } }, // Púrpura
// };
// app.get("/export-excel", async (req, res) => {
//   try {
//     // Obtener todas las reservas de la base de datos
//     const reservations = await Reservation.find({});

//     // Crear un nuevo libro de Excel
//     const workbook = xlsx.utils.book_new();
//     // Definir los estilos de celda
//     const cellStyles = {
//       fecha: { fill: { fgColor: { rgb: "FFFF00" } } }, // Amarillo
//       nombre: { fill: { fgColor: { rgb: "00FF00" } } }, // Verde
//       pago: { fill: { fgColor: { rgb: "0000FF" } } }, // Azul
//       estadia: { fill: { fgColor: { rgb: "FF00FF" } } }, // Magenta
//       habitacion: { fill: { fgColor: { rgb: "00FFFF" } } }, // Cian
//       efectivo: { fill: { fgColor: { rgb: "FF0000" } } }, // Rojo
//       tarjeta: { fill: { fgColor: { rgb: "FFA500" } } }, // Naranja
//       transferencia: { fill: { fgColor: { rgb: "800080" } } }, // Púrpura
//     };
//     // Crear una nueva hoja en el libro
//     // Crear una nueva hoja en el libro

//     const worksheet = xlsx.utils.json_to_sheet([
//       [
//         "fecha",
//         "nombre",
//         "pago",
//         "estadia",
//         "habitacion",
//         "efectivo",
//         "tarjeta",
//         "transferencia",
//       ],
//     ]);

//     // Aplicar los estilos a las celdas del encabezado
//     Object.keys(cellStyles).forEach((key, index) => {
//       const cellAddress = xlsx.utils.encode_cell({ c: index, r: 0 });
//       worksheet[cellAddress].s = {
//         ...worksheet[cellAddress].s,
//         ...cellStyles[key],
//       };
//     });

//     // Agregar los datos de las reservas al worksheet
//     const data = reservations.map((reservation) => ({
//       fecha: reservation.start,
//       nombre: `${reservation.name} ${reservation.surname}`,
//       pago: reservation.paymentMethod,
//       estadia: reservation.nights,
//       habitacion: reservation.room,
//       efectivo:
//         reservation.paymentMethod === "efectivo" ? reservation.precioTotal : 0,
//       tarjeta:
//         reservation.paymentMethod === "tarjeta" ? reservation.precioTotal : 0,
//       transferencia:
//         reservation.paymentMethod === "deposito" ? reservation.precioTotal : 0,
//     }));

//     xlsx.utils.sheet_add_json(worksheet, data, { origin: "A2" });

//     // Ajustar el ancho de las columnas
//     worksheet["!cols"] = [
//       { wch: 20 }, // Fecha
//       { wch: 30 }, // Nombre
//       { wch: 10 }, // Pago
//       { wch: 10 }, // Estadia
//       { wch: 10 }, // Habitación
//       { wch: 10 }, // Efectivo
//       { wch: 10 }, // Tarjeta
//       { wch: 10 }, // Transferencia
//     ];

//     // Aplicar los estilos a las celdas
//     // Aplicar los estilos a las celdas
//     Object.keys(cellStyles).forEach((key, index) => {
//       const cellAddress = xlsx.utils.encode_cell({ c: index, r: 0 });
//       if (worksheet[cellAddress]) {
//         worksheet[cellAddress].s = {
//           ...worksheet[cellAddress].s,
//           ...cellStyles[key],
//         };
//       }
//     });

//     // Agregar el worksheet al libro
//     xlsx.utils.book_append_sheet(workbook, worksheet, "Reservas");

//     // Generar el archivo Excel
//     const excelBuffer = xlsx.write(workbook, {
//       type: "buffer",
//       bookType: "xlsx",
//     });

//     // Enviar el archivo Excel como respuesta
//     res.set(
//       "Content-Type",
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//     );
//     res.set("Content-Disposition", "attachment; filename=reservas.xlsx");
//     res.send(excelBuffer);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });
// async function updateAndEmitPaymentMethodTotals(userId) {
//   const currentDate = new Date();
//   const currentMonth = currentDate.getMonth() + 1;

//   const paymentMethodTotals = await Reservation.aggregate([
//     {
//       $match: {
//         $expr: {
//           $eq: [{ $month: "$start" }, currentMonth],
//         },
//         user: new mongoose.Types.ObjectId(userId),
//       },
//     },
//     {
//       $group: {
//         _id: "$paymentMethod",
//         total: { $sum: { $toDouble: "$precioTotal" } },
//       },
//     },
//   ]);

//   const result = {
//     efectivo: 0,
//     tarjeta: 0,
//     deposito: 0,
//   };

//   paymentMethodTotals.forEach((item) => {
//     if (item._id in result) {
//       result[item._id] = item.total;
//     }
//   });

//   const userSockets = connectedUsers.filter((user) => user.user === userId);
//   userSockets.forEach((userSocket) => {
//     io.to(userSocket.socketId).emit("paymentMethodTotalsUpdated", {
//       userId: userId,
//       totals: result,
//     });
//   });
// }



// // Make sure this is at the end of your route definitions
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'build', 'index.html')); // Use path to resolve the file
// });

// server.listen(PORT, () => {
//   console.log("listening on *:8000");
// });
// module.exports.connectedUsers = connectedUsers;
const express = require("express");
const { Server } = require("socket.io");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const mongoose = require("mongoose");
const http = require("http");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken") ;
require("dotenv").config();
require("./src/db");
const authRoutes = require("./src/routes/auth");
const reservationRoutes = require("./src/routes/reservations");
const Reservation = require("./src/models/Reservation");
const User = require("./src/models/User");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET 
const JWT_SECRET = process.env.JWT_SECRET 

// MongoDB connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Session store configuration
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions",
  expires: 1000 * 60 * 60 * 24, // 1 day
});

store.on("error", function(error) {
  console.log("Session store error:", error);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
// const corsOptions = {
//   origin: process.env.NODE_ENV === "production" 
//     ? "https://hotelexpress.onrender.com" 
//     : "http://localhost:3000",
//   methods: ["GET", "POST", "PUT", "DELETE"],
//   credentials: true,
// };
const corsOptions = {
  origin: process.env.NODE_ENV === "production" 
    ? "https://hotelexpress.onrender.com" 
    : "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));

// Session middleware
app.use(session({
  secret: SESSION_SECRET,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
  },
  store: store,
  resave: false,
  saveUninitialized: false,
}));
// app.use(session({
//   secret: SESSION_SECRET,
//   cookie: {
//     maxAge: 1000 * 60 * 60 * 24, // 1 day
//     secure: 'false',
//     sameSite: 'none',
//   },
//   store: store,
//   resave: false,
//   saveUninitialized: false,
// }));

// JWT verification middleware
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return next(); // Continue without token
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Apply verifyToken middleware to all routes
app.use(verifyToken);

// Routes
app.use("/auth", authRoutes);
app.use("/reservations", reservationRoutes);

// Socket.io setup
const connectedUsers = [];

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log(`User connected with userId: ${userId}`);

  const existingUserIndex = connectedUsers.findIndex(
    (user) => user.user === userId
  );
  if (existingUserIndex === -1) {
    connectedUsers.push({ user: userId, socketId: [socket.id] });
  } else {
    if (!connectedUsers[existingUserIndex].socketId.includes(socket.id)) {
      connectedUsers[existingUserIndex].socketId.push(socket.id);
    }
  }

  socket.on("disconnect", () => {
    for (let i = 0; i < connectedUsers.length; i++) {
      const user = connectedUsers[i];
      const index = user.socketId.indexOf(socket.id);
      if (index !== -1) {
        user.socketId.splice(index, 1);
        if (user.socketId.length === 0) {
          connectedUsers.splice(i, 1);
        }
        break;
      }
    }
  });
});

// API routes


app.get("/check-session", (req, res) => {
  console.log("ssssssssssseeeeeeeeessssssssssssssiiiiiiioooon:",req.session, req.session.userId)
  if (req.session && req.session.userId) {
    res.json({ isLoggedIn: true, userId: req.session.userId });
  } else {
    res.json({ isLoggedIn: false });
  }
});
const authenticateUser = (req, res, next) => {
  console.log("authenticateUser:", req.session , req.session.userId)
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
};
app.get("/all", async (req, res) => {
  console.log("session from /all",req.session)
  try {
    const userId = req.query.userId;
    
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Debe iniciar sesión para ver las reservas" });
    }
   
    if (userId !== req.session.userId.toString()) {
      return res.status(403).json({ message: "Usuario no autorizado" });
    }

    const userReservations = await Reservation.find({ user: userId });

    res.status(200).json({ userReservations });

    const userSockets = connectedUsers.filter((user) => user.user === userId);
    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("allReservations", { userReservations });
    });
  } catch (error) {
    console.error("Error in /all route:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/create-reservation", async (req, res) => {
  try {
    const { reservationData } = req.body;
    const userId = req.query.userId;

    if (!reservationData) {
      return res.status(400).json({ message: "Reservation data is missing" });
    }

    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Debe iniciar sesión para hacer una reserva" });
    }

    if (userId !== req.session.userId.toString()) {
      return res.status(403).json({ message: "Usuario no autorizado" });
    }

    const reservations = Array.isArray(reservationData.room) 
      ? reservationData.room.map(room => ({
          ...reservationData,
          room,
          user: req.session.userId
        }))
      : [{ ...reservationData, user: req.session.userId }];

    const createdReservations = await Reservation.insertMany(reservations);

    const userSockets = connectedUsers.filter((user) => user.user === userId);
    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("reservationCreated", createdReservations);
    });

    res.status(200).json({ message: "Reservations created successfully", reservations: createdReservations });
  } catch (error) {
    console.error('Error creating reservation:', error);
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
      rooms,
      newRooms,
      start,
      end,
      isOverlapping,
      price,
      nights,
      comments,
      precioTotal,
      adelanto,
      time,
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
      userId,
      nombre_recepcionista,
    } = req.body;

    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Debe iniciar sesión para actualizar una reserva" });
    }

    if (userId !== req.session.userId.toString()) {
      return res.status(403).json({ message: "Usuario no autorizado" });
    }

    const existingReservation = await Reservation.findById(reservationId);
    if (!existingReservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      {
        user: userId,
        name,
        email,
        phone,
        room: rooms,
        start,
        end,
        time,
        isOverlapping,
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
        price: parseFloat(price),
        nights: parseInt(nights),
        precioTotal: parseFloat(precioTotal),
      },
      { new: true }
    );

    const newReservations = await Promise.all(newRooms.map(async (room) => {
      const newReservation = new Reservation({
        ...updatedReservation.toObject(),
        _id: undefined,
        room: room,
      });
      return await newReservation.save();
    }));

    await updateAndEmitPaymentMethodTotals(userId);

    const allUpdatedReservations = [updatedReservation, ...newReservations];

    const userSockets = connectedUsers.filter((user) => user.user === userId);

    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("updateReservation", allUpdatedReservations);
    });

    res.status(200).json({
      message: "Reservations updated successfully",
      reservations: allUpdatedReservations,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/delete-reservation/:id", async (req, res) => {
  try {
    const reservationId = req.params.id;
    const userId = req.query.userId;

    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: "Debe iniciar sesión para eliminar una reserva" });
    }

    if (userId !== req.session.userId.toString()) {
      return res.status(403).json({ message: "Usuario no autorizado" });
    }

    const deletedReservation = await Reservation.findByIdAndDelete(reservationId);
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

// Helper function to update and emit payment method totals
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

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'build')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// module.exports = { app, io, connectedUsers };