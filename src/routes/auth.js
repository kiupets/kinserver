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

    req.session.userId = user._id.toString();
    console.log("Session after login:", req.session);
    console.log("Session ID:", req.sessionID);

    res.status(200).json({ 
      success: true,
      message: "Inicio de sesión exitoso", 
      userId: user._id
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
