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

// Serve static files
app.use(express.static(path.join(__dirname, 'build')));

// Catchall handler
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});


