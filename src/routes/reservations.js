// const express = require("express");
// const router = express.Router();
// const Reservation = require("../models/Reservation");
// const User = require("../models/User");
// const uuid = require("uuid");
// // const connectedUsers = require("../connectedUsers");

// const isAuthenticated = (req, res, next) => {
//   if (req.session.userId) {
//     next();
//   } else {
//     res.status(401).json({ message: "Debe iniciar sesión para acceder" });
//   }
// };

// router.post("/create-reservation", async (req, res) => {
//   try {
//     const userId = req.session.userId;

//     if (!userId) {
//       return res
//         .status(401)
//         .json({ message: "Debe iniciar sesión para hacer una reserva" });
//     }

//     // Extraer datos de la solicitud
//     const { name, email, phone, room, start, end, price, nights, styles } = req.body;

//     // Generar un nuevo ID para la reserva
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
//       styles
//     });

//     // Guardar la reserva en la base de datos
//     await reservation.save();

//     // Emitir un evento a través de socket.io solo al usuario logeado
//     if (req.io && connectedUsers) {
//       // Código de socket.io existente...
//     }

//     res.status(201).json({ message: "Reserva creada exitosamente.", reservation });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// router.put("/update-reservation/:id", async (req, res) => {
//   try {
//     const userId = req.session.userId;
//     if (!userId) {
//       return res
//         .status(401)
//         .json({ message: "Debe iniciar sesión para actualizar una reserva" });
//     }

//     const { id } = req.params;
//     const { styles, ...updateData } = req.body;

//     let reservation;
//     // Si solo viene styles, actualizamos solo los estilos
//     if (styles && Object.keys(updateData).length === 0) {
//       reservation = await Reservation.findOneAndUpdate(
//         { id: id, user: userId },
//         { styles },
//         { new: true }
//       );
//     } else {
//       // Para otras actualizaciones que no son de estilos
//       reservation = await Reservation.findOneAndUpdate(
//         { id: id, user: userId },
//         { ...updateData },
//         { new: true, runValidators: true }
//       );
//     }

//     if (!reservation) {
//       return res.status(404).json({ message: "Reserva no encontrada" });
//     }

//     // Emitir un evento a través de socket.io solo al usuario logeado
//     if (req.io && connectedUsers) {
//       // Código de socket.io existente...
//     }

//     res.status(200).json({ message: "Reserva actualizada exitosamente", reservation });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// router.get("/reservations", async (req, res) => {
//   try {
//     const userId = req.session.userId;
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

// router.get("/user/:userId", async (req, res) => {
//   const userId = req.params.userId;
//   try {
//     const userReservations = await Reservation.find({ user: userId });
//     res.status(200).json({ userReservations });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // Nueva ruta para actualizar estilos de todas las reservaciones activas
// router.put("/update-styles", async (req, res) => {
//   try {
//     const userId = req.session.userId;
//     if (!userId) {
//       return res
//         .status(401)
//         .json({ message: "Debe iniciar sesión para actualizar los estilos" });
//     }

//     const { styles } = req.body;
//     if (!styles) {
//       return res.status(400).json({ message: "Se requieren los estilos" });
//     }

//     // Actualizar los estilos de todas las reservaciones activas o futuras
//     const currentDate = new Date();
//     await Reservation.updateMany(
//       {
//         user: userId,
//         end: { $gte: currentDate } // Solo actualiza reservas activas o futuras
//       },
//       { $set: { styles } }
//     );

//     // Obtener todas las reservaciones actualizadas
//     const userReservations = await Reservation.find({
//       user: userId,
//       end: { $gte: currentDate }
//     });

//     // Emitir un evento a través de socket.io solo al usuario logeado
//     if (req.io && req.app.locals.connectedUsers && req.app.locals.connectedUsers[userId]) {
//       const userSockets = req.app.locals.connectedUsers[userId];
//       userSockets.forEach(socketId => {
//         req.io.to(socketId).emit("updateReservation", { userReservations });
//       });
//     }

//     res.status(200).json({
//       message: "Estilos actualizados exitosamente",
//       userReservations
//     });
//   } catch (error) {
//     console.error('Error updating styles:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// module.exports = router;
