require('dotenv').config(); // Load environment variables from .env file

const express = require("express");
const { Server } = require("socket.io");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const mongoose = require("mongoose");
const http = require("http");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("./src/db");
const authRoutes = require("./src/routes/auth");
const reservationRoutes = require("./src/routes/reservations");
const Reservation = require("./src/models/Reservation");
const User = require("./src/models/User");
const bcrypt = require("bcrypt");
require('dotenv').config(); // Load environment variables from .env file
const app = express();
const server = http.createServer(app);
const drinkRoutes = require('./src/routes/drinks');
// const authRoutes = require('./routes/auth');
const paymentTotalsRoutes = require('./src/routes/paymentTotals');
const guestRoutes = require('./src/routes/guest');
const excelExportRoutes = require('./src/routes/excelExport');




// Other middleware and configurations...

// const io = new Server(server, {
//   cors: {
//     // origin: process.env.NODE_ENV === "production" 
//     // ? "https://hotelexpress.onrender.com" 
//     origin: process.env.REACT_APP_SOCKET_URL,
//     methods: ["GET", "POST", "PUT", "DELETE"],
//     credentials: true,
//     exposedHeaders: ['Content-Disposition']
//   },
// });


const io = new Server(server, {
  cors: {
    // origin: process.env.NODE_ENV === "production" 
    // ? "https://hotelexpress.onrender.com" 
    origin: process.env.REACT_APP_SOCKET_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});



// app.use('/excel', require('./routes/excelExport'));
const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

// MongoDB connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Session store configuration




// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));





// const corsOptions = {
//   origin: process.env.NODE_ENV === "production"
//     ? "https://hotelexpress.onrender.com"
//     : "http://localhost:3000",
//   methods: ["GET", "POST", "PUT", "DELETE"],
//   credentials: true,
// };
// app.use(cors(corsOptions));
// Store configuration

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === "production"
    ? "https://hotelexpress.onrender.com"
    : "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions',
  expires: 1000 * 60 * 60 * 24, // 1 día
  autoRemove: 'native'
});
app.use(session({
  // secret: process.env.SESSION_SECRET,
  // cookie: {
  //   maxAge: 1000 * 60 * 60 * 24, // 1 day
  //   httpOnly: true,
  //   secure: process.env.NODE_ENV === "production",
  //   sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
  // },
  secret: process.env.SESSION_SECRET,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    secure: true,
    sameSite: 'none',
    httpOnly: true
  },
  store: store,
  resave: false,
  saveUninitialized: false,
}));
// Headers adicionales para asegurar el funcionamiento en móviles
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
store.on("error", function (error) {
  console.log("Session store error:", error);
});
// Session middleware
// En index.js, modifica la configuración de la sesión:
// Configuración de sesión
// const sessionConfig = {
//   secret: SESSION_SECRET,
//   cookie: {
//     maxAge: 1000 * 60 * 60 * 24, // 1 día
//     httpOnly: true,
//     secure: false, // Cambiar a true si usas HTTPS
//     sameSite: 'lax'
//   },
//   name: 'sessionId', // Nombre personalizado para la cookie
//   store: store,
//   resave: true,     // Cambiado a true para asegurar que la sesión se guarde
//   saveUninitialized: false,
//   rolling: true     // Renueva el tiempo de expiración en cada request
// };

const sessionConfig = {
  secret: SESSION_SECRET,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 día
    httpOnly: true,
    // secure: true, // Ensure this is set to true in production
    // sameSite: 'lax' // or 'strict' depending on your use case
  },
  name: 'sessionId',
  store: store,
  resave: false,
  saveUninitialized: false,
  rolling: true
};

store.on('error', (error) => {
  console.error('Session store error:', error);
});

app.use(session(sessionConfig));
// Middleware para debug
app.use((req, res, next) => {
  console.log('Session debug:', {
    sessionID: req.sessionID,
    userId: req.session?.userId,
    cookie: req.session?.cookie
  });
  next();
});
// Headers adicionales para asegurar el funcionamiento en móviles
// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Credentials', 'true');
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
//   next();
// });
// app.use((req, res, next) => {
//   console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
//   next();
// });

