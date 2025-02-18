const express = require('express');
const router = express.Router();
const Ganancias = require('../models/Ganancias');
const GananciasBackup = require('../models/GananciasBackup');
const calcularOcupacionMensual = require('../utils/occupancyCalculator');
const moment = require('moment');
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');

// Función para limpiar backups antiguos
async function cleanOldBackups(userId, month, year, keepCount = 5) {
    try {
        const backups = await GananciasBackup.find({ userId, month, year })
            .sort({ createdAt: -1 })
            .skip(keepCount);

        if (backups.length > 0) {
            await GananciasBackup.deleteMany({
                _id: { $in: backups.map(b => b._id) }
            });
        }
    } catch (error) {
        console.error('Error limpiando backups antiguos:', error);
    }
}

router.post('/save-ganancias/:userId', async (req, res) => {
    try {
        const { ingresos, gastosOrdinarios, gastosExtraordinarios, entradas, month, year, cajaAnterior } = req.body;
        const { userId } = req.params;

        console.log('Datos recibidos en save-ganancias:', {
            userId,
            month,
            year,
            cajaAnterior,
            ingresosLength: ingresos?.length,
            entradasLength: entradas?.length,
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

        // Crear backup de los datos existentes
        const existingData = await Ganancias.findOne({ userId, month, year });
        if (existingData) {
            await GananciasBackup.create({
                originalId: existingData._id,
                userId,
                month,
                year,
                data: existingData.toObject()
            });
            // Limpiar backups antiguos
            await cleanOldBackups(userId, month, year);
        }

        // Calcular fechas de inicio y fin del mes
        const monthStart = moment([parseInt(year), parseInt(month) - 1, 1]).startOf('month');
        const monthEnd = moment(monthStart).endOf('month');

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
                tipo: gasto.tipo === 'OTROS' ? 'MANTENIMIENTO' : gasto.tipo,
                metodoPago: gasto.metodoPago || 'EFECTIVO',
                valorHora: gasto.valorHora || 1500,
                fechaCompra: gasto.fechaCompra ? new Date(gasto.fechaCompra) : new Date()
            };

            // Procesar campos específicos para horas extras
            if (gasto.tipo === 'HORAS_EXTRAS') {
                gastoProcessed.fecha = gasto.fecha || new Date();
                gastoProcessed.turno = gasto.turno || 'MAÑANA';
                gastoProcessed.cantidadHoras = gasto.cantidadHoras || 0;
                gastoProcessed.monto = (gasto.cantidadHoras || 0) * (gasto.valorHora || 1500);
            }

            // Procesar campos específicos para aguinaldo
            if (gasto.tipo === 'AGUINALDO') {
                gastoProcessed.monto = parseFloat(gasto.monto) || 0;
                gastoProcessed.periodo = gasto.periodo || '1';
                // Validar que el periodo sea válido
                if (!['1', '2'].includes(gastoProcessed.periodo)) {
                    gastoProcessed.periodo = '1';
                }
            }

            // Procesar campos específicos para insumos
            if (gasto.tipo === 'INSUMOS_DESAYUNO' || gasto.tipo === 'INSUMOS_LIMPIEZA') {
                gastoProcessed.monto = gasto.monto || 0;
            }

            return gastoProcessed;
        });

        // Procesar gastos extraordinarios para asegurar fechaCompra
        const gastosExtraordinariosProcessed = gastosExtraordinarios.map(gasto => ({
            ...gasto,
            fechaCompra: gasto.fechaCompra ? new Date(gasto.fechaCompra) : new Date(),
            metodoPago: gasto.metodoPago || 'EFECTIVO'
        }));

        // Obtener las reservaciones del mes con sus pagos
        const reservations = await Reservation.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    $or: [
                        {
                            end: { $gte: monthStart.toDate() },
                            start: { $lte: monthEnd.toDate() }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'reservation',
                    as: 'payments'
                }
            }
        ]);

        // Calcular totales de pagos y pendientes
        const totals = {
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            total: 0,
            pendiente: 0
        };

        let gastosOrdinariosPendientes = 0;
        let gastosExtraordinariosPendientes = gastosExtraordinarios
            .reduce((sum, g) => sum + (g.montoPendiente || 0), 0);

        // Procesar cada reservación
        reservations.forEach(reservation => {
            const startDate = moment(reservation.start).add(3, 'hours');
            const endDate = moment(reservation.end).add(3, 'hours');

            // Calcular días efectivos en el mes actual
            const effectiveStart = moment.max(startDate, monthStart);
            const effectiveEnd = moment.min(endDate, monthEnd);
            const totalNights = endDate.diff(startDate, 'days') + 1;
            const nightsInMonth = effectiveEnd.diff(effectiveStart, 'days') + 1;
            const crossesMonths = startDate.format('YYYY-MM') !== endDate.format('YYYY-MM');
            const isOneNightCross = totalNights === 2 && crossesMonths;

            // Verificar si la reserva pertenece a este mes
            const startsInThisMonth = startDate.isBetween(monthStart, monthEnd, 'month', '[]');
            const endsInThisMonth = endDate.isBetween(monthStart, monthEnd, 'month', '[]');
            const belongsToThisMonth = startsInThisMonth || endsInThisMonth ||
                (startDate.isBefore(monthStart) && endDate.isAfter(monthEnd));

            if (belongsToThisMonth) {
                // Para reservas de una noche entre meses, asignar el monto total al mes de inicio
                const shouldUseFullAmount = isOneNightCross && startsInThisMonth;
                const proportionFactor = shouldUseFullAmount ? 1 : nightsInMonth / totalNights;
                const payments = reservation.payments || [];

                // Procesar pagos
                payments.forEach(payment => {
                    if (payment.method && payment.amount) {
                        const amount = shouldUseFullAmount ? payment.amount : payment.amount * proportionFactor;
                        totals[payment.method] += amount;
                    }
                });

                // Calcular el total como la suma de los métodos de pago
                totals.total = totals.efectivo + totals.tarjeta + totals.transferencia;

                // Calcular monto pendiente
                if (startsInThisMonth) {
                    const montoPendiente = shouldUseFullAmount ?
                        (reservation.montoPendiente || 0) :
                        (reservation.montoPendiente || 0) * proportionFactor;
                    totals.pendiente += montoPendiente;
                    gastosOrdinariosPendientes += montoPendiente;
                }
            }
        });

        const totalPendientes = gastosOrdinariosPendientes + gastosExtraordinariosPendientes;

        // Calcular valores de caja usando los totales calculados
        const gastosEfectivo = gastosOrdinariosProcessed
            .filter(g => g.metodoPago === 'EFECTIVO')
            .reduce((sum, g) => sum + (g.monto || 0), 0);

        const saldoFinal = valorCajaAnterior + totals.efectivo - gastosEfectivo;

        const result = await Ganancias.findOneAndUpdate(
            {
                userId,
                year: parseInt(year),
                month
            },
            {
                $set: {
                    ingresos: ingresos.map(ingreso => ({
                        subcategoria: ingreso.subcategoria,
                        monto: ingreso.monto || 0
                    })),
                    entradas: entradas || [],
                    gastosOrdinarios: gastosOrdinariosProcessed,
                    gastosExtraordinarios: gastosExtraordinariosProcessed || [],
                    occupancyRate: estadisticasOcupacion.porcentajeOcupacion,
                    year: parseInt(year),
                    month,
                    userId,
                    cajaAnterior: valorCajaAnterior,
                    caja: {
                        cajaAnterior: valorCajaAnterior,
                        ingresosEfectivo: ingresos.find(i => i.subcategoria === 'Efectivo')?.monto || 0,
                        gastosEfectivo,
                        saldoFinal: valorCajaAnterior + (ingresos.find(i => i.subcategoria === 'Efectivo')?.monto || 0) - gastosEfectivo
                    },
                    pendientes: {
                        gastosOrdinariosPendientes,
                        gastosExtraordinariosPendientes,
                        totalPendientes
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

        // Calcular fechas de inicio y fin del mes
        const monthStart = moment([parseInt(year), parseInt(month) - 1, 1]).startOf('month');
        const monthEnd = moment(monthStart).endOf('month');

        // Obtener reservaciones del mes
        const reservations = await Reservation.find({
            user: new mongoose.Types.ObjectId(userId),
            $or: [
                {
                    end: { $gte: monthStart.toDate() },
                    start: { $lte: monthEnd.toDate() }
                }
            ]
        }).populate('payments');

        // Calcular totales igual que en el Excel
        const totals = {
            efectivo: 0,
            tarjeta: 0,
            transferencia: 0,
            total: 0,
            pendiente: 0
        };

        // Procesar cada reservación
        reservations.forEach(reservation => {
            const startDate = moment(reservation.start).add(3, 'hours');
            const endDate = moment(reservation.end).add(3, 'hours');

            // Calcular días efectivos en el mes actual
            const effectiveStart = moment.max(startDate, monthStart);
            const effectiveEnd = moment.min(endDate, monthEnd);
            const totalNights = endDate.diff(startDate, 'days') + 1;
            const nightsInMonth = effectiveEnd.diff(effectiveStart, 'days') + 1;
            const crossesMonths = startDate.format('YYYY-MM') !== endDate.format('YYYY-MM');
            const isOneNightCross = totalNights === 2 && crossesMonths;

            // Verificar si la reserva pertenece a este mes
            const startsInThisMonth = startDate.isBetween(monthStart, monthEnd, 'month', '[]');
            const endsInThisMonth = endDate.isBetween(monthStart, monthEnd, 'month', '[]');
            const belongsToThisMonth = startsInThisMonth || endsInThisMonth ||
                (startDate.isBefore(monthStart) && endDate.isAfter(monthEnd));

            if (belongsToThisMonth) {
                // Para reservas de una noche entre meses, asignar el monto total al mes de inicio
                const shouldUseFullAmount = isOneNightCross && startsInThisMonth;
                const proportionFactor = shouldUseFullAmount ? 1 : nightsInMonth / totalNights;
                const payments = reservation.payments || [];

                // Procesar pagos
                payments.forEach(payment => {
                    if (payment.method && payment.amount) {
                        const amount = shouldUseFullAmount ? payment.amount : payment.amount * proportionFactor;
                        totals[payment.method] += amount;
                    }
                });

                // Calcular el total como la suma de los métodos de pago
                totals.total = totals.efectivo + totals.tarjeta + totals.transferencia;

                // Calcular monto pendiente
                if (startsInThisMonth) {
                    const montoPendiente = shouldUseFullAmount ?
                        (reservation.montoPendiente || 0) :
                        (reservation.montoPendiente || 0) * proportionFactor;
                    totals.pendiente += montoPendiente;
                }
            }
        });

        // Calcular estadísticas de ocupación
        const estadisticasOcupacion = await calcularOcupacionMensual(month, year);

        // Obtener el documento de ganancias existente
        let ganancias = await Ganancias.findOne({
            userId,
            month: month.toString(),
            year: parseInt(year)
        });

        // Si no existe, crear uno nuevo
        if (!ganancias) {
            ganancias = new Ganancias({
                userId,
                month: month.toString(),
                year: parseInt(year),
                ingresos: [
                    { subcategoria: 'Efectivo', monto: totals.efectivo },
                    { subcategoria: 'Tarjeta', monto: totals.tarjeta },
                    { subcategoria: 'Transferencia', monto: totals.transferencia }
                ],
                gastosOrdinarios: [],
                gastosExtraordinarios: [],
                occupancyRate: estadisticasOcupacion.porcentajeOcupacion
            });
        } else {
            // Actualizar los ingresos con los nuevos totales
            ganancias.ingresos = [
                { subcategoria: 'Efectivo', monto: totals.efectivo },
                { subcategoria: 'Tarjeta', monto: totals.tarjeta },
                { subcategoria: 'Transferencia', monto: totals.transferencia }
            ];
            ganancias.occupancyRate = estadisticasOcupacion.porcentajeOcupacion;
        }

        await ganancias.save();

        res.status(200).json({
            data: {
                ...ganancias.toObject(),
                ingresos: [
                    { subcategoria: 'Efectivo', monto: totals.efectivo },
                    { subcategoria: 'Tarjeta', monto: totals.tarjeta },
                    { subcategoria: 'Transferencia', monto: totals.transferencia },
                    { subcategoria: 'Total', monto: totals.total }
                ]
            }
        });

    } catch (error) {
        console.error('Error al obtener ganancias:', error);
        res.status(500).json({
            message: "Error al obtener los datos",
            error: error.message
        });
    }
});

// Ruta para limpiar toda la colección manteniendo solo el documento actual
router.delete('/cleanup/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { currentDocId } = req.query;

        if (!userId || !currentDocId) {
            return res.status(400).json({
                message: "Se requiere userId y el ID del documento actual"
            });
        }

        // 1. Primero obtener y guardar una copia del documento actual
        const currentDoc = await Ganancias.findById(currentDocId);
        if (!currentDoc) {
            return res.status(404).json({
                message: "No se encontró el documento actual especificado"
            });
        }

        // Guardar una copia de los datos actuales
        const docData = currentDoc.toObject();
        delete docData._id; // Removemos el _id para poder crear uno nuevo

        // 2. Borrar toda la colección para este usuario
        await Ganancias.deleteMany({ userId });

        // 3. Restaurar el documento actual
        const restoredDoc = await Ganancias.create(docData);

        res.status(200).json({
            message: "Base de datos limpiada exitosamente",
            keptDocument: {
                id: restoredDoc._id,
                month: restoredDoc.month,
                year: restoredDoc.year,
                updatedAt: restoredDoc.updatedAt
            }
        });

    } catch (error) {
        console.error('Error al limpiar la base de datos:', error);
        res.status(500).json({
            message: "Error al limpiar la base de datos",
            error: error.message
        });
    }
});

module.exports = router;