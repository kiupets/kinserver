const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");

router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "El nombre de usuario ya está en uso" });
    }

    const newUser = new User({ username, password });
    await newUser.save();

    req.session.userId = newUser._id;

    res.status(201).json({ message: "Usuario registrado exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/login", async (req, res) => {
 
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
    console.log("Session after login:", req.session.userId);
    req.session.userId = user._id.toString();
    console.log('Session after setting userId:', req.session);
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
      } else {
        console.log('Session saved successfully');
      }
      // Send response here, after session is saved
      
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

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al cerrar la sesión:", err);
      res.status(500).json({ message: "Error al cerrar la sesión" });
    } else {
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.json({ message: "Cierre de sesión exitoso" });
    }
  });
});

router.get("/check", async (req, res) => {
  try {
    if (req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user) {
        return res.json({ isAuthenticated: true, userId: user._id });
      }
    }
    res.json({ isAuthenticated: false });
  } catch (error) {
    console.error("Error checking authentication:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: "No hay sesión activa" });
    }

    const user = await User.findById(userId);
    if (!user) {
      delete req.session.userId;
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
// Updated Authentication Implementation

// auth.js

// const express = require("express");
// const router = express.Router();
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; // Make sure to set this in your environment variables

// // Middleware to verify JWT
// const verifyToken = (req, res, next) => {
//   const token = req.header('Authorization')?.split(' ')[1];

//   if (!token) {
//     return res.status(401).json({ message: "No token provided" });
//   }

//   try {
//     const decoded = jwt.verify(token, JWT_SECRET);
//     req.userId = decoded.userId;
//     next();
//   } catch (error) {
//     return res.status(401).json({ message: "Invalid token" });
//   }
// };

// router.post("/register", async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     const existingUser = await User.findOne({ username });
//     if (existingUser) {
//       return res.status(400).json({ message: "El nombre de usuario ya está en uso" });
//     }

//     const newUser = new User({ username, password });
//     await newUser.save();

//     const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '1d' });
//     req.session.userId = newUser._id;

//     res.status(201).json({ message: "Usuario registrado exitosamente", token });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// router.post("/login", async (req, res) => {
//   // console.log('Attempting to log in with:', { username, password });
//   // console.log('Attempting to REQ RES:',req,res)
//   try {
//     const { username, password } = req.body;
//     console.log("Login attempt for username:", username);

//     const user = await User.findOne({ username });
//     console.log("User found:", user ? "Yes" : "No");

//     if (!user) {
//       console.log("Login failed: User not found");
//       return res.status(401).json({ message: "Credenciales inválidas" });
//     }

//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     console.log("Password valid:", isPasswordValid);

//     if (!isPasswordValid) {
//       console.log("Login failed: Invalid password");
//       return res.status(401).json({ message: "Credenciales inválidas" });
//     }

//     const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
//     req.session.userId = user._id.toString();
//     console.log('Session after setting userId:', req.session);

//     req.session.save((err) => {
//       if (err) {
//         console.error('Error saving session:', err);
//       } else {
//         console.log('Session saved successfully');
//       }
      
//       res.status(200).json({ 
//         success: true,
//         message: "Inicio de sesión exitoso", 
//         userId: user._id,
//         token
//       });
//     });
  
//   } catch (error) {
//     console.error("Login error:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// router.post("/logout", (req, res) => {
//   req.session.destroy((err) => {
//     if (err) {
//       console.error("Error al cerrar la sesión:", err);
//       res.status(500).json({ message: "Error al cerrar la sesión" });
//     } else {
//       res.clearCookie('connect.sid'); // Clear the session cookie
//       res.json({ message: "Cierre de sesión exitoso" });
//     }
//   });
// });

// router.get("/check", verifyToken, async (req, res) => {
//   try {
//     const user = await User.findById(req.userId);
//     if (user) {
//       return res.json({ isAuthenticated: true, userId: user._id });
//     }
//     res.json({ isAuthenticated: false });
//   } catch (error) {
//     console.error("Error checking authentication:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// router.get("/me", verifyToken, async (req, res) => {
//   try {
//     const user = await User.findById(req.userId);
//     if (!user) {
//       return res.status(404).json({ message: "Usuario no encontrado" });
//     }

//     res.json({ user });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// module.exports = router;