// Rutas
// app.use('/excel', require('./src/routes/excelExport'));

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Routes
app.use('/auth', authRoutes);
// app.use("/reservations", reservationRoutes);
app.use("/excel", excelExportRoutes); // Una sola ruta para excel
app.use('/payment-totals', paymentTotalsRoutes);
app.use('/drinks', drinkRoutes);
app.use('/guests', guestRoutes);


// Socket.IO setup
const connectedUsers = [];

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log(`User connected with userId: ${userId}`);

  // Test event
  socket.emit("testEvent", { message: "Socket is working!" });

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


// Modifica el endpoint check-session:
app.get("/check-session", (req, res) => {
  console.log('Check session:', {
    sessionId: req.sessionID,
    session: req.session,
    userId: req.session?.userId
  });

  // Cambiamos la verificación para solo revisar el userId
  if (req.session && req.session.userId) {
    res.json({
      isLoggedIn: true,
      userId: req.session.userId
    });
  } else {
    console.log('No valid session found');
    res.json({ isLoggedIn: false });
  }
});
// app.use('/api/financial', financialRoutes);

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Login attempt for username:", username);

    const user = await User.findOne({ username });
    console.log("User found:", user ? "Yes" : "No");

    if (!user) {
      console.log("Login failed: User not found");
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password valid:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("Login failed: Invalid password");
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    req.session.userId = user._id.toString();
    console.log('Session after setting userId:', req.session);

    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
        return res.status(500).json({ message: "Error saving session" });
      }
      res.status(200).json({
        success: true,
        message: "Inicio de sesión exitoso",
        userId: user._id
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.use('/payment-totals', paymentTotalsRoutes);
app.use('/drinks', drinkRoutes);
app.use('/guests', guestRoutes); // This sets the base route for guests

app.get("/all", async (req, res) => {

  try {
    const userId = req.query.userId;



    if (userId !== req.query.userId.toString()) {
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

// En index.js - Corregir create-reservation
app.post("/create-reservation", async (req, res) => {
  try {
    const { reservationData } = req.body;
    const userId = req.query.userId;

    if (!reservationData) {
      return res.status(400).json({ message: "Reservation data is missing" });
    }

    // Procesar pagos y calcular totales
    const payments = reservationData.payments || [];
    const precioTotal = parseFloat(reservationData.precioTotal);
    let totalPaidSoFar = 0;

    // Agregar montoPendiente a cada pago
    const processedPayments = payments.map(payment => {
      const amount = parseFloat(payment.amount);
      totalPaidSoFar += amount;
      return {
        ...payment,
        amount,
        montoPendiente: precioTotal - totalPaidSoFar
      };
    });

    // Validar que el total pagado no exceda el precio total
    if (totalPaidSoFar > precioTotal) {
      return res.status(400).json({
        message: "El total de pagos no puede exceder el precio total"
      });
    }

    // Crear las reservas para cada habitación seleccionada
    const reservationBase = {
      ...reservationData,
      user: userId,
      payments: processedPayments,
      totalPaid: totalPaidSoFar,
      montoPendiente: precioTotal - totalPaidSoFar,
      price: parseFloat(reservationData.price),
      precioTotal: precioTotal,
      roomStatus: reservationData.roomStatus || 'disponible'
    };

    const reservations = Array.isArray(reservationData.room)
      ? reservationData.room.map(room => ({
        ...reservationBase,
        room
      }))
      : [{ ...reservationBase }];

    const createdReservations = await Reservation.insertMany(reservations);

    // Emitir eventos y responder
    const userSockets = connectedUsers.filter((user) => user.user === userId);
    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("reservationCreated", createdReservations);
    });

    await updateAndEmitPaymentMethodTotals(userId);

    res.status(200).json({
      message: "Reservations created successfully",
      reservations: createdReservations
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: error.message });
  }
});
// En index.js - Actualizar la ruta update-reservation
app.put("/update-reservation/:id", async (req, res) => {
  try {
    const reservationId = req.params.id;
    const {
      payments,
      precioTotal,
      newRooms,
      userId,
      ...otherData
    } = req.body;

    const parsedPrecioTotal = parseFloat(precioTotal);
    let totalPaidSoFar = 0;

    // Procesar pagos y agregar montoPendiente
    const processedPayments = payments?.map(payment => {
      const amount = parseFloat(payment.amount);
      totalPaidSoFar += amount;
      return {
        ...payment,
        amount,
        montoPendiente: parsedPrecioTotal - totalPaidSoFar
      };
    }) || [];

    if (totalPaidSoFar > parsedPrecioTotal) {
      return res.status(400).json({
        message: "El total de pagos no puede exceder el precio total"
      });
    }

    const updateData = {
      ...otherData,
      payments: processedPayments,
      precioTotal: parsedPrecioTotal,
      totalPaid: totalPaidSoFar,
      montoPendiente: parsedPrecioTotal - totalPaidSoFar
    };

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    let allUpdatedReservations = [updatedReservation];

    // Procesar nuevas habitaciones si existen
    if (Array.isArray(newRooms) && newRooms.length > 0) {
      const newReservations = await Promise.all(newRooms.map(async (room) => {
        const newReservation = new Reservation({
          ...updatedReservation.toObject(),
          _id: undefined,
          room: room,
        });
        return await newReservation.save();
      }));
      allUpdatedReservations = [...allUpdatedReservations, ...newReservations];
    }

    await updateAndEmitPaymentMethodTotals(userId);

    const userSockets = connectedUsers.filter((user) => user.user === userId);
    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("updateReservation", allUpdatedReservations);
    });

    res.status(200).json({
      message: "Reservations updated successfully",
      reservations: allUpdatedReservations,
    });
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ error: error.message });
  }
});




