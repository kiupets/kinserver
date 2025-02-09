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



// router.post("/login", async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     console.log("Login attempt for:", username);

//     const user = await User.findOne({ username });
//     if (!user) {
//       console.log("User not found");
//       return res.status(401).json({ message: "Credenciales inválidas" });
//     }

//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       console.log("Invalid password");
//       return res.status(401).json({ message: "Credenciales inválidas" });
//     }

//     // Regenera la sesión para prevenir session fixation
//     req.session.regenerate((err) => {
//       if (err) {
//         console.error('Session regeneration error:', err);
//         return res.status(500).json({ message: "Error en el servidor" });
//       }

//       // Guarda los datos en la sesión
//       req.session.userId = user._id.toString();
//       req.session.authenticated = true;

//       // Guarda la sesión explícitamente
//       req.session.save((err) => {
//         if (err) {
//           console.error('Session save error:', err);
//           return res.status(500).json({ message: "Error en el servidor" });
//         }

//         console.log('Session saved successfully:', {
//           sessionID: req.sessionID,
//           userId: req.session.userId,
//           authenticated: req.session.authenticated
//         });

//         res.status(200).json({
//           success: true,
//           message: "Inicio de sesión exitoso",
//           userId: user._id
//         });
//       });
//     });

//   } catch (error) {
//     console.error("Login error:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
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

module.exports = router;


