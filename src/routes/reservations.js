// // routes/reservations.js
// const express = require("express");
// const router = express.Router();
// const jwt = require("jsonwebtoken");
// const Reservation = require("../models/Reservation");
// const uuid = require("uuid");
// router.get("/reservations", async (req, res) => {
//   try {
//     const userId = req.session.userId; // Obtener el ID del usuario desde la sesión
//     if (!userId) {
//       return res
//         .status(401)
//         .json({ message: "Debe iniciar sesión para ver las reservas" });
//     }
//     const reservations = await Reservation.find({ user: userId });
//     res.status(200).json({ reservations });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // routes/reservations.js

// // POST para crear una nueva reserva
// router.post("/create-reservation", async (req, res) => {
//   try {
//     const userId = req.session.userId; // Obtener el ID del usuario desde la sesión
//     console.log(userId);
//     if (!userId) {
//       return res
//         .status(401)
//         .json({ message: "Debe iniciar sesión para hacer una reserva" });
//     }

//     const { name, email, phone, room, start, end, price, nights } = req.body;
//     const id = uuid.v4();
//     // Crear una nueva instancia de Reservation
//     const reservation = new Reservation({
//       id,
//       user: userId,
//       name,
//       email,
//       phone,
//       room,
//       start,
//       end,
//       price,
//       nights,
//     });

//     // Guardar la reserva en la base de datos
//     console.log(reservation);
//     await reservation.save();

//     res
//       .status(201)
//       .json({ message: "Reserva creada exitosamente.", reservation });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// router.get("/all", async (req, res) => {
//   try {
//     const reservations = await Reservation.find({});
//     res.status(200).json({ reservations });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });
// router.get("/user/:userId", async (req, res) => {
//   const userId = req.params.userId;
//   try {
//     const userReservations = await Reservation.find({ userId: userId });
//     res.status(200).json({ userReservations });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });
// module.exports = router;
const express = require("express");
const router = express.Router();
const Reservation = require("../models/Reservation");
const User = require("../models/User");
const uuid = require("uuid");
// const connectedUsers = require("../connectedUsers");

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: "Debe iniciar sesión para acceder" });
  }
};

router.post("/create-reservation", async (req, res) => {
  try {
    console.log(connectedUsers);
    const userId = req.session.userId; // Obtener el ID del usuario desde la sesión

    if (!userId) {
      console.log("dale dale user");
      return res
        .status(401)
        .json({ message: "Debe iniciar sesión para hacer una reserva" });
    }

    // Extraer datos de la solicitud
    const { name, email, phone, room, start, end, price, nights } = req.body;

    // Generar un nuevo ID para la reserva
    const id = uuid.v4();

    // Crear una nueva instancia de Reservation
    const reservation = new Reservation({
      id,
      user: userId,
      name,
      email,
      phone,
      room,
      start,
      end,
      price,
      nights,
    });

    // Guardar la reserva en la base de datos
    await reservation.save();

    // Emitir un evento a través de socket.io solo al usuario logeado
    if (req.io && connectedUsers) {
      // const socketsToSendTo = Object.values(connectedUsers);
      console.log(connectedUsers, "reqqqqqqqqqqqqqqqqq");
      // for (const socketId of socketsToSendTo) {
      //   req.io.to(socketId).emit("chupeteINFRONT", reservation);
      // }
      // console.log("req io esta connectado ");
      // // req.io.to(userId).emit("chupeteINFRONT", reservation);
      // req.io.emit("chupeteINFRONT", reservation);
    }
    // req.io.to(userId).emit("chupeteINFRONT", reservation);
    // Responder con un mensaje de éxito y la reserva creada
    res
      .status(201)
      .json({ message: "Reserva creada exitosamente.", reservation });
  } catch (error) {
    // Manejar errores
    res.status(500).json({ error: error.message });
  }
});

router.get("/reservations", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ message: "Debe iniciar sesión para ver las reservas" });
    }
    const reservations = await Reservation.find({ user: userId });
    res.status(200).json({ reservations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get("/all", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ message: "Debe iniciar sesión para ver las reservas" });
    }

    const userReservations = await Reservation.find({ user: userId });
    res.status(200).json({ userReservations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/user/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const userReservations = await Reservation.find({ user: userId });
    res.status(200).json({ userReservations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
