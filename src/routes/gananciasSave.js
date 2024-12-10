

// src/routes/gananciasSave.js
const express = require('express');
const router = express.Router();
const Ganancias = require('../models/Ganancias');

// Ruta para guardar datos
router.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
    next();
});

router.post('/save-ganancias/:userId', async (req, res) => {
    try {
        console.log('Body recibido:', req.body); // Debug
        console.log('UserID:', req.params.userId); // Debug

        const { ingresos, gastosOrdinarios, gastosExtraordinarios } = req.body;
        const { userId } = req.params;

        if (!userId) {
            return res.status(401).json({
                message: "No autorizado. Usuario no proporcionado."
            });
        }

        const nuevasGanancias = new Ganancias({
            ingresos: ingresos || [],
            gastosOrdinarios: gastosOrdinarios || [],
            gastosExtraordinarios: gastosExtraordinarios || [],
            userId
        });

        await nuevasGanancias.save();
        console.log('Datos guardados exitosamente'); // Debug

        res.status(200).json({
            message: "Datos guardados exitosamente",
            data: {
                ingresos: nuevasGanancias.ingresos,
                gastosOrdinarios: nuevasGanancias.gastosOrdinarios,
                gastosExtraordinarios: nuevasGanancias.gastosExtraordinarios
            }
        });

    } catch (error) {
        console.error('Error al guardar ganancias:', error);
        res.status(500).json({
            message: "Error al guardar los datos",
            error: error.message
        });
    }
});

router.get('/get-ganancias/:userId', async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                message: "No autorizado. Por favor, inicie sesión."
            });
        }

        // Obtener el último registro de ganancias del usuario
        const ganancias = await Ganancias.findOne({ userId })
            .sort({ createdAt: -1 });

        if (!ganancias) {
            return res.status(404).json({
                message: "No se encontraron datos de ganancias"
            });
        }

        res.status(200).json({
            message: "Datos recuperados exitosamente",
            data: ganancias
        });

    } catch (error) {
        console.error('Error al obtener ganancias:', error);
        res.status(500).json({
            message: "Error al obtener los datos",
            error: error.message
        });
    }
});

module.exports = router;