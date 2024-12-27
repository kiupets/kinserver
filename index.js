// At the top of your index.js
if (process.env.NODE_ENV === 'production') {
  const options = {
    maxOldSpaceSize: 460,
    optimization: {
      minimize: true
    }
  };
  require('v8').setFlagsFromString('--max-old-space-size=460');
}

require('dotenv').config();

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
const app = express();
const server = http.createServer(app);
const drinkRoutes = require('./src/routes/drinks');
const paymentTotalsRoutes = require('./src/routes/paymentTotals');
const guestRoutes = require('./src/routes/guest');
const excelExportRoutes = require('./src/routes/excelExport');
const gananciasSaveRouter = require('./src/routes/gananciasSave');
const gananciasExportRouter = require('./src/routes/gananciasExport');
const TensorFlowAgent = require('./src/agents/TensorFlowAgent');
const tfAgent = new TensorFlowAgent();

// Variables globales
const connectedUsers = [];
const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

// CORS Configuration
const corsOptions = {
  origin: process.env.NODE_ENV === "production"
    ? "https://hotelexpress.onrender.com"
    : "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ['set-cookie']
};

// MongoDB connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Store Configuration
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions',
  expires: 1000 * 60 * 60 * 24,
  autoRemove: 'native'
});

store.on('error', (error) => {
  console.error('Session store error:', error);
});

// Socket.IO Configuration
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production"
      ? "https://hotelexpress.onrender.com"
      : "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Middleware order
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    httpOnly: true
  },
  store: store,
  resave: true,
  saveUninitialized: true,
  rolling: true
}));

// Headers adicionales
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Debug middleware
app.use((req, res, next) => {
  console.log('Session debug:', {
    sessionID: req.sessionID,
    userId: req.session?.userId,
    cookie: req.session?.cookie
  });
  next();
});

// Debug middleware for static files
app.use((req, res, next) => {
  console.log('Request path:', req.path);
  console.log('Static file path:', path.join(__dirname, 'build', req.path));
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use("/excel", excelExportRoutes);
app.use('/payment-totals', paymentTotalsRoutes);
app.use('/drinks', drinkRoutes);
app.use('/guests', guestRoutes);
app.use('/', gananciasSaveRouter);
app.use('/excel', gananciasExportRouter);

// Socket connection handling
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
    console.log(`User disconnected: ${userId}`);
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

// API Routes
app.get("/check-session", (req, res) => {
  console.log('Check session:', {
    sessionId: req.sessionID,
    session: req.session,
    userId: req.session?.userId
  });

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

app.post("/create-reservation", async (req, res) => {
  try {
    const { reservationData } = req.body;
    const userId = req.query.userId;

    if (!reservationData) {
      return res.status(400).json({ message: "Reservation data is missing" });
    }

    const aiAnalysis = await tfAgent.analyzeReservation(reservationData);

    const payments = reservationData.payments || [];
    const precioTotal = parseFloat(reservationData.precioTotal);
    let totalPaidSoFar = 0;

    const processedPayments = payments.map(payment => {
      const amount = parseFloat(payment.amount);
      totalPaidSoFar += amount;
      return {
        ...payment,
        amount,
        montoPendiente: precioTotal - totalPaidSoFar,
        recepcionista: payment.recepcionista
      };
    });

    if (totalPaidSoFar > precioTotal) {
      return res.status(400).json({
        message: "El total de pagos no puede exceder el precio total"
      });
    }

    const reservationBase = {
      ...reservationData,
      user: userId,
      payments: processedPayments,
      totalPaid: totalPaidSoFar,
      montoPendiente: precioTotal - totalPaidSoFar,
      price: parseFloat(reservationData.price),
      precioTotal: precioTotal,
      roomStatus: reservationData.roomStatus || 'disponible',
    };

    const reservations = Array.isArray(reservationData.room)
      ? reservationData.room.map(room => ({
        ...reservationBase,
        room
      }))
      : [{ ...reservationBase }];

    const createdReservations = await Reservation.insertMany(reservations);

    const userSockets = connectedUsers.filter((user) => user.user === userId);
    userSockets.forEach((userSocket) => {
      io.to(userSocket.socketId).emit("reservationCreated", createdReservations);
    });

    await updateAndEmitPaymentMethodTotals(userId);

    res.status(200).json({
      message: "Reservations created successfully",
      reservations: createdReservations,
      aiInsights: aiAnalysis
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function for payment totals
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

// Serve static files - Move this AFTER all API routes
app.use(express.static(path.join(__dirname, 'build')));

// Catchall handler - This should be the LAST route
app.get('*', (req, res) => {
  console.log('Fallback to index.html for path:', req.path);
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Default styles route
app.get("/default-styles", (req, res) => {
  const defaultStyles = {
    statusStyles: {
      roomStatus: {
        disponible: { backgroundColor: '#86EFAC', borderColor: '#86EFAC' },
        ocupada: { backgroundColor: '#FDA4AF', borderColor: '#FDA4AF' },
        limpieza: { backgroundColor: '#FDE047', borderColor: '#FDE047' },
        mantenimiento: { backgroundColor: '#94A3B8', borderColor: '#94A3B8' },
        bloqueada: { backgroundColor: '#475569', borderColor: '#475569' },
        checkout_pendiente: { backgroundColor: '#FDBA74', borderColor: '#FDBA74' },
        reservada: { backgroundColor: '#7DD3FC', borderColor: '#7DD3FC' }
      },
      billingStatus: {
        pendiente: { backgroundColor: '#fa0101' },
        efectivo: { backgroundColor: '#86EFAC' },
        tarjeta: { backgroundColor: '#93C5FD' },
        transferencia: { backgroundColor: '#FDE047' }
      }
    }
  };
  res.json(defaultStyles);
});

// Start server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});


