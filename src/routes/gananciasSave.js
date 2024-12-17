// // routes/gananciasSave.js
// const express = require('express');
// const router = express.Router();
// const Ganancias = require('../models/Ganancias');
// const calcularOcupacionMensual = require('../utils/occupancyCalculator');

// router.post('/save-ganancias/:userId', async (req, res) => {
//     try {
//         console.log('Body recibido:', req.body);
//         console.log('UserID:', req.params.userId);

//         const { ingresos, gastosOrdinarios, gastosExtraordinarios, month, year } = req.body;
//         const { userId } = req.params;

//         if (!userId) {
//             return res.status(401).json({
//                 message: "No autorizado. Usuario no proporcionado."
//             });
//         }

//         // Validate month and year
//         if (!month || !year) {
//             return res.status(400).json({
//                 message: "Mes y año son requeridos."
//             });
//         }

//         const estadisticasOcupacion = await calcularOcupacionMensual(month, year);

//         const result = await Ganancias.findOneAndUpdate(
//             {
//                 userId,
//                 year: parseInt(year),
//                 month
//             },
//             {
//                 $set: {
//                     ingresos: ingresos || [],
//                     gastosOrdinarios: gastosOrdinarios || [],
//                     gastosExtraordinarios: gastosExtraordinarios || [],
//                     occupancyRate: estadisticasOcupacion.porcentajeOcupacion || 0,
//                     year: parseInt(year),
//                     month,
//                     userId
//                 }
//             },
//             {
//                 new: true,
//                 upsert: true,
//                 runValidators: true
//             }
//         );

//         console.log('Datos guardados exitosamente');

//         res.status(200).json({
//             message: "Datos guardados exitosamente",
//             data: result
//         });

//     } catch (error) {
//         console.error('Error al guardar ganancias:', error);
//         res.status(500).json({
//             message: "Error al guardar los datos",
//             error: error.message
//         });
//     }
// });

// router.get('/get-ganancias/:userId', async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { month, year } = req.query;

//         console.log('Buscando datos para:', { userId, month, year });

//         if (!userId) {
//             return res.status(401).json({
//                 message: "No autorizado. Por favor, inicie sesión."
//             });
//         }

//         if (!month || !year) {
//             return res.status(400).json({
//                 message: "Mes y año son requeridos."
//             });
//         }

//         let ganancias = await Ganancias.findOne({
//             userId,
//             month,
//             year: parseInt(year)
//         });

//         if (!ganancias) {
//             console.log('No se encontraron datos para el mes y año especificados');
//             const estadisticasOcupacion = await calcularOcupacionMensual(month, year);
//             return res.status(200).json({
//                 data: {
//                     ingresos: [
//                         { subcategoria: 'Efectivo', monto: 0 },
//                         { subcategoria: 'Depósitos', monto: 0 },
//                         { subcategoria: 'Tarjeta', monto: 0 }
//                     ],
//                     gastosOrdinarios: [],
//                     gastosExtraordinarios: [],
//                     occupancyRate: estadisticasOcupacion.porcentajeOcupacion || 0,
//                     month,
//                     year: parseInt(year)
//                 }
//             });
//         }

//         console.log('Datos encontrados:', ganancias);

//         res.status(200).json({
//             message: "Datos recuperados exitosamente",
//             data: ganancias
//         });

//     } catch (error) {
//         console.error('Error al obtener ganancias:', error);
//         res.status(500).json({
//             message: "Error al obtener los datos",
//             error: error.message
//         });
//     }
// });

// // Middleware para logging
// router.use((req, res, next) => {
//     console.log(`${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
//     next();
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const Ganancias = require('../models/Ganancias');
const calcularOcupacionMensual = require('../utils/occupancyCalculator');

router.post('/save-ganancias/:userId', async (req, res) => {
    try {
        const { ingresos, gastosOrdinarios, gastosExtraordinarios, month, year } = req.body;
        const { userId } = req.params;

        if (!userId) {
            return res.status(401).json({
                message: "No autorizado. Usuario no proporcionado."
            });
        }

        if (!month || !year) {
            return res.status(400).json({
                message: "Mes y año son requeridos."
            });
        }

        // Calcular ocupación del mes automáticamente
        const estadisticasOcupacion = await calcularOcupacionMensual(month, year);
        console.log('Estadísticas de ocupación calculadas:', estadisticasOcupacion);

        const result = await Ganancias.findOneAndUpdate(
            {
                userId,
                year: parseInt(year),
                month
            },
            {
                $set: {
                    ingresos: ingresos || [],
                    gastosOrdinarios: gastosOrdinarios || [],
                    gastosExtraordinarios: gastosExtraordinarios || [],
                    occupancyRate: estadisticasOcupacion.porcentajeOcupacion,
                    year: parseInt(year),
                    month,
                    userId
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

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
        const { month, year } = req.query;

        if (!userId) {
            return res.status(401).json({
                message: "No autorizado. Por favor, inicie sesión."
            });
        }

        if (!month || !year) {
            return res.status(400).json({
                message: "Mes y año son requeridos."
            });
        }

        // Calcular ocupación actual
        const estadisticasOcupacion = await calcularOcupacionMensual(month, year);
        console.log('Estadísticas de ocupación obtenidas:', estadisticasOcupacion);

        let ganancias = await Ganancias.findOne({
            userId,
            month,
            year: parseInt(year)
        });

        if (!ganancias) {
            return res.status(200).json({
                data: {
                    ingresos: [
                        { subcategoria: 'Efectivo', monto: 0 },
                        { subcategoria: 'Depósitos', monto: 0 },
                        { subcategoria: 'Tarjeta', monto: 0 }
                    ],
                    gastosOrdinarios: [],
                    gastosExtraordinarios: [],
                    occupancyRate: estadisticasOcupacion.porcentajeOcupacion,
                    month,
                    year: parseInt(year)
                }
            });
        }

        // Actualizar la tasa de ocupación con el valor calculado más reciente
        ganancias.occupancyRate = estadisticasOcupacion.porcentajeOcupacion;

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