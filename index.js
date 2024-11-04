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
const io = new Server(server, {
  cors: {
    // origin: process.env.NODE_ENV === "production" 
    // ? "https://hotelexpress.onrender.com" 
    origin: process.env.REACT_APP_SOCKET_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

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
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions",
  expires: 1000 * 60 * 60 * 24, // 1 day
});

store.on("error", function (error) {
  console.log("Session store error:", error);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
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

// Routes
app.use("/auth", authRoutes);
app.use("/reservations", reservationRoutes);

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


app.get("/check-session", (req, res) => {
  console.log("ssssssssssseeeeeeeeessssssssssssssiiiiiiioooon:", req.session, req.session.userId)
  if (req.session && req.session.userId) {
    res.json({ isLoggedIn: true, userId: req.session.userId });
  } else {
    res.json({ isLoggedIn: false });
  }
});


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


app.get("/all", async (req, res) => {
  console.log("session from /all", req.session, req.session.userId)
  try {
    const userId = req.query.userId;
    console.log("from /all what is req.session and req.session.userId", req.session, req.query.userId)
    // if (!req.session || !req.session.userId) {
    //   return res.status(401).json({ message: "Debe iniciar sesión para ver las reservas" });
    // }

    if (userId !== req.query.userId.toString()) {
      return res.status(403).json({ message: "Usuario no autorizado" });
    }

    const userReservations = await Reservation.find({ user: userId });

    res.status(200).json({ userReservations });
    console.log("connectedUsers in /all:", connectedUsers)
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

    // if (!req.session || !req.session.userId) {
    //   return res.status(401).json({ message: "Debe iniciar sesión para hacer una reserva" });
    // }

    if (userId !== req.query.userId.toString()) {
      return res.status(403).json({ message: "Usuario no autorizado" });
    }

    const reservations = Array.isArray(reservationData.room)
      ? reservationData.room.map(room => ({
        ...reservationData,
        room,
        user: req.query.userId
      }))
      : [{ ...reservationData, user: req.query.userId }];

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
      // isDragging,
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

    // if (!req.session || !req.session.userId) {
    //   return res.status(401).json({ message: "Debe iniciar sesión para actualizar una reserva" });
    // }

    // if (userId !== req.session.userId.toString()) {
    //   return res.status(403).json({ message: "Usuario no autorizado" });
    // }

    const existingReservation = await Reservation.findById(reservationId);
    if (!existingReservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      {
        // isDragging,
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
    let allUpdatedReservations = [updatedReservation];
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
    res.status(500).json({ error: error.message });
  }
});



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

app.delete("/delete-reservation/:id", async (req, res) => {
  try {
    const reservationId = req.params.id;
    const userId = req.query.userId;

    // if (!req.session || !req.session.userId) {
    //   return res.status(401).json({ message: "Debe iniciar sesión para eliminar una reserva" });
    // }

    // if (userId !== req.session.userId.toString()) {
    //   return res.status(403).json({ message: "Usuario no autorizado" });
    // }

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
