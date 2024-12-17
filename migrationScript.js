// src/routes/gananciasSave.js
const express = require('express');
const router = express.Router();
const Ganancias = require('../models/Ganancias');

router.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
    next();
});

router.post('/save-ganancias/:userId', async (req, res) => {
    try {
        console.log('Body recibido:', req.body);
        console.log('UserID:', req.params.userId);

        const { ingresos, gastosOrdinarios, gastosExtraordinarios, occupancyRate, month } = req.body;
        const { userId } = req.params;
        const year = new Date().getFullYear();

        if (!userId) {
            return res.status(401).json({
                message: "No autorizado. Usuario no proporcionado."
            });
        }

        // Buscar y actualizar, o crear si no existe
        const result = await Ganancias.findOneAndUpdate(
            {
                userId,
                year,
                month
            },
            {
                $set: {
                    ingresos: ingresos || [],
                    gastosOrdinarios: gastosOrdinarios || [],
                    gastosExtraordinarios: gastosExtraordinarios || [],
                    occupancyRate: occupancyRate || 0,
                    fecha: new Date()
                }
            },
            {
                new: true,
                upsert: true // Crear si no existe
            }
        );

        console.log('Datos guardados exitosamente');

        res.status(200).json({
            message: "Datos guardados exitosamente",
            data: result
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
        const { userId } = req.params;
        const { month } = req.query;
        const year = new Date().getFullYear();

        if (!userId) {
            return res.status(401).json({
                message: "No autorizado. Por favor, inicie sesión."
            });
        }

        // Buscar datos específicos para el mes y año
        const ganancias = await Ganancias.findOne({
            userId,
            year,
            month
        });

        if (!ganancias) {
            // Si no hay datos para ese mes, devolver estructura vacía
            return res.status(200).json({
                data: {
                    ingresos: [
                        { subcategoria: 'Efectivo', monto: 0 },
                        { subcategoria: 'Depósitos', monto: 0 },
                        { subcategoria: 'Tarjeta', monto: 0 }
                    ],
                    gastosOrdinarios: [],
                    gastosExtraordinarios: [],
                    occupancyRate: 0,
                    month,
                    year
                }
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