app.delete("/delete-reservation/:id", async (req, res) => {
  try {
    const reservationId = req.params.id;
    const userId = req.query.userId;


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


app.get("/reservations-by-date-range", async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;

    // Validate input
    if (!startDate || !endDate || !userId) {
      return res.status(400).json({ message: "Start date, end date, and userId are required" });
    }

    // Convert string dates to Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate date range
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    // Query the database for reservations within the date range
    const reservations = await Reservation.find({
      user: userId,
      $or: [
        { start: { $gte: start, $lte: end } },
        { end: { $gte: start, $lte: end } },
        { $and: [{ start: { $lte: start } }, { end: { $gte: end } }] }
      ]
    }).sort({ start: 1 });

    res.status(200).json({
      message: "Reservations retrieved successfully",
      reservations: reservations
    });

  } catch (error) {
    console.error("Error in /reservations-by-date-range route:", error);
    res.status(500).json({ error: error.message });
  }
});


app.put("/edit-reservation/:id", async (req, res) => {
  try {
    const reservationId = req.params.id;
    const userId = req.query.userId;
    const updatedData = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const updatedReservation = await Reservation.findOneAndUpdate(
      { _id: reservationId, user: userId },
      updatedData,
      { new: true }
    );

    if (!updatedReservation) {
      return res.status(404).json({ message: "Reservation not found or user not authorized" });
    }

    res.status(200).json({
      message: "Reservation updated successfully",
      reservation: updatedReservation
    });

  } catch (error) {
    console.error("Error in /edit-reservation route:", error);
    res.status(500).json({ error: error.message });
  }
});
// En el backend (index.js), añadir nuevo endpoint:
// app.put("/undo-reservation/:id", async (req, res) => {
//   try {
//     const { id, oldPosition } = req.body;
//     const userId = req.query.userId;

//     const updatedReservation = await Reservation.findByIdAndUpdate(
//       id,
//       {
//         start: oldPosition.start,
//         end: oldPosition.end,
//         room: oldPosition.room
//       },
//       { new: true }
//     );

//     const userSockets = connectedUsers.filter((user) => user.user === userId);
//     userSockets.forEach((userSocket) => {
//       io.to(userSocket.socketId).emit("updateReservation", [updatedReservation]);
//     });

//     res.status(200).json({ message: "Undo successful", reservation: updatedReservation });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });
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
app.get("/search-reservations", async (req, res) => {
  try {
    const { userId, searchTerm } = req.query;

    if (!userId) {
      return res.status(401).json({ message: "Debe iniciar sesión para buscar reservas" });
    }

    const query = {
      user: userId,
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { dni: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } }
      ]
    };

    const reservations = await Reservation.find(query)
      .sort({ start: -1 })
      .limit(10)
      .select('name surname dni room start end price roomType billingStatus');

    res.status(200).json({ reservations });
  } catch (error) {
    console.error('Error en búsqueda de reservaciones:', error);
    res.status(500).json({ message: 'Error al buscar reservaciones' });
  }
});

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
app._router.stack.forEach(function (r) {
  if (r.route && r.route.path) {
    console.log(r.route.path)
  }
});