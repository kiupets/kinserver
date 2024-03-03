// const express = require("express");
// const router = express.Router();
// const bcrypt = require("bcrypt");
// const User = require("../models/User");

// router.post("/register", async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     // Check if the username already exists
//     const existingUser = await User.findOne({ username });
//     if (existingUser) {
//       return res
//         .status(400)
//         .json({ message: "El nombre de usuario ya está en uso" });
//     }

//     // Create a new user document
//     const newUser = new User({ username, password });

//     // Save the user document to the database
//     await newUser.save();

//     // Store the user ID in the session
//     req.session.userId = newUser._id;

//     res.status(201).json({ message: "Usuario registrado exitosamente" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// router.post("/login", async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     // Find the user in the database
//     const user = await User.findOne({ username });

//     if (!user) {
//       return res.status(401).json({ message: "Credenciales inválidas" });
//     }

//     // Compare the passwords
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (!isPasswordValid) {
//       return res.status(401).json({ message: "Credenciales inválidas" });
//     }

//     // Store the user ID in the session
//     req.session.userId = user._id;

//     res
//       .status(200)
//       .json({ message: "Inicio de sesión exitoso", userId: user._id });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// router.get("/logout", (req, res) => {
//   // Eliminar la sesión del almacén de sesiones
//   console.log(req.headers.cookie);
//   req.session.destroy((err) => {
//     if (err) {
//       console.error("Error al cerrar la sesión:", err);
//       res.status(500).json({ message: "Error al cerrar la sesión" });
//     } else {
//       res.json({ message: "Cierre de sesión exitoso" });
//     }
//   });
// });

// // Endpoint para verificar la sesión del usuario
// router.get("/check-session", async (req, res) => {
//   try {
//     // Verificar si hay un usuario en sesión
//     const userId = req.session.userId;
//     if (!userId) {
//       return res.status(401).json({ message: "No hay sesión activa" });
//     }

//     // Devolver información del usuario
//     res.json({ message: "Sesión activa" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Endpoint para obtener información del usuario en sesión
// router.get("/me", async (req, res) => {
//   try {
//     // Verificar si hay un usuario en sesión
//     const userId = req.session.userId;
//     if (!userId) {
//       return res.status(401).json({ message: "No hay sesión activa" });
//     }

//     // Buscar el usuario en la base de datos
//     const user = await User.findById(userId);
//     if (!user) {
//       // Si no se encuentra el usuario, eliminar el ID de la sesión
//       delete req.session.userId;
//       return res.status(404).json({ message: "Usuario no encontrado" });
//     }

//     // Devolver información del usuario
//     res.json({ user });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// module.exports = router;
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

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    req.session.userId = user._id;

    res
      .status(200)
      .json({ message: "Inicio de sesión exitoso", userId: user._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al cerrar la sesión:", err);
      res.status(500).json({ message: "Error al cerrar la sesión" });
    } else {
      res.json({ message: "Cierre de sesión exitoso" });
    }
  });
});

router.get("/check-session", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: "No hay sesión activa" });
    }

    res.json({ message: "Sesión activa" });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
