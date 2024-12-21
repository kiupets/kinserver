const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Reservation = require('../models/Reservation');

// Ruta para actualizar los estilos del usuario y sus reservaciones
router.post('/update', async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ message: "Debe iniciar sesión para actualizar los estilos" });
        }

        const styles = req.body;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Actualizar los estilos en el documento del usuario
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { styles: styles } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        // Actualizar los estilos en las reservaciones desde hoy
        await Reservation.updateMany(
            {
                user: userId,
                $or: [
                    { start: { $gte: today } },  // Reservaciones que empiezan hoy o después
                    { end: { $gte: today } }     // Reservaciones que terminan hoy o después
                ]
            },
            { $set: { styles: styles } }
        );

        res.status(200).json({ message: "Estilos actualizados exitosamente", styles: user.styles });
    } catch (error) {
        console.error('Error al actualizar estilos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta para obtener los estilos del usuario
router.get('/', async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ message: "Debe iniciar sesión para ver los estilos" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.status(200).json({ styles: user.styles });
    } catch (error) {
        console.error('Error al obtener estilos:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 