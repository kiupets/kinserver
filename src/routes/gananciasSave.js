const express = require('express');
const router = express.Router();
const Ganancias = require('../models/Ganancias');
const calcularOcupacionMensual = require('../utils/occupancyCalculator');
const plantillaNoviembre = require('../templates/plantillaNoviembre.json');

router.post('/save-ganancias/:userId', async (req, res) => {
    try {
        const { ingresos, gastosOrdinarios, gastosExtraordinarios, month, year, cajaAnterior } = req.body;
        const { userId } = req.params;

        console.log('Datos recibidos en save-ganancias:', {
            userId,
            month,
            year,
            cajaAnterior,
            ingresosLength: ingresos?.length,
            gastosOrdinariosLength: gastosOrdinarios?.length,
            gastosExtraordinariosLength: gastosExtraordinarios?.length
        });

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

        // Obtener el saldo final del mes anterior si no se proporciona cajaAnterior
        let valorCajaAnterior = cajaAnterior;
        if (valorCajaAnterior === undefined || valorCajaAnterior === null) {
            let mesAnterior = parseInt(month) - 1;
            let añoAnterior = parseInt(year);
            if (mesAnterior === 0) {
                mesAnterior = 12;
                añoAnterior--;
            }
            mesAnterior = mesAnterior.toString().padStart(2, '0');

            const registroAnterior = await Ganancias.findOne({
                userId,
                month: mesAnterior,
                year: añoAnterior
            });

            if (registroAnterior && registroAnterior.caja) {
                valorCajaAnterior = registroAnterior.caja.saldoFinal;
            } else {
                valorCajaAnterior = 0;
            }
        }

        // Calcular ocupación del mes automáticamente
        const estadisticasOcupacion = await calcularOcupacionMensual(month, year);
        console.log('Estadísticas de ocupación calculadas:', estadisticasOcupacion);

        // Procesar gastos ordinarios para asegurar que todos los campos requeridos estén presentes
        const gastosOrdinariosProcessed = gastosOrdinarios.map(gasto => {
            const gastoProcessed = {
                ...gasto,
                metodoPago: gasto.metodoPago || 'EFECTIVO',
                valorHora: gasto.valorHora || 1500
            };

            // Procesar campos específicos para horas extras
            if (gasto.tipo === 'HORAS_EXTRAS') {
                gastoProcessed.fecha = gasto.fecha || new Date();
                gastoProcessed.turno = gasto.turno || 'MAÑANA';
                gastoProcessed.cantidadHoras = gasto.cantidadHoras || 0;
                gastoProcessed.monto = (gasto.cantidadHoras || 0) * (gasto.valorHora || 1500);
            }

            // Procesar campos específicos para insumos
            if (gasto.tipo === 'INSUMOS_DESAYUNO' || gasto.tipo === 'INSUMOS_LIMPIEZA') {
                gastoProcessed.monto = gasto.monto || 0;
            }

            return gastoProcessed;
        });

        // Calcular valores de caja
        const ingresosEfectivo = ingresos
            .find(i => i.subcategoria === 'Efectivo')?.monto || 0;

        const gastosEfectivo = gastosOrdinariosProcessed
            .filter(g => g.metodoPago === 'EFECTIVO')
            .reduce((sum, g) => sum + (g.monto || 0), 0);

        const saldoFinal = valorCajaAnterior + ingresosEfectivo - gastosEfectivo;

        const result = await Ganancias.findOneAndUpdate(
            {
                userId,
                year: parseInt(year),
                month
            },
            {
                $set: {
                    ingresos: ingresos || [],
                    gastosOrdinarios: gastosOrdinariosProcessed,
                    gastosExtraordinarios: gastosExtraordinarios || [],
                    occupancyRate: estadisticasOcupacion.porcentajeOcupacion,
                    year: parseInt(year),
                    month,
                    userId,
                    cajaAnterior: valorCajaAnterior,
                    caja: {
                        cajaAnterior: valorCajaAnterior,
                        ingresosEfectivo,
                        gastosEfectivo,
                        saldoFinal
                    }
                }
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        console.log('Datos guardados:', {
            id: result._id,
            month: result.month,
            year: result.year,
            cajaAnterior: result.cajaAnterior,
            caja: result.caja,
            ingresosLength: result.ingresos?.length,
            gastosOrdinariosLength: result.gastosOrdinarios?.length,
            gastosExtraordinariosLength: result.gastosExtraordinarios?.length
        });

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

        // Verificar si es un mes futuro
        const fechaActual = new Date();
        const fechaConsulta = new Date(parseInt(year), parseInt(month) - 1);
        const esMesFuturo = fechaConsulta > fechaActual;

        // Calcular ocupación actual
        const estadisticasOcupacion = await calcularOcupacionMensual(month, year);
        console.log('Estadísticas de ocupación obtenidas:', estadisticasOcupacion);
        const occupancyRate = estadisticasOcupacion.porcentajeOcupacion || 0;

        // Primero intentar cargar de la base de datos para cualquier mes
        let ganancias = await Ganancias.findOne({
            userId,
            month,
            year: parseInt(year)
        });

        // Si no existe, usar plantilla para cualquier mes
        if (!ganancias) {
            const datosBase = {
                ingresos: plantillaNoviembre.ingresos,
                gastosOrdinarios: plantillaNoviembre.gastosOrdinarios.map(gasto => {
                    const gastoBase = {
                        ...gasto
                    };

                    // Agregar fecha para HORAS_EXTRAS
                    if (gasto.tipo === 'HORAS_EXTRAS') {
                        gastoBase.fecha = new Date();
                    }

                    return gastoBase;
                }),
                gastosExtraordinarios: plantillaNoviembre.gastosExtraordinarios,
                occupancyRate: occupancyRate,
                month,
                year: parseInt(year),
                userId,
                cajaAnterior: 0,
                caja: {
                    cajaAnterior: 0,
                    ingresosEfectivo: 0,
                    gastosEfectivo: 0,
                    saldoFinal: 0
                }
            };

            // Si no es diciembre, guardar en la base de datos
            if (month !== '12') {
                ganancias = new Ganancias(datosBase);
                await ganancias.save();
            } else {
                // Para diciembre solo retornar los datos sin guardar
                return res.status(200).json({
                    data: datosBase
                });
            }
        }

        // Actualizar porcentaje de ocupación
        ganancias.occupancyRate = occupancyRate;

        // Eliminar duplicados en gastosOrdinarios
        const gastosUnicos = new Map();
        ganancias.gastosOrdinarios.forEach(gasto => {
            const key = `${gasto.tipo}-${gasto.concepto}`;
            if (!gastosUnicos.has(key) || gasto.updatedAt > gastosUnicos.get(key).updatedAt) {
                gastosUnicos.set(key, gasto);
            }
        });
        ganancias.gastosOrdinarios = Array.from(gastosUnicos.values());

        // Recalcular valores de caja
        const ingresosEfectivo = ganancias.ingresos
            .find(i => i.subcategoria === 'Efectivo')?.monto || 0;

        const gastosEfectivo = ganancias.gastosOrdinarios
            .filter(g => g.metodoPago === 'EFECTIVO')
            .reduce((sum, g) => sum + (g.monto || 0), 0);

        ganancias.caja = {
            cajaAnterior: ganancias.cajaAnterior,
            ingresosEfectivo,
            gastosEfectivo,
            saldoFinal: ganancias.cajaAnterior + ingresosEfectivo - gastosEfectivo
        };

        await ganancias.save();

        res.status(200).json({
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