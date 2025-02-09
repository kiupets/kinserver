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

// Duplicate '/login' endpoint removed in favor of the login endpoint defined in index.js.

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al cerrar la sesión:", err);
      res.status(500).json({ message: "Error al cerrar la sesión" });
    } else {
      res.clearCookie('billing.sid');
      res.status(200).json({ message: "Cierre de sesión exitoso" });
    }
  });
});

module.exports = router